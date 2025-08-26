import * as vscode from "vscode";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";
import {
  getHardwareInfo,
  computeHardwareHash,
  getHardwareLabel,
} from "./hardware";
import { getProjectInfo } from "./project";
import { EventRecord, EventStore, JsonlEventStore, Filters } from "./storage";
import {
  getShellHistory,
  filterHistoryEntries,
  HistoryEntry,
} from "./shellHistory";
import { DummyDataGenerator } from "./dummyDataGenerator";

// Version constants for export/import validation
const CURRENT_DATA_VERSION = "1.0.0";
const CURRENT_PROFILE_VERSION = "1.0.0";
const SUPPORTED_DATA_VERSIONS = ["1.0.0"];
const SUPPORTED_PROFILE_VERSIONS = ["1.0.0"];

// Version validation functions
function validateDataVersion(version: string): {
  valid: boolean;
  message?: string;
} {
  if (!version) {
    return {
      valid: false,
      message: "No version information found in data file",
    };
  }

  if (!SUPPORTED_DATA_VERSIONS.includes(version)) {
    return {
      valid: false,
      message: `Data version ${version} is not supported. Supported versions: ${SUPPORTED_DATA_VERSIONS.join(
        ", "
      )}`,
    };
  }

  return { valid: true };
}

function validateProfileVersion(version: string): {
  valid: boolean;
  message?: string;
} {
  if (!version) {
    return {
      valid: false,
      message: "No version information found in profile file",
    };
  }

  if (!SUPPORTED_PROFILE_VERSIONS.includes(version)) {
    return {
      valid: false,
      message: `Profile version ${version} is not supported. Supported versions: ${SUPPORTED_PROFILE_VERSIONS.join(
        ", "
      )}`,
    };
  }

  return { valid: true };
}

let eventStore: EventStore;
let statusBarItem: vscode.StatusBarItem;
let lastRunResult: { success: boolean; durationMs: number } | null = null;
let dashboardPanels: vscode.WebviewPanel[] = [];
let currentTaskExecution: vscode.TaskExecution | undefined;

// Format duration in human-readable format (matches dashboard logic)
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  } else if (ms < 60000) {
    const seconds = (ms / 1000).toFixed(1);
    return `${seconds}s`;
  } else if (ms < 3600000) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  } else {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    if (minutes > 0 && seconds > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${hours}h`;
    }
  }
}

async function getOrCreateDeviceId(
  context: vscode.ExtensionContext
): Promise<string> {
  let deviceId = context.globalState.get<string>("processlens.deviceId");
  if (!deviceId) {
    deviceId = uuidv4();
    await context.globalState.update("processlens.deviceId", deviceId);
  }
  return deviceId;
}

async function pickWorkspaceFolder(): Promise<
  vscode.WorkspaceFolder | undefined
> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return undefined;
  }
  if (folders.length === 1) {
    return folders[0];
  }
  const selected = await vscode.window.showWorkspaceFolderPick();
  return selected ?? folders[0];
}

async function readPackageJsonScripts(
  folder: vscode.WorkspaceFolder
): Promise<Record<string, string>> {
  try {
    const pkgUri = vscode.Uri.joinPath(folder.uri, "package.json");
    const content = await vscode.workspace.fs.readFile(pkgUri);
    const json = JSON.parse(Buffer.from(content).toString("utf8"));
    return (json.scripts ?? {}) as Record<string, string>;
  } catch {
    return {};
  }
}

async function runAsTaskAndTime(
  command: string,
  kind: vscode.TaskDefinition,
  cwd?: vscode.Uri
): Promise<{
  durationMs: number;
  success: boolean;
  exitCode?: number;
  tsStart: number;
  tsEnd: number;
  cancelled?: boolean;
}> {
  return new Promise(async (resolve) => {
    const tsStart = Date.now();

    // Show running indicator
    updateStatusBar({ running: true, command });

    const shellExec = new vscode.ShellExecution(command, { cwd: cwd?.fsPath });
    const task = new vscode.Task(
      kind,
      vscode.TaskScope.Workspace,
      command,
      "processlens",
      shellExec
    );
    const disposable = vscode.tasks.onDidEndTaskProcess((e) => {
      if (e.execution.task === task) {
        const tsEnd = Date.now();
        const durationMs = tsEnd - tsStart;
        disposable.dispose();

        // Check if task was cancelled (exit code is typically undefined or negative for cancelled tasks)
        const wasCancelled = e.exitCode === undefined || e.exitCode < 0;

        // Clear current task execution
        if (currentTaskExecution === e.execution) {
          currentTaskExecution = undefined;
        }

        resolve({
          tsStart,
          tsEnd,
          durationMs,
          success: e.exitCode === 0,
          exitCode: e.exitCode ?? undefined,
          cancelled: wasCancelled,
        });
      }
    });

    // Execute task and store execution for potential cancellation
    const execution = await vscode.tasks.executeTask(task);
    currentTaskExecution = execution;
  });
}

function updateStatusBar(
  status?:
    | { success: boolean; durationMs: number }
    | { running: true; command: string }
) {
  if (!statusBarItem) return;

  if (status && "running" in status && status.running) {
    // Show running indicator
    statusBarItem.text = "$(sync~spin) Running...";
    statusBarItem.tooltip = `ProcessLens: Running "${status.command}"`;
  } else if (status && "success" in status) {
    // Show completed result
    lastRunResult = status;
    const icon = status.success ? "$(check)" : "$(error)";
    const duration = formatDuration(status.durationMs);
    statusBarItem.text = `${icon} ${duration}`;

    // Calculate trend if we have previous data
    // For now, just show the current result
    statusBarItem.tooltip = `Last run: ${
      status.success ? "Success" : "Failed"
    } in ${duration}`;
  } else {
    statusBarItem.text = "$(watch) —";
    statusBarItem.tooltip = "ProcessLens: No recent runs";
  }
}

function refreshAllDashboards() {
  dashboardPanels.forEach((panel) => {
    if (panel.visible) {
      panel.webview.postMessage({ type: "UPDATED" });
    }
  });
}

async function showShellHistoryPicker(): Promise<string | undefined> {
  try {
    const historyEntries = await getShellHistory(500);
    if (historyEntries.length === 0) {
      vscode.window.showInformationMessage("No shell history found.");
      return undefined;
    }

    const quickPick = vscode.window.createQuickPick();
    quickPick.placeholder = "Type to filter shell history commands...";
    quickPick.matchOnDescription = false;
    quickPick.matchOnDetail = false;

    // Convert history entries to QuickPickItems
    const historyItems = historyEntries.slice(0, 50).map((entry) => ({
      label: entry.command,
      description: entry.timestamp
        ? new Date(entry.timestamp).toLocaleString()
        : "No timestamp",
      detail: `Used ${entry.frequency} time${entry.frequency > 1 ? "s" : ""}`,
    }));

    quickPick.items = historyItems;

    let allHistoryItems = historyItems;
    let currentFilter = "";
    let activeItems = historyItems;

    const selection = await new Promise<string | undefined>((resolve) => {
      quickPick.onDidChangeValue((value) => {
        currentFilter = value;
        if (value.trim()) {
          // Filter the history entries
          const filtered = filterHistoryEntries(historyEntries, value);
          const filteredItems = filtered.slice(0, 50).map((entry) => ({
            label: entry.command,
            description: entry.timestamp
              ? new Date(entry.timestamp).toLocaleString()
              : "No timestamp",
            detail: `Used ${entry.frequency} time${
              entry.frequency > 1 ? "s" : ""
            }`,
          }));

          // If user typed something not in history, add it as an option
          if (
            !filtered.some(
              (entry) => entry.command.toLowerCase() === value.toLowerCase()
            )
          ) {
            filteredItems.unshift({
              label: value,
              description: "Run this custom command",
              detail: "Press Enter to execute",
            });
          }

          activeItems = filteredItems;
          quickPick.items = filteredItems;
        } else {
          activeItems = allHistoryItems;
          quickPick.items = allHistoryItems;
        }
      });

      quickPick.onDidAccept(() => {
        const selected = quickPick.selectedItems[0];
        if (selected) {
          resolve(selected.label);
          quickPick.dispose();
        } else if (quickPick.activeItems && quickPick.activeItems.length > 0) {
          // Fallback: use the first active item if no selection
          const activeItem = quickPick.activeItems[0];
          resolve(activeItem.label);
          quickPick.dispose();
        } else if (currentFilter.trim()) {
          resolve(currentFilter.trim());
          quickPick.dispose();
        } else {
          resolve(undefined);
          quickPick.dispose();
        }
      });

      quickPick.onDidHide(() => {
        resolve(undefined);
        quickPick.dispose();
      });

      quickPick.show();
    });

    return selection;
  } catch (error) {
    vscode.window.showErrorMessage("Failed to load shell history.");
    return undefined;
  }
}

function renderDashboardHtml(
  context: vscode.ExtensionContext,
  webview: vscode.Webview
): string {
  const chartJsUri = webview.asWebviewUri(
    vscode.Uri.joinPath(context.extensionUri, "media", "chart.umd.js")
  );
  const dashboardJsUri = webview.asWebviewUri(
    vscode.Uri.joinPath(context.extensionUri, "media", "dashboard.js")
  );
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(context.extensionUri, "media", "style.css")
  );

  const nonce = getNonce();

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}' ${webview.cspSource};">
    <link href="${styleUri}" rel="stylesheet">
    <title>ProcessLens Dashboard</title>
</head>
<body>
    <div class="header">
        <h1>ProcessLens Dashboard</h1>
        <div class="version-info" title="Extension version">v${context.extension.packageJSON.version}</div>
    </div>

    <div class="filters-section">
        <div class="filters">
            <div class="filter-group">
                <label>Project:</label>
                <div class="multi-select-wrapper">
                    <div class="multi-select-display" id="projectFilterDisplay" title="Filter by workspace/project">All Projects</div>
                    <div class="multi-select-dropdown element-hidden" id="projectFilterDropdown">
                        <div class="multi-select-option" data-value="">
                            <input type="checkbox" id="project-all" checked>
                            <label for="project-all">All Projects</label>
                        </div>
                    </div>
                </div>
            </div>
            <div class="filter-group">
                <label>Command:</label>
                <div class="multi-select-wrapper">
                    <div class="multi-select-display" id="commandFilterDisplay" title="Filter by specific command">All Commands</div>
                    <div class="multi-select-dropdown element-hidden" id="commandFilterDropdown">
                        <div class="multi-select-option" data-value="">
                            <input type="checkbox" id="command-all" checked>
                            <label for="command-all">All Commands</label>
                        </div>
                    </div>
                </div>
            </div>
            <div class="filter-group">
                <label>Success:</label>
                <div class="multi-select-wrapper">
                    <div class="multi-select-display" id="successFilterDisplay" title="Filter by command success or failure">All</div>
                    <div class="multi-select-dropdown element-hidden" id="successFilterDropdown">
                        <div class="multi-select-option" data-value="all">
                            <input type="checkbox" id="success-all" checked>
                            <label for="success-all">All</label>
                        </div>
                        <div class="multi-select-option" data-value="success">
                            <input type="checkbox" id="success-success">
                            <label for="success-success">Success</label>
                        </div>
                        <div class="multi-select-option" data-value="fail">
                            <input type="checkbox" id="success-fail">
                            <label for="success-fail">Failed</label>
                        </div>
                    </div>
                </div>
            </div>
            <div class="filter-group">
                <label>Time Range:</label>
                <div class="time-range-wrapper">
                    <div class="time-range-display" id="timeRangeDisplay" title="Select time period for analysis">Last 7 days</div>
                    <div class="time-range-dropdown element-hidden" id="timeRangeDropdown">
                        <div class="time-range-section">
                            <h4>Quick Ranges</h4>
                            <div class="time-range-option" data-type="relative" data-value="1h">Last Hour</div>
                            <div class="time-range-option" data-type="relative" data-value="24h">Last 24 Hours</div>
                            <div class="time-range-option" data-type="relative" data-value="7d" data-selected="true">Last 7 Days</div>
                            <div class="time-range-option" data-type="relative" data-value="30d">Last 30 Days</div>
                            <div class="time-range-option" data-type="relative" data-value="90d">Last 3 Months</div>
                            <div class="time-range-option" data-type="relative" data-value="1y">Last Year</div>
                            <div class="time-range-option" data-type="relative" data-value="all">All Time</div>
                        </div>
                        <div class="time-range-section">
                            <h4>Custom Range</h4>
                            <div class="custom-range-inputs">
                                <div class="date-input-group">
                                    <label>From:</label>
                                    <input type="date" id="customFromDate" class="custom-date-input">
                                </div>
                                <div class="date-input-group">
                                    <label>To:</label>
                                    <input type="date" id="customToDate" class="custom-date-input">
                                </div>
                                <button id="applyCustomRange" class="apply-custom-btn">Apply Range</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="filter-group">
                <label>Device:</label>
                <div class="multi-select-wrapper">
                    <div class="multi-select-display" id="deviceFilterDisplay" title="Filter by device/hardware configuration">All Devices</div>
                    <div class="multi-select-dropdown element-hidden" id="deviceFilterDropdown">
                        <div class="multi-select-option" data-value="">
                            <input type="checkbox" id="device-all" checked>
                            <label for="device-all">All Devices</label>
                        </div>
                    </div>
                </div>
            </div>
                                        <div class="filter-group">
                                <label>Format:</label>
                                <select id="timeFormatToggle" title="Choose time display format">
                                    <option value="human">Human (2.5s, 1m 30s)</option>
                                    <option value="raw">Raw (2500ms)</option>
                                </select>
                            </div>
                            <div class="filter-group">
                                <label>Trend Period:</label>
                                <select id="trendPeriodSelect" title="Compare recent performance vs previous period. Example: 7 days compares last 7 days to previous 7 days.">
                                    <option value="1">Last 1 day vs previous 1 day</option>
                                    <option value="3">Last 3 days vs previous 3 days</option>
                                    <option value="7" selected>Last 7 days vs previous 7 days</option>
                                    <option value="14">Last 14 days vs previous 14 days</option>
                                    <option value="30">Last 30 days vs previous 30 days</option>
                                </select>
                            </div>
            <div class="filter-group">
                <button id="clearFiltersBtn" class="clear-filters-btn" title="Reset all filters to default values">🔄 Clear Filters</button>
            </div>
        </div>
        
        <div class="action-buttons">
            <div class="primary-actions">
                <div class="export-group">
                    <button id="exportDataBtn" class="export-btn" title="Export timing data as JSON for backup or analysis">📊 Export Data</button>
                    <button id="exportProfileBtn" class="export-btn" title="Export current dashboard configuration as a profile">⚙️ Export Profile</button>
                </div>
                <div class="import-group">
                    <button id="importDataBtn" class="import-btn" title="Import timing data from a JSON file">📥 Import Data</button>
                    <button id="importProfileBtn" class="import-btn" title="Import dashboard configuration from a profile">⚙️ Import Profile</button>
                </div>
                <button id="signinBtn" class="signin-btn" title="Coming soon! Sign in to sync data across devices">🔐 Sign In</button>
                <button id="coffeeBtn" class="coffee-btn" title="Support ProcessLens development - Buy me a coffee! ☕">☕ Buy me a coffee</button>
                <button id="cancelTaskBtn" class="cancel-task-btn element-hidden" title="Cancel the currently running command">⏹️ Cancel Task</button>
            </div>
            <div class="danger-actions">
                <button id="clearBtn" class="clear-btn" title="Permanently delete all ProcessLens data - this cannot be undone!">⚠️ Clear All Data</button>
            </div>
        </div>
    </div>

    <!-- Global Stats Section - Right below buttons -->
            <div class="global-stats">
            <div class="stat-card" title="Total number of commands executed and timed by ProcessLens (filtered)">
                <div class="stat-value" id="totalRuns">-</div>
                <div class="stat-label">Total Runs</div>
            </div>
            <div class="stat-card" title="Number of unique commands being monitored (filtered)">
                <div class="stat-value" id="commandCount">-</div>
                <div class="stat-label">Commands Tracked</div>
            </div>
            <div class="stat-card" title="Percentage of commands that completed successfully (filtered)">
                <div class="stat-value" id="overallSuccess">-</div>
                <div class="stat-label">Success Rate</div>
            </div>
            <div class="stat-card" title="Number of different projects/workspaces with recent activity (filtered)">
                <div class="stat-value" id="activeProjects">-</div>
                <div class="stat-label">Active Projects</div>
            </div>
            <div class="stat-card" title="Number of different devices/machines that have executed commands (filtered)">
                <div class="stat-value" id="activeDevices">-</div>
                <div class="stat-label">Devices Tracked</div>
            </div>
        </div>

    <div id="content">
        <div class="loading">Loading...</div>
        <div class="empty-state element-hidden">
            <div class="welcome-message">
                <h2>👋 Welcome to ProcessLens!</h2>
                <p>Start tracking your command execution times to identify performance trends and bottlenecks.</p>
                <div class="getting-started">
                    <h3>Getting Started:</h3>
                    <ol>
                        <li>Press <kbd>Ctrl+Shift+P</kbd> (or <kbd>Cmd+Shift+P</kbd> on Mac)</li>
                        <li>Type "ProcessLens: Run Command"</li>
                        <li>Select and run any command to start tracking</li>
                    </ol>
                    <p class="tip">💡 <strong>Tip:</strong> You can also browse your shell history or run package.json scripts!</p>
                </div>
            </div>
        </div>
        <div class="cards element-hidden">
            <!-- Chart Visualization - Full Width with Tabs -->
            <div class="card chart-card full-width">
                <div class="chart-tabs">
                    <button class="chart-tab active" data-tab="timeline" title="Timeline view of recent command executions">📈 Recent Durations</button>
                    <button class="chart-tab" data-tab="heatmap" title="GitHub-style heatmap showing command activity over time">🔥 Activity Heatmap</button>
                    <button class="chart-tab" data-tab="performance" title="Performance comparison across commands">⚡ Performance Matrix</button>
                </div>
                
                <!-- Timeline Chart (default) -->
                <div id="timelineChart" class="chart-view active">
                    <div class="chart-container">
                        <canvas id="durationChart"></canvas>
                        <div id="chart-legend" class="chart-legend element-hidden"></div>
                    </div>
                </div>
                
                <!-- Heatmap Chart -->
                <div id="heatmapChart" class="chart-view element-hidden">
                    <div class="heatmap-container">
                        <div class="heatmap-header">
                            <div class="heatmap-title-row">
                                <h3>🔥 Activity Heatmap</h3>
                                <div id="heatmapYearNav" class="heatmap-year-nav element-hidden">
                                    <button id="heatmapPrevYear" class="year-nav-btn">‹</button>
                                    <select id="heatmapYearSelect" class="year-select">
                                        <option value="2024">2024</option>
                                    </select>
                                    <button id="heatmapNextYear" class="year-nav-btn">›</button>
                                </div>
                            </div>
                            <p>GitHub-style visualization of your command activity over the past year. <strong>Each square = 1 day</strong>. Darker colors = more commands executed.</p>
                            <div class="heatmap-legend">
                                <span>Less</span>
                                <div class="heatmap-scale">
                                    <div class="heatmap-cell level-0"></div>
                                    <div class="heatmap-cell level-1"></div>
                                    <div class="heatmap-cell level-2"></div>
                                    <div class="heatmap-cell level-3"></div>
                                    <div class="heatmap-cell level-4"></div>
                                </div>
                                <span>More</span>
                            </div>
                        </div>
                        <div class="heatmap-wrapper">
                            <div class="heatmap-y-labels">
                                <div>Mon</div>
                                <div>Tue</div>
                                <div>Wed</div>
                                <div>Thu</div>
                                <div>Fri</div>
                                <div>Sat</div>
                                <div>Sun</div>
                            </div>
                            <div class="heatmap-main">
                                <div id="heatmapXLabels" class="heatmap-x-labels"></div>
                                <div id="heatmapGrid" class="heatmap-grid"></div>
                                <div class="heatmap-bottom">
                                    <div id="heatmapMonths" class="heatmap-month-labels"></div>
                                    <div id="heatmapYear" class="heatmap-year-label"></div>
                                </div>
                            </div>
                        </div>
                        <div id="heatmapTooltip" class="heatmap-tooltip element-hidden"></div>
                    </div>
                </div>
                
                <!-- Performance Matrix Chart -->
                <div id="performanceChart" class="chart-view element-hidden">
                    <div class="performance-container">
                        <h3>Performance Comparison Matrix</h3>
                        <div id="performanceMatrix" class="performance-matrix"></div>
                    </div>
                </div>
            </div>
            
            <!-- Second Row: Command Summary (Large) and Recent Runs (Small) -->
            <div class="card command-summary-card">
                <div class="card-header">
                    <h2 title="Statistics for all commands you've run, sorted by frequency">Command Summary</h2>
                    <div class="column-selector">
                        <button class="column-menu-btn" title="Configure visible columns">⋯</button>
                        <div class="column-menu element-hidden">
                            <label title="Command name (always visible)"><input type="checkbox" data-column="command" checked disabled> Command</label>
                            <label title="Number of times this command has been executed"><input type="checkbox" data-column="runs" checked> Runs</label>
                            <label title="Average execution time across all runs"><input type="checkbox" data-column="avgMs" checked> Average</label>
                            <label title="Median execution time (50th percentile) - more reliable than average"><input type="checkbox" data-column="medianMs"> Median</label>
                            <label title="95th percentile execution time - shows worst-case performance"><input type="checkbox" data-column="p95Ms"> P95</label>
                            <label title="Fastest execution time recorded"><input type="checkbox" data-column="minMs"> Min</label>
                            <label title="Slowest execution time recorded"><input type="checkbox" data-column="maxMs"> Max</label>
                            <label title="Percentage of successful runs (exit code 0)"><input type="checkbox" data-column="successRate" checked> Success</label>
                            <label title="Performance trend comparison: recent period vs previous period (↗ slower, ↘ faster, → stable). Period configurable in filters."><input type="checkbox" data-column="trend"> Trend</label>
                            <label title="Mini chart showing recent execution time trends (requires 2+ runs of the same command)"><input type="checkbox" data-column="sparkline"> Sparkline</label>
                            <label title="Total time consumed by this command (duration × frequency) - identifies biggest time sinks"><input type="checkbox" data-column="totalTime" checked> Total Time</label>
                            <label title="Impact score (0-100) relative to the most time-consuming command - helps prioritize optimization efforts"><input type="checkbox" data-column="impact" checked> Impact</label>
                            <label title="Average time per day this command consumes - useful for daily workflow analysis"><input type="checkbox" data-column="timePerDay"> Time/Day</label>
                            <label title="Potential time savings if this command were optimized - based on smart analysis"><input type="checkbox" data-column="projectedSavings"> Savings</label>
                            <label title="Optimization priority based on impact, trends, and variability analysis"><input type="checkbox" data-column="optimizationPotential"> Priority</label>
                        </div>
                    </div>
                </div>
                <div class="table-container">
                    <table id="commandTable">
                        <thead>
                            <tr>
                                <th data-sort="command" data-column="command" class="sortable" title="Click to sort by command name">Command</th>
                                <th data-sort="runs" data-column="runs" class="sortable" title="Click to sort by number of times run">Runs</th>
                                <th data-sort="avgMs" data-column="avgMs" class="sortable" title="Click to sort by average execution time">Average</th>
                                <th data-sort="medianMs" data-column="medianMs" class="sortable column-hidden" title="Click to sort by median execution time">Median</th>
                                <th data-sort="p95Ms" data-column="p95Ms" class="sortable column-hidden" title="Click to sort by 95th percentile execution time">P95</th>
                                <th data-sort="minMs" data-column="minMs" class="sortable column-hidden" title="Click to sort by minimum execution time">Min</th>
                                <th data-sort="maxMs" data-column="maxMs" class="sortable column-hidden" title="Click to sort by maximum execution time">Max</th>
                                <th data-sort="successRate" data-column="successRate" class="sortable" title="Click to sort by success rate">Success</th>
                                <th data-column="trend" class="sortable column-hidden" title="Performance trend for selected period">Trend</th>
                                <th data-column="sparkline" class="column-hidden" title="Recent duration trend visualization">Sparkline</th>
                                <th data-sort="totalTimeMs" data-column="totalTime" class="sortable column-visible" title="Click to sort by total time consumed">Total Time</th>
                                <th data-sort="impactScore" data-column="impact" class="sortable column-visible" title="Click to sort by impact score">Impact</th>
                                <th data-sort="timePerDay" data-column="timePerDay" class="sortable column-hidden" title="Click to sort by time per day">Time/Day</th>
                                <th data-sort="projectedSavingsMs" data-column="projectedSavings" class="sortable column-hidden" title="Click to sort by projected savings">Savings</th>
                                <th data-sort="optimizationPotential" data-column="optimizationPotential" class="sortable column-hidden" title="Click to sort by optimization priority">Priority</th>
                            </tr>
                        </thead>
                        <tbody id="commandTableBody">
                        </tbody>
                    </table>
                </div>
            </div>
            
            <div class="card recent-runs-card">
                <h2 title="Your most recent command executions with trend indicators">Recent Runs <span class="subtitle">(Last 10)</span></h2>
                <div id="recentRuns" class="recent-runs">
                </div>
            </div>
        </div>
    </div>

    <script nonce="${nonce}" src="${chartJsUri}"></script>
    <script nonce="${nonce}" src="${dashboardJsUri}"></script>
</body>
</html>`;
}

function getNonce() {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

export function activate(context: vscode.ExtensionContext) {
  console.log('ProcessLens extension is being activated...');
  
  try {
    // Initialize storage
    eventStore = new JsonlEventStore(context);
    console.log('EventStore initialized successfully');

  // Create status bar item
  const statusBarEnabled = vscode.workspace
    .getConfiguration()
    .get<boolean>("processlens.statusBar.enabled", true);
  if (statusBarEnabled) {
    const priority = vscode.workspace
      .getConfiguration()
      .get<number>("processlens.statusBar.priority", -10);
    statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      priority
    );
    statusBarItem.command = "processlens.openDashboard";
    updateStatusBar();
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);
  }

  // Set up global task event listeners for dashboard refresh
  const taskEndListener = vscode.tasks.onDidEndTaskProcess(async (e) => {
    // Add small delay to ensure any ongoing save operations complete first
    // This handles cases where tasks are run outside the play button (e.g., via Command Palette)
    setTimeout(() => {
      refreshAllDashboards();
    }, 100);
  });

  context.subscriptions.push(taskEndListener);

  console.log('Registering commands...');
  const runCommand = vscode.commands.registerCommand(
    "processlens.runCommand",
    async () => {
      const folder = await pickWorkspaceFolder();

      // Get recent commands and package.json scripts
      const currentProjectInfo = folder ? await getProjectInfo(folder) : null;
      const recentCommands = await eventStore.getRecentCommands(
        currentProjectInfo?.projectId,
        10
      );
      const packageScripts = folder ? await readPackageJsonScripts(folder) : {};
      const scriptNames = Object.keys(packageScripts);

      // Build quick pick items
      const items: vscode.QuickPickItem[] = [];

      // Add shell history option at the very top
      items.push({
        label: "📜 Browse Shell History",
        description: "Search through your terminal history",
        detail: "Access commands from bash, zsh, or fish history",
      });

      // Add recent commands
      if (recentCommands.length > 0) {
        items.push({
          label: "Recently Used Commands",
          kind: vscode.QuickPickItemKind.Separator,
        });
        recentCommands.forEach((cmd) => {
          items.push({
            label: cmd,
            description: "Recent command",
            detail: `Previously run in ${
              currentProjectInfo?.projectName || "this workspace"
            }`,
          });
        });
      }

      // Add package.json scripts
      if (scriptNames.length > 0) {
        items.push({
          label: "Package.json Scripts",
          kind: vscode.QuickPickItemKind.Separator,
        });
        scriptNames.forEach((script) => {
          items.push({
            label: `npm run ${script}`,
            description: "Package script",
            detail: packageScripts[script],
          });
        });
      }

      let input: string | undefined;

      if (items.length > 0) {
        // Show QuickPick with existing commands, but allow typing new ones
        const quickPick = vscode.window.createQuickPick();
        quickPick.items = items;
        quickPick.placeholder = "Select a command or type a new one to run";
        quickPick.matchOnDescription = true;
        quickPick.matchOnDetail = true;

        const selection = await new Promise<string | undefined>(
          (resolve, reject) => {
            let isResolved = false;
            let isInShellHistory = false;

            quickPick.onDidChangeValue((value) => {
              // If user is typing something that doesn't match any items,
              // we'll use their input as the command
              if (
                value &&
                !items.some(
                  (item) =>
                    item.kind !== vscode.QuickPickItemKind.Separator &&
                    item.label.toLowerCase().includes(value.toLowerCase())
                )
              ) {
                // Show a dynamic item for their custom input
                quickPick.items = [
                  ...items,
                  {
                    label: value,
                    description: "Run this custom command",
                    detail: "Press Enter to execute",
                  },
                ];
              } else if (!value) {
                // Reset to original items when input is cleared
                quickPick.items = items;
              }
            });

            quickPick.onDidAccept(async () => {
              const selected = quickPick.selectedItems[0];

              if (selected?.label === "📜 Browse Shell History") {
                isInShellHistory = true; // Flag that we're in shell history mode
                quickPick.hide(); // Hide the main picker while shell history is shown
                try {
                  const historyCommand = await showShellHistoryPicker();
                  if (!isResolved) {
                    isResolved = true;
                    resolve(historyCommand);
                  }
                  quickPick.dispose(); // Dispose AFTER we get the result
                  return; // Important: exit the function here
                } catch (error) {
                  quickPick.dispose(); // Dispose on error too
                  reject(error);
                  return;
                }
              } else if (
                selected &&
                selected.kind !== vscode.QuickPickItemKind.Separator
              ) {
                if (!isResolved) {
                  isResolved = true;
                  resolve(selected.label);
                }
                quickPick.dispose();
                return;
              } else if (quickPick.value.trim()) {
                // User typed something and pressed Enter
                if (!isResolved) {
                  isResolved = true;
                  resolve(quickPick.value.trim());
                }
                quickPick.dispose();
                return;
              }
            });

            quickPick.onDidHide(() => {
              if (!isResolved && !isInShellHistory) {
                isResolved = true;
                resolve(undefined);
              }
              if (!isInShellHistory) {
                quickPick.dispose();
              }
            });

            quickPick.show();
          }
        );

        input = selection;
      } else {
        // No recent commands or scripts, go straight to input box
        input = await vscode.window.showInputBox({
          prompt: "Enter a shell command to run",
          placeHolder: "e.g., echo hello && sleep 1",
        });
      }

      if (!input) {
        return;
      }

      const result = await runAsTaskAndTime(
        input,
        { type: "processlens-ad-hoc", cmd: input },
        folder?.uri
      );

      // Get device and project info
      const deviceId = await getOrCreateDeviceId(context);
      const hardwareInfo = getHardwareInfo();
      const hardwareHash = computeHardwareHash(hardwareInfo);
      const finalProjectInfo = folder
        ? await getProjectInfo(folder)
        : {
            projectId: "no-project",
            projectName: "No Project",
            globalProjectId: "no-project",
            localProjectId: "no-project",
            projectPath: process.cwd(),
            repositoryName: undefined,
            gitOriginUrl: undefined,
          };

      const evt: EventRecord = {
        tsStart: result.tsStart,
        tsEnd: result.tsEnd,
        durationMs: result.durationMs,
        exitCode: result.exitCode,
        command: input,
        cwd: folder?.uri.fsPath || process.cwd(),
        projectId: finalProjectInfo.projectId,
        projectName: finalProjectInfo.projectName,
        // Enhanced project identification for global database
        globalProjectId: finalProjectInfo.globalProjectId,
        localProjectId: finalProjectInfo.localProjectId,
        repositoryName: finalProjectInfo.repositoryName,
        gitOriginUrl: finalProjectInfo.gitOriginUrl,
        deviceId,
        hardwareHash,
        device: hardwareInfo,
      };

      await eventStore.append(evt);
      updateStatusBar({
        success: result.success,
        durationMs: result.durationMs,
      });

      // Refresh all open dashboards
      refreshAllDashboards();

      // Show a brief notification that auto-dismisses after 2.5 seconds
      const message = `Command ${
        result.success ? "completed" : "failed"
      } in ${formatDuration(result.durationMs)}`;

      // Create a promise that resolves after timeout to auto-dismiss
      const timeoutPromise = new Promise<string | undefined>((resolve) => {
        setTimeout(() => resolve(undefined), 2500); // Auto-dismiss after 2.5 seconds
      });

      // Show notification with auto-dismiss - it will close automatically
      Promise.race([
        vscode.window.showInformationMessage(message, "Dismiss"),
        timeoutPromise,
      ]).then(() => {
        // Message either dismissed by user or auto-dismissed
      });
    }
  );

  const openDashboard = vscode.commands.registerCommand(
    "processlens.openDashboard",
    async () => {
      const panel = vscode.window.createWebviewPanel(
        "processlens.dashboard",
        "ProcessLens Dashboard",
        vscode.ViewColumn.Active,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [
            vscode.Uri.joinPath(context.extensionUri, "media"),
          ],
        }
      );

      // Track panel for auto-refresh
      dashboardPanels.push(panel);
      panel.onDidDispose(() => {
        const index = dashboardPanels.indexOf(panel);
        if (index > -1) {
          dashboardPanels.splice(index, 1);
        }
      });

      panel.webview.html = renderDashboardHtml(context, panel.webview);

      // Handle messages from webview
      panel.webview.onDidReceiveMessage(async (message) => {
        switch (message.type) {
          case "LOAD":
            const filters: Filters = message.filters || {};
            const trendPeriodDays = message.trendPeriodDays || 7;
            const runs = await eventStore.recent(filters, 50);
            const perCommand = await eventStore.aggregateByCommand(
              filters,
              trendPeriodDays
            );

            // Get unique values for filters with smart sorting
            const allRuns = await eventStore.recent({}, 1000);
            const projectStats = await eventStore.getProjectStats();
            const projects = projectStats.map((p) => ({
              value: p.projectId,
              label: p.projectName,
            }));

            const commands = [...new Set(allRuns.map((r) => r.command))].map(
              (cmd) => ({ value: cmd, label: cmd })
            );
            const devices = [
              ...new Set(allRuns.map((r) => `${r.deviceId}|${r.hardwareHash}`)),
            ].map((key) => {
              const [deviceId, hardwareHash] = key.split("|");
              const sampleRun = allRuns.find(
                (r) =>
                  r.deviceId === deviceId && r.hardwareHash === hardwareHash
              );
              return {
                value: key,
                label: sampleRun?.device
                  ? getHardwareLabel(sampleRun.device)
                  : `Device ${deviceId.slice(0, 8)}`,
              };
            });

            panel.webview.postMessage({
              type: "DATA",
              runs,
              perCommand,
              projects,
              commands,
              devices,
            });
            break;

          case "EXPORT_DATA":
            const exportFilters: Filters = message.filters || {};
            const exportRuns = await eventStore.recent(exportFilters, 10000);

            const exportData = {
              version: CURRENT_DATA_VERSION,
              exported: new Date().toISOString(),
              exportedBy: "ProcessLens VS Code Extension",
              filters: exportFilters,
              totalRecords: exportRuns.length,
              data: exportRuns,
            };

            const saveDataUri = await vscode.window.showSaveDialog({
              defaultUri: vscode.Uri.joinPath(
                vscode.workspace.workspaceFolders?.[0]?.uri ||
                  vscode.Uri.file(require("os").homedir()),
                `processlens-data-${
                  new Date().toISOString().split("T")[0]
                }.json`
              ),
              filters: { "JSON files": ["json"] },
            });

            if (saveDataUri) {
              await vscode.workspace.fs.writeFile(
                saveDataUri,
                Buffer.from(JSON.stringify(exportData, null, 2), "utf8")
              );
              vscode.window.showInformationMessage(
                `Exported ${exportRuns.length} records to ${saveDataUri.fsPath}`
              );
            }
            break;

          case "EXPORT_PROFILE":
            const profile = message.profile;

            const saveProfileUri = await vscode.window.showSaveDialog({
              defaultUri: vscode.Uri.joinPath(
                vscode.workspace.workspaceFolders?.[0]?.uri ||
                  vscode.Uri.file(require("os").homedir()),
                `${profile.name
                  .replace(/[^a-zA-Z0-9-]/g, "-")
                  .toLowerCase()}.json`
              ),
              filters: { "JSON files": ["json"] },
            });

            if (saveProfileUri) {
              await vscode.workspace.fs.writeFile(
                saveProfileUri,
                Buffer.from(JSON.stringify(profile, null, 2), "utf8")
              );
              vscode.window.showInformationMessage(
                `Profile exported to ${saveProfileUri.fsPath}`
              );
            }
            break;

          case "IMPORT_DATA":
            const openDataUri = await vscode.window.showOpenDialog({
              canSelectFiles: true,
              canSelectFolders: false,
              canSelectMany: false,
              filters: { "JSON files": ["json"] },
            });

            if (openDataUri && openDataUri[0]) {
              try {
                const dataContent = await vscode.workspace.fs.readFile(
                  openDataUri[0]
                );
                const importedData = JSON.parse(dataContent.toString());

                // Validate version
                const versionCheck = validateDataVersion(importedData.version);
                if (!versionCheck.valid) {
                  vscode.window.showErrorMessage(
                    `Cannot import data: ${versionCheck.message}`
                  );
                  break;
                }

                if (importedData.data && Array.isArray(importedData.data)) {
                  for (const record of importedData.data) {
                    await eventStore.append(record);
                  }

                  vscode.window.showInformationMessage(
                    `Successfully imported ${importedData.data.length} records (version ${importedData.version})`
                  );

                  panel.webview.postMessage({ type: "UPDATED" });
                } else {
                  vscode.window.showErrorMessage(
                    "Invalid data format - missing or invalid data array"
                  );
                }
              } catch (error) {
                if (error instanceof SyntaxError) {
                  vscode.window.showErrorMessage("Invalid JSON file format");
                } else {
                  vscode.window.showErrorMessage(`Import failed: ${error}`);
                }
              }
            }
            break;

          case "IMPORT_PROFILE":
            const openProfileUri = await vscode.window.showOpenDialog({
              canSelectFiles: true,
              canSelectFolders: false,
              canSelectMany: false,
              filters: { "JSON files": ["json"] },
            });

            if (openProfileUri && openProfileUri[0]) {
              try {
                const profileContent = await vscode.workspace.fs.readFile(
                  openProfileUri[0]
                );
                const importedProfile = JSON.parse(profileContent.toString());

                // Validate version
                const versionCheck = validateProfileVersion(
                  importedProfile.version
                );
                if (!versionCheck.valid) {
                  vscode.window.showErrorMessage(
                    `Cannot import profile: ${versionCheck.message}`
                  );
                  break;
                }

                if (importedProfile.config) {
                  vscode.window.showInformationMessage(
                    `Successfully imported profile "${importedProfile.name}" (version ${importedProfile.version})`
                  );

                  panel.webview.postMessage({
                    type: "PROFILE_IMPORTED",
                    profile: importedProfile,
                  });
                } else {
                  vscode.window.showErrorMessage(
                    "Invalid profile format - missing config section"
                  );
                }
              } catch (error) {
                if (error instanceof SyntaxError) {
                  vscode.window.showErrorMessage("Invalid JSON file format");
                } else {
                  vscode.window.showErrorMessage(
                    `Profile import failed: ${error}`
                  );
                }
              }
            }
            break;

          case "CONFIRM_CLEAR_DATA":
            console.log("Received CONFIRM_CLEAR_DATA message from webview");
            const confirmed = await vscode.window.showWarningMessage(
              "⚠️ WARNING: This will permanently delete ALL ProcessLens data including timing history, device info, and project mappings.\n\nThis action cannot be undone.",
              { modal: true },
              "Clear All Data"
            );

            if (confirmed === "Clear All Data") {
              console.log("User confirmed data clearing via VS Code dialog");
              // Proceed with clearing
              try {
                console.log("Attempting to clear event store...");
                await eventStore.clear();
                console.log("Event store cleared successfully");

                // Also clear device ID to fully reset
                console.log("Clearing device ID from global state...");
                await context.globalState.update(
                  "processlens.deviceId",
                  undefined
                );
                console.log("Device ID cleared successfully");

                updateStatusBar(); // Reset status bar
                console.log("Sending DATA_CLEARED message to webview");
                panel.webview.postMessage({ type: "DATA_CLEARED" });
                vscode.window.showInformationMessage(
                  "All ProcessLens data has been cleared."
                );
              } catch (error) {
                console.error("Error clearing data:", error);
                vscode.window.showErrorMessage(
                  "Failed to clear data: " + error
                );
              }
            } else {
              console.log("User cancelled data clearing via VS Code dialog");
            }
            break;

          case "RUN_COMMAND":
            if (message.command) {
              // Notify dashboard that command is starting
              panel.webview.postMessage({
                type: "COMMAND_STARTED",
                command: message.command,
              });

              // Execute the command directly using our existing functionality
              const folder = vscode.workspace.workspaceFolders?.[0];
              if (folder) {
                const taskDefinition: vscode.TaskDefinition = {
                  type: "shell",
                };
                const result = await runAsTaskAndTime(
                  message.command,
                  taskDefinition,
                  folder.uri
                );

                // Don't save cancelled tasks to storage
                if (result.cancelled) {
                  console.log("Task was cancelled, not saving to storage");

                  // Notify dashboard that command was cancelled
                  panel.webview.postMessage({
                    type: "COMMAND_COMPLETED",
                    command: message.command,
                    cancelled: true,
                  });

                  // Update status bar back to idle
                  updateStatusBar();
                  return;
                }

                // Save the event to storage
                const deviceId = await getOrCreateDeviceId(context);
                const hardwareInfo = await getHardwareInfo();
                const hardwareHash = computeHardwareHash(hardwareInfo);
                const projectInfo = await getProjectInfo(folder);

                const eventRecord = {
                  tsStart: result.tsStart,
                  tsEnd: result.tsEnd,
                  durationMs: result.durationMs,
                  exitCode: result.exitCode || 0,
                  command: message.command,
                  cwd: folder.uri.fsPath,
                  projectId: projectInfo?.projectId || "",
                  projectName: projectInfo?.projectName || "",
                  // Enhanced project identification for global database
                  globalProjectId: projectInfo?.globalProjectId,
                  localProjectId: projectInfo?.localProjectId,
                  repositoryName: projectInfo?.repositoryName,
                  gitOriginUrl: projectInfo?.gitOriginUrl,
                  deviceId,
                  hardwareHash,
                  device: hardwareInfo,
                };

                await eventStore.append(eventRecord);

                // Update status bar with result
                updateStatusBar({
                  success: result.success,
                  durationMs: result.durationMs,
                });

                // Notify dashboard that command is completed
                panel.webview.postMessage({
                  type: "COMMAND_COMPLETED",
                  command: message.command,
                  success: result.success,
                  durationMs: result.durationMs,
                });

                // Refresh dashboards AFTER event is saved
                refreshAllDashboards();

                // Show completion notification
                const duration = formatDuration(result.durationMs);
                const status = result.success ? "✅" : "❌";
                const notificationPromise =
                  vscode.window.showInformationMessage(
                    `${status} Command completed in ${duration}`
                  );

                // Auto-dismiss after 2.5 seconds
                Promise.race([
                  notificationPromise,
                  new Promise((resolve) => setTimeout(resolve, 2500)),
                ]);
              }
            }
            break;

          case "CANCEL_TASK":
            if (currentTaskExecution) {
              currentTaskExecution.terminate();
              currentTaskExecution = undefined;

              // Notify all dashboards that task was cancelled
              dashboardPanels.forEach((panel) => {
                if (panel.webview) {
                  panel.webview.postMessage({
                    type: "COMMAND_COMPLETED",
                    cancelled: true,
                  });
                }
              });

              // Update status bar
              updateStatusBar();

              vscode.window.showInformationMessage("Task cancelled");
            }
            break;

          case "CONFIRM_DELETE_RUN":
            if (message.runId) {
              const result = await vscode.window.showWarningMessage(
                `Are you sure you want to delete this run? This action cannot be undone.`,
                { modal: true },
                "Delete Run"
              );

              if (result === "Delete Run") {
                console.log("User confirmed run deletion");

                // Parse the run ID to extract timestamp and command
                const [tsStart, ...commandParts] = message.runId.split("-");
                const command = commandParts.join("-");

                // Delete the run from storage
                await eventStore.deleteRun(parseInt(tsStart), command);

                // Notify dashboard that run was deleted
                panel.webview.postMessage({
                  type: "RUN_DELETED",
                });

                vscode.window.showInformationMessage(
                  "Run deleted successfully"
                );
              } else {
                console.log("User cancelled run deletion");
              }
            }
            break;

          case "OPEN_COFFEE_LINK":
            vscode.env.openExternal(
              vscode.Uri.parse("https://buymeacoffee.com/processlens")
            );
            break;
        }
      });
    }
  );

  // Generate dummy data command (for testing)
  const generateDummyData = vscode.commands.registerCommand(
    "processlens.generateDummyData",
    async () => {
      const options = [
        {
          label: "Small Dataset",
          description: "100 records over 7 days",
          value: { records: 100, days: 7 },
        },
        {
          label: "Medium Dataset",
          description: "500 records over 30 days",
          value: { records: 500, days: 30 },
        },
        {
          label: "Large Dataset",
          description: "2000 records over 90 days",
          value: { records: 2000, days: 90 },
        },
        {
          label: "Performance Test",
          description: "5000 records over 180 days",
          value: { records: 5000, days: 180 },
        },
      ];

      const selected = await vscode.window.showQuickPick(options, {
        placeHolder: "Select dummy data size for testing",
      });

      if (!selected) {
        return;
      }

      const generator = new DummyDataGenerator();

      try {
        vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "Generating dummy data...",
            cancellable: false,
          },
          async (progress) => {
            progress.report({
              increment: 0,
              message: "Creating realistic test data...",
            });

            const dummyRecords = generator.generateDummyData(
              selected.value.records,
              selected.value.days
            );

            progress.report({ increment: 50, message: "Saving to storage..." });

            // Save all records to storage
            for (let i = 0; i < dummyRecords.length; i++) {
              await eventStore.append(dummyRecords[i]);

              // Update progress every 100 records
              if (i % 100 === 0) {
                progress.report({
                  increment: (50 / dummyRecords.length) * 100,
                  message: `Saved ${i + 1}/${dummyRecords.length} records...`,
                });
              }
            }

            progress.report({ increment: 100, message: "Complete!" });
          }
        );

        vscode.window.showInformationMessage(
          `✅ Generated ${selected.value.records} dummy records over ${selected.value.days} days. Open the dashboard to see the data!`
        );

        // Refresh any open dashboards
        refreshAllDashboards();
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to generate dummy data: ${error}`
        );
      }
    }
  );

  context.subscriptions.push(runCommand, openDashboard, generateDummyData);
  
  console.log('ProcessLens extension activated successfully!');
  } catch (error) {
    console.error('Failed to activate ProcessLens extension:', error);
    vscode.window.showErrorMessage(`ProcessLens failed to activate: ${error}`);
  }
}

export function deactivate() {
  if (statusBarItem) {
    statusBarItem.dispose();
  }
}
