// TypeScript version of ProcessLens Dashboard
// Chart.js is loaded from the bundled chart.umd.js file

// Make this file a module

// VS Code API types
interface VsCodeApi {
  postMessage(message: any): void;
  setState(state: any): void;
  getState(): any;
}

// Chart.js types (basic interface for the bundled version)
declare var Chart: any;

// Global VS Code API
declare function acquireVsCodeApi(): VsCodeApi;

// Type definitions for our data structures
interface EventRecord {
  id: string;
  tsEnd: number;
  tsStart: number;
  command: string;
  durationMs: number;
  success: boolean;
  projectId: string;
  projectName: string;
  globalProjectId: string;
  localProjectId: string;
  projectPath: string;
  gitOriginUrl?: string;
  repositoryName?: string;
  deviceId: string;
  deviceInstance: string;
  hardwareHash: string;
  osType: string;
  osVersion: string;
  cpuModel: string;
  totalMemoryGB: number;
  nodeVersion: string;
}

interface CommandSummary {
  command: string;
  runs: number;
  avgMs: number;
  medianMs: number;
  p95Ms: number;
  minMs: number;
  maxMs: number;
  successRate: number;
  totalTimeMs: number;
  impactScore: number;
  timePerDayMs: number;
  projectedSavingsMs: number;
  optimizationPotential: number;
  trend: string;
  sparkline: number[];
}

interface Filters {
  projectId: string | string[] | undefined;
  command: string | string[] | undefined;
  success: string | string[] | undefined;
  window: string;
  customFrom?: string;
  customTo?: string;
  deviceInstance:
    | string
    | null
    | ({ deviceId: any; hardwareHash: any } | null)[]
    | undefined;
}

interface LastData {
  runs: EventRecord[];
  perCommand: CommandSummary[];
  projects: string[];
  commands: string[];
  devices: string[];
}

interface ColumnVisibility {
  command: boolean;
  runs: boolean;
  avgMs: boolean;
  medianMs: boolean;
  p95Ms: boolean;
  minMs: boolean;
  maxMs: boolean;
  successRate: boolean;
  trend: boolean;
  sparkline: boolean;
  totalTime: boolean;
  impact: boolean;
  timePerDay: boolean;
  projectedSavings: boolean;
  optimizationPotential: boolean;
}

interface CommandTableSort {
  column: string;
  direction: "asc" | "desc";
}

// Extend Window interface for global functions
interface WindowExtensions {
  sortCommandTable: (column: string) => void;
  nextCommandPage: () => void;
  prevCommandPage: () => void;
  runCommand: (command: string) => void;
  filterByCommand: (command: string) => void;
  filterByFailed: (command: string) => void;
  hasMultiSelectClickHandler?: boolean;
}

interface HTMLElementExtensions {
  commandData?: CommandSummary;
}

interface DocumentExtensions {
  hasMultiSelectClickHandler?: boolean;
}

// Global interface augmentation for browser environment
interface Window extends WindowExtensions {}
interface HTMLElement extends HTMLElementExtensions {}
interface Document extends DocumentExtensions {}

(function (): void {
  const vscode: VsCodeApi = acquireVsCodeApi();
  let currentFilters: Filters = {
    projectId: "",
    command: "",
    success: "all",
    window: "all",
    deviceInstance: null,
  };
  let chart: any = null;
  let isLoadingData: boolean = false; // Flag to prevent double loading
  let isCommandRunning: boolean = false; // Flag to track if any command is running
  let runningTaskExecution: any = null; // Store current running task execution for cancellation

  // Global data store for charts and components
  let lastData: LastData = {
    runs: [],
    perCommand: [],
    projects: [],
    commands: [],
    devices: [],
  };
  let timeFormat: "human" | "raw" = "human"; // "human" or "raw"
  let commandTableSort: CommandTableSort = {
    column: "runs",
    direction: "desc",
  };
  let commandTablePage: number = 0;
  const COMMANDS_PER_PAGE: number = 10;
  let currentCommandData: CommandSummary[] = [];
  let currentCommandFilter: string | null = null;
  let currentFailedFilter: boolean = false;
  let trendPeriodDays: number = 7; // Default 7 days

  // Heatmap global variables
  let selectedHeatmapDay: string | null = null;
  let previousFiltersState: Partial<Filters> | null = null;
  let currentHeatmapYear: number = new Date().getFullYear();

  // Column visibility state - showing most important columns by default
  let visibleColumns: ColumnVisibility = {
    command: true,
    runs: true,
    avgMs: true,
    medianMs: false,
    p95Ms: false,
    minMs: false,
    maxMs: false,
    successRate: true,
    trend: false,
    sparkline: false,
    totalTime: true, // IMPORTANT: Shows biggest time sinks
    impact: true, // IMPORTANT: Visual impact score
    timePerDay: false, // Less critical for most users
    projectedSavings: false, // Performance predictions
    optimizationPotential: false, // Optimization priority
  };

  // Time formatting functions
  function formatDuration(
    ms: number,
    format: "human" | "raw" = timeFormat
  ): string {
    if (format === "raw") {
      return `${ms}ms`;
    }

    // Human readable format
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

  // Initialize
  document.addEventListener("DOMContentLoaded", function () {
    setupEventListeners();

    // Debug: Check if global functions are available
    console.log("DOM loaded - checking global functions:", {
      sortCommandTable: typeof window.sortCommandTable,
      nextCommandPage: typeof window.nextCommandPage,
      prevCommandPage: typeof window.prevCommandPage,
    });
  });

  function setupEventListeners() {
    // Set up custom multi-select dropdowns
    setupMultiSelectDropdown("project", "All Projects");
    setupMultiSelectDropdown("command", "All Commands");
    setupMultiSelectDropdown("success", "All");
    setupMultiSelectDropdown("device", "All Devices");

    // Set up enhanced time range dropdown
    setupTimeRangeDropdown();

    // Setup custom tooltips for device icons
    setupDeviceTooltips();

    // Setup chart tabs
    setupChartTabs();

    // Setup heatmap year navigation
    setupHeatmapYearNavigation();

    // Time range filter is handled by setupTimeRangeDropdown()
    // No need for additional event listener here

    // Time format toggle
    const timeFormatToggle = document.getElementById(
      "timeFormatToggle"
    ) as HTMLSelectElement;
    if (timeFormatToggle) {
      timeFormatToggle.addEventListener("change", function () {
        timeFormat = this.value as "human" | "raw";
        saveCurrentSettings(); // Save settings when changed
        // Re-render current data with new format
        const lastData = vscode.getState();
        if (lastData && lastData.runs) {
          renderData(
            lastData.runs,
            lastData.perCommand,
            lastData.projects,
            lastData.commands,
            lastData.devices
          );
        }
      });
    }

    // Trend period selector
    const trendPeriodSelect = document.getElementById(
      "trendPeriodSelect"
    ) as HTMLSelectElement;
    if (trendPeriodSelect) {
      trendPeriodSelect.addEventListener("change", function () {
        trendPeriodDays = parseInt(this.value);
        console.log("Trend period changed to:", trendPeriodDays, "days");
        saveCurrentSettings(); // Save settings when changed
        // Re-load data to recalculate trends with new period
        loadData();
      });
    }

    // Clear Filters button
    const clearFiltersBtn = document.getElementById("clearFiltersBtn");
    if (clearFiltersBtn) {
      clearFiltersBtn.addEventListener("click", clearAllFilters);
    }

    // Coffee button
    const coffeeBtn = document.getElementById("coffeeBtn");
    if (coffeeBtn) {
      coffeeBtn.addEventListener("click", () => {
        // Send message to extension to open Buy Me a Coffee page
        vscode.postMessage({
          type: "OPEN_COFFEE_LINK",
        });
      });
    }

    // Export/Import buttons
    const exportDataBtn = document.getElementById("exportDataBtn");
    if (exportDataBtn) {
      exportDataBtn.addEventListener("click", exportData);
    }

    const exportProfileBtn = document.getElementById("exportProfileBtn");
    if (exportProfileBtn) {
      exportProfileBtn.addEventListener("click", exportProfile);
    }

    const importDataBtn = document.getElementById("importDataBtn");
    if (importDataBtn) {
      importDataBtn.addEventListener("click", importData);
    }

    const importProfileBtn = document.getElementById("importProfileBtn");
    if (importProfileBtn) {
      importProfileBtn.addEventListener("click", importProfile);
    }

    // Cancel task button
    const cancelTaskBtn = document.getElementById("cancelTaskBtn");
    if (cancelTaskBtn) {
      cancelTaskBtn.addEventListener("click", cancelRunningTask);
    }

    // Clear data button
    const clearBtn = document.getElementById("clearBtn");
    if (clearBtn) {
      clearBtn.addEventListener("click", clearData);
    }

    // Table interactions - use event delegation
    document.addEventListener("click", function (event) {
      const target = event.target as HTMLElement;

      if (!target) return;

      // Handle sortable headers
      if (target.matches("th[data-sort]")) {
        const column = target.getAttribute("data-sort");
        console.log("Table header clicked:", column);
        if (column) {
          window.sortCommandTable(column);
        }
        return;
      }

      // Handle play buttons
      if (target.matches(".play-btn")) {
        if (isCommandRunning) {
          console.log("Command already running, ignoring play button click");
          return;
        }
        const command = target.getAttribute("data-command");
        if (command) {
          setCommandRunning(true);
          window.runCommand(command);
        }
        return;
      }

      // Handle delete run buttons
      if (target.matches(".delete-run-btn")) {
        const runId = target.getAttribute("data-run-id");
        if (runId) {
          deleteRun(runId);
        }
        return;
      }

      // Handle filter by command (runs column)
      if (target.matches(".runs-count.clickable")) {
        const command = target.getAttribute("data-filter-command");
        if (command) {
          window.filterByCommand(command);
        }
        return;
      }

      // Handle filter by failed (success rate column)
      if (target.matches(".success-rate.clickable")) {
        const command = target.getAttribute("data-filter-failed");
        if (command) {
          window.filterByFailed(command);
        }
        return;
      }
    });

    // Column selector functionality
    document.addEventListener("click", function (event) {
      const columnBtn = document.querySelector(".column-menu-btn");
      const columnMenu = document.querySelector(".column-menu");
      const target = event.target as HTMLElement;

      if (!columnMenu || !target) return;

      if (target === columnBtn) {
        columnMenu.classList.toggle("element-hidden");
      } else if (!columnMenu.contains(target)) {
        columnMenu.classList.add("element-hidden");
      }
    });

    // Column visibility changes
    document.addEventListener("change", function (event) {
      const target = event.target as HTMLInputElement;
      if (target && target.matches('.column-menu input[type="checkbox"]')) {
        const column = target.getAttribute("data-column");
        if (column && column in visibleColumns) {
          (visibleColumns as any)[column] = target.checked;
          updateColumnVisibility();
          saveCurrentSettings(); // Save settings when changed
        }
      }
    });

    // Sign in button (disabled for now)
    const signinBtn = document.getElementById("signinBtn");
    if (signinBtn) {
      signinBtn.addEventListener("click", function (e) {
        e.preventDefault();
        // Show tooltip-like message
        const btn = e.target as HTMLElement;
        const originalText = btn.textContent;
        btn.textContent = "Coming Soon!";
        setTimeout(() => {
          btn.textContent = originalText;
        }, 1500);
      });
    }

    function updateFilters() {
      currentFilters = {
        projectId: getMultiSelectValues("project"),
        command: getMultiSelectValues("command"),
        success: getMultiSelectValues("success"),
        window: currentFilters.window || "7d", // Use current time range filter
        customFrom: currentFilters.customFrom, // Include custom date range
        customTo: currentFilters.customTo, // Include custom date range
        deviceInstance: getMultiSelectDeviceInstances(),
      };

      saveCurrentSettings(); // Save when filters change

      // Clear heatmap selection if filters changed externally (not via heatmap click)
      if (selectedHeatmapDay && !isHeatmapFilterUpdate) {
        clearHeatmapSelection();
      }

      loadData();
    }

    // Flag to prevent clearing selection during heatmap-initiated filter updates
    let isHeatmapFilterUpdate = false;

    function clearHeatmapSelection() {
      selectedHeatmapDay = null;
      previousFiltersState = null;
      document.querySelectorAll(".heatmap-cell.selected").forEach((cell) => {
        cell.classList.remove("selected");
      });
    }

    function getMultiSelectValues(filterType: string): string[] | undefined {
      const dropdown = document.getElementById(`${filterType}FilterDropdown`);
      if (!dropdown) return undefined;

      const checkboxes = dropdown.querySelectorAll(
        'input[type="checkbox"]:checked'
      );

      // Get all checked values, including empty string for "All"
      const allValues = Array.from(checkboxes)
        .map((cb) => cb.parentElement?.getAttribute("data-value"))
        .filter((value): value is string => value !== null);

      // Filter out the "All" option (empty string) to get only specific selections
      const specificValues = allValues.filter(Boolean);

      console.log(`getMultiSelectValues for ${filterType}:`, {
        allValues,
        specificValues,
        hasAll: allValues.includes(""),
        hasSpecific: specificValues.length > 0,
      });

      // If "All" is checked OR no checkboxes are checked, return undefined (no filter)
      if (allValues.includes("") || allValues.length === 0) {
        return undefined;
      }

      // Return specific values only
      return specificValues.length > 0 ? specificValues : undefined;
    }

    function getMultiSelectDeviceInstances():
      | ({ deviceId: any; hardwareHash: any } | null)[]
      | undefined {
      const dropdown = document.getElementById("deviceFilterDropdown");
      if (!dropdown) return undefined;

      const checkboxes = dropdown.querySelectorAll(
        'input[type="checkbox"]:checked'
      );

      // Get all checked values, including empty string for "All"
      const allValues = Array.from(checkboxes)
        .map((cb) => cb.parentElement?.getAttribute("data-value"))
        .filter((value): value is string => value !== null);

      // Filter out the "All" option to get only specific device selections
      const specificValues = allValues.filter(Boolean);

      console.log(`getMultiSelectDeviceInstances:`, {
        allValues,
        specificValues,
        hasAll: allValues.includes(""),
      });

      // If "All" is checked OR no checkboxes are checked, return undefined (no filter)
      if (allValues.includes("") || allValues.length === 0) return undefined;

      // Parse device instances from specific values
      return specificValues
        .map((value) => parseDeviceInstance(value))
        .filter(Boolean);
    }

    function parseDeviceInstance(
      value: string
    ): { deviceId: any; hardwareHash: any } | null {
      if (!value) return null;
      const [deviceId, hardwareHash] = value.split("|");
      return deviceId && hardwareHash ? { deviceId, hardwareHash } : null;
    }

    function loadData() {
      if (isLoadingData) {
        console.log("loadData() called but already loading, skipping");
        return;
      }

      isLoadingData = true;
      console.log("Loading data with trend period:", trendPeriodDays, "days");
      vscode.postMessage({
        type: "LOAD",
        filters: currentFilters,
        trendPeriodDays: trendPeriodDays,
      });
    }

    function exportData() {
      vscode.postMessage({
        type: "EXPORT_DATA",
        filters: currentFilters,
      });
    }

    function exportProfile() {
      const profile = {
        name: `ProcessLens Profile ${new Date().toISOString().split("T")[0]}`,
        version: "1.0.0",
        created: new Date().toISOString(),
        createdBy: "ProcessLens VS Code Extension",
        config: {
          visibleColumns: visibleColumns,
          filters: currentFilters,
          trendPeriodDays: trendPeriodDays,
          timeFormat: timeFormat,
          commandTableSort: commandTableSort,
        },
      };

      vscode.postMessage({
        type: "EXPORT_PROFILE",
        profile: profile,
      });
    }

    function importData() {
      vscode.postMessage({
        type: "IMPORT_DATA",
      });
    }

    function importProfile() {
      vscode.postMessage({
        type: "IMPORT_PROFILE",
      });
    }

    function saveCurrentSettings() {
      const currentState = vscode.getState();
      if (currentState) {
        currentState.settings = {
          visibleColumns,
          filters: currentFilters,
          trendPeriodDays,
          timeFormat,
          commandTableSort,
        };
        vscode.setState(currentState);
      }
    }

    function restoreSettings(settings: any) {
      console.log("Restoring settings:", settings);

      // Restore column visibility
      if (settings.visibleColumns) {
        visibleColumns = { ...visibleColumns, ...settings.visibleColumns };

        // Update column checkboxes
        Object.keys(settings.visibleColumns).forEach((column) => {
          const checkbox = document.querySelector(
            `input[data-column="${column}"]`
          ) as HTMLInputElement;
          if (checkbox) {
            checkbox.checked = settings.visibleColumns[column];
          }
        });
      }

      // Restore filters
      if (settings.filters) {
        currentFilters = { ...currentFilters, ...settings.filters };

        // Restore multi-select filter states
        restoreMultiSelectFilter(
          "project",
          settings.filters.projectId,
          "All Projects"
        );
        restoreMultiSelectFilter(
          "command",
          settings.filters.command,
          "All Commands"
        );
        restoreMultiSelectFilter("success", settings.filters.success, "All");
        restoreMultiSelectFilter(
          "device",
          settings.filters.deviceInstance,
          "All Devices"
        );
      }

      // Restore trend period
      if (settings.trendPeriodDays) {
        trendPeriodDays = settings.trendPeriodDays;
        const trendSelect = document.getElementById(
          "trendPeriodSelect"
        ) as HTMLSelectElement;
        if (trendSelect) {
          trendSelect.value = settings.trendPeriodDays.toString();
        }
      }

      // Restore time format
      if (settings.timeFormat) {
        timeFormat = settings.timeFormat;
        const formatSelect = document.getElementById(
          "timeFormatToggle"
        ) as HTMLSelectElement;
        if (formatSelect) {
          formatSelect.value = settings.timeFormat;
        }
      }

      // Restore table sort
      if (settings.commandTableSort) {
        commandTableSort = {
          ...commandTableSort,
          ...settings.commandTableSort,
        };
      }
    }

    function applyProfile(profile: any) {
      if (!profile || !profile.config) return;

      // Use the restoreSettings function for consistency
      restoreSettings(profile.config);

      // Reload data with new configuration
      loadData();
    }

    function clearData() {
      // Send confirmation request to extension (webview can't show confirm dialogs)
      vscode.postMessage({
        type: "CONFIRM_CLEAR_DATA",
      });
    }

    function clearAllFilters() {
      // Reset all filters to default values
      currentFilters = {
        projectId: "",
        command: "",
        success: "all",
        window: "all",
        deviceInstance: null,
      };

      // Reset multi-select displays to "All"
      const projectDisplay = document.getElementById("projectFilterDisplay");
      const commandDisplay = document.getElementById("commandFilterDisplay");
      const deviceDisplay = document.getElementById("deviceFilterDisplay");

      if (projectDisplay) projectDisplay.textContent = "All Projects";
      if (commandDisplay) commandDisplay.textContent = "All Commands";
      if (deviceDisplay) deviceDisplay.textContent = "All Devices";

      // Reset multi-select checkboxes
      resetMultiSelectFilter("project", "All Projects");
      resetMultiSelectFilter("command", "All Commands");
      resetMultiSelectFilter("device", "All Devices");

      // Reset dropdown selectors
      const successFilter = document.getElementById(
        "successFilter"
      ) as HTMLSelectElement;

      if (successFilter) successFilter.value = "all";

      // Reset time range to default
      currentFilters.window = "7d";
      const timeRangeDisplay = document.getElementById("timeRangeDisplay");
      if (timeRangeDisplay) {
        timeRangeDisplay.textContent = "Last 7 days";
        // Reset time range dropdown selection
        const dropdown = document.getElementById("timeRangeDropdown");
        if (dropdown) {
          dropdown.querySelectorAll(".time-range-option").forEach((opt) => {
            opt.removeAttribute("data-selected");
          });
          const defaultOption = dropdown.querySelector('[data-value="7d"]');
          if (defaultOption) {
            defaultOption.setAttribute("data-selected", "true");
          }
        }
      }

      // Save settings and reload data
      saveCurrentSettings();
      loadData();
    }

    function resetMultiSelectFilter(filterId: string, defaultText: string) {
      const dropdown = document.getElementById(`${filterId}FilterDropdown`);
      if (!dropdown) return;

      // Check "All" checkbox and uncheck all others
      const allCheckbox = dropdown.querySelector(
        `#${filterId}-all`
      ) as HTMLInputElement;
      const otherCheckboxes = dropdown.querySelectorAll(
        `input[type="checkbox"]:not(#${filterId}-all)`
      ) as NodeListOf<HTMLInputElement>;

      if (allCheckbox) allCheckbox.checked = true;
      otherCheckboxes.forEach((cb) => (cb.checked = false));
    }

    function setupDeviceTooltips() {
      // Create tooltip element if it doesn't exist
      let tooltip = document.getElementById("device-tooltip");
      if (!tooltip) {
        tooltip = document.createElement("div");
        tooltip.id = "device-tooltip";
        tooltip.style.cssText = `
        position: absolute;
        background: var(--vscode-editorHoverWidget-background);
        color: var(--vscode-editorHoverWidget-foreground);
        border: 1px solid var(--vscode-editorHoverWidget-border);
        padding: 8px;
        border-radius: 3px;
        font-size: 12px;
        z-index: 1000;
        pointer-events: none;
        display: none;
        max-width: 300px;
        word-wrap: break-word;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      `;
        document.body.appendChild(tooltip);
      }

      // Add event listeners using delegation for dynamic content
      document.addEventListener("mouseover", function (e) {
        const target = e.target as HTMLElement;
        if (target && target.matches(".device-icon, .device-icon-small")) {
          const tooltipText = target.getAttribute("data-tooltip");
          if (tooltipText) {
            tooltip.textContent = tooltipText;
            tooltip.style.display = "block";

            // Position tooltip near cursor, accounting for scroll
            const rect = target.getBoundingClientRect();
            const scrollTop =
              window.pageYOffset || document.documentElement.scrollTop;
            const scrollLeft =
              window.pageXOffset || document.documentElement.scrollLeft;

            // Check if this is in Recent Runs section (smaller space)
            const isInRecentRuns = target.closest(".recent-runs") !== null;

            if (isInRecentRuns) {
              // Position to the left of the icon in Recent Runs
              // First position it off-screen to measure width
              tooltip.style.left = "-9999px";
              tooltip.style.top = rect.top + scrollTop - 5 + "px";

              // Wait for next frame to get accurate width
              requestAnimationFrame(() => {
                const tooltipWidth = tooltip.offsetWidth;
                tooltip.style.left =
                  rect.left + scrollLeft - tooltipWidth - 10 + "px";
              });
            } else {
              // Position to the right in Command Summary (more space)
              tooltip.style.left = rect.right + scrollLeft + 10 + "px";
              tooltip.style.top = rect.top + scrollTop - 5 + "px";
            }
          }
        }
      });

      document.addEventListener("mouseout", function (e) {
        const target = e.target as HTMLElement;
        if (target && target.matches(".device-icon, .device-icon-small")) {
          tooltip.style.display = "none";
        }
      });
    }

    function setCommandRunning(running: boolean) {
      isCommandRunning = running;
      updatePlayButtonStates();
      updateCancelButtonState();
    }

    function updateCancelButtonState() {
      const cancelBtn = document.getElementById("cancelTaskBtn");
      if (cancelBtn) {
        if (isCommandRunning) {
          cancelBtn.classList.remove("element-hidden");
        } else {
          cancelBtn.classList.add("element-hidden");
        }
      }
    }

    function cancelRunningTask() {
      if (!isCommandRunning) return;

      vscode.postMessage({
        type: "CANCEL_TASK",
      });
    }

    function deleteRun(runId: string) {
      // Send confirmation request to extension (webview can't show confirm dialogs)
      vscode.postMessage({
        type: "CONFIRM_DELETE_RUN",
        runId: runId,
      });
    }

    function updatePlayButtonStates() {
      const playButtons = document.querySelectorAll(".play-btn");
      playButtons.forEach((btn) => {
        const button = btn as HTMLButtonElement;
        if (isCommandRunning) {
          button.disabled = true;
          button.style.opacity = "0.5";
          button.style.cursor = "not-allowed";
          button.title = "A command is already running...";
        } else {
          button.disabled = false;
          button.style.opacity = "1";
          button.style.cursor = "pointer";
          button.title = "Run this command";
        }
      });
    }

    // Handle messages from extension
    window.addEventListener("message", function (event) {
      const message = event.data;

      switch (message.type) {
        case "DATA":
          renderData(
            message.runs,
            message.perCommand,
            message.projects,
            message.commands,
            message.devices
          );
          break;
        case "UPDATED":
          loadData();
          break;
        case "COMMAND_STARTED":
          setCommandRunning(true);
          break;
        case "COMMAND_COMPLETED":
          setCommandRunning(false);
          break;
        case "DATA_CLEARED":
          // Reset filters and reload
          currentFilters = {
            projectId: "",
            command: "",
            success: "all",
            window: "all",
            deviceInstance: null,
          };
          showEmptyState();
          break;
        case "RUN_DELETED":
          // Reload data after run deletion
          loadData();
          break;

        case "PROFILE_IMPORTED":
          applyProfile(message.profile);
          break;
      }
    });

    function renderData(
      runs: EventRecord[],
      perCommand: CommandSummary[],
      projects: any[],
      commands: any[],
      devices: any[]
    ) {
      // Reset loading flag
      isLoadingData = false;

      // Reset pagination to first page when data changes (filters applied)
      commandTablePage = 0;

      // Store data globally for chart tabs
      lastData = {
        runs,
        perCommand,
        projects,
        commands,
        devices,
      };

      // Re-render the currently active chart tab with new filtered data
      rerenderActiveChartTab();

      // Store data AND settings for re-rendering
      vscode.setState({
        runs,
        perCommand,
        projects,
        commands,
        devices,
        // Save current settings
        settings: {
          visibleColumns,
          filters: currentFilters,
          trendPeriodDays,
          timeFormat,
          commandTableSort,
        },
      });

      // Update filter options and set smart defaults
      updateFilterOptions("project", projects, "All Projects");
      updateFilterOptions("command", commands, "All Commands");
      updateFilterOptions("device", devices, "All Devices");

      // Set default project to most active one if not already set and no saved state
      const savedState = vscode.getState();
      const hasExistingFilters =
        savedState && savedState.settings && savedState.settings.filters;

      if (
        !currentFilters.projectId &&
        projects.length > 0 &&
        !hasExistingFilters
      ) {
        const defaultProject = projects[0]; // Already sorted by activity
        setMultiSelectDefault(
          "project",
          defaultProject.value,
          defaultProject.label
        );
        currentFilters.projectId = defaultProject.value;
        console.log("Set default project to:", defaultProject.label);
      }

      if (runs.length === 0) {
        showEmptyState(currentFilters);
        return;
      }

      // Show content using CSS classes (CSP-compliant)
      document.querySelector(".loading")?.classList.add("element-hidden");
      document.querySelector(".empty-state")?.classList.add("element-hidden");
      document.querySelector(".cards")?.classList.remove("element-hidden");
      document
        .querySelector(".global-stats")
        ?.classList.remove("element-hidden");

      // Render chart with error handling
      try {
        if (runs && runs.length > 0) {
          renderChart(runs);
        } else {
          const container =
            document.getElementById("durationChart")?.parentElement;
          if (container) {
            container.innerHTML =
              '<div class="chart-message">No timing data to display</div>';
          }
        }
      } catch (error) {
        const container =
          document.getElementById("durationChart")?.parentElement;
        if (container) {
          container.innerHTML =
            '<div class="chart-error">Chart failed to load. Try clearing data to reset.</div>';
        }
      }

      // Render command summary table
      renderCommandTable(perCommand, runs);

      // Render global stats
      renderGlobalStats(runs, perCommand, projects, commands, devices);

      // Render recent runs (last 10)
      renderRecentRuns(runs.slice(-10));

      // Set device icon colors using CSS custom properties (CSP-compliant)
      setDeviceIconColors();
    }

    function renderGlobalStats(
      runs: EventRecord[],
      perCommand: CommandSummary[],
      projects: string[],
      commands: string[],
      devices: string[]
    ) {
      // Calculate stats based on currently filtered data
      const totalRuns = runs.length;
      const commandCount = perCommand.length;
      const successfulRuns = runs.filter((r) => r.success).length;
      const overallSuccess =
        totalRuns > 0 ? Math.round((successfulRuns / totalRuns) * 100) : 0;

      // Calculate unique projects and devices from current filtered runs
      const uniqueProjects = new Set(runs.map((r) => r.projectId)).size;
      const uniqueDevices = new Set(runs.map((r) => r.deviceId)).size;

      const totalRunsEl = document.getElementById("totalRuns");
      if (totalRunsEl) totalRunsEl.textContent = totalRuns.toLocaleString();

      const commandCountEl = document.getElementById("commandCount");
      if (commandCountEl)
        commandCountEl.textContent = commandCount.toLocaleString();

      const overallSuccessEl = document.getElementById("overallSuccess");
      if (overallSuccessEl) overallSuccessEl.textContent = `${overallSuccess}%`;

      const activeProjectsEl = document.getElementById("activeProjects");
      if (activeProjectsEl)
        activeProjectsEl.textContent = uniqueProjects.toLocaleString();

      const activeDevicesEl = document.getElementById("activeDevices");
      if (activeDevicesEl)
        activeDevicesEl.textContent = uniqueDevices.toLocaleString();
    }

    function setupMultiSelectDropdown(filterType: string, allText: string) {
      const display = document.getElementById(`${filterType}FilterDisplay`);
      const dropdown = document.getElementById(`${filterType}FilterDropdown`);

      if (!display || !dropdown) return;

      // Toggle dropdown on display click
      display.addEventListener("click", function (e) {
        e.stopPropagation();

        // Close other dropdowns using CSS classes (CSP-compliant)
        document.querySelectorAll(".multi-select-dropdown").forEach((dd) => {
          if (dd !== dropdown) dd.classList.add("element-hidden");
        });

        // Toggle this dropdown using CSS classes (CSP-compliant)
        dropdown.classList.toggle("element-hidden");
      });

      // Handle checkbox changes - use event delegation to handle dynamically added options
      dropdown.addEventListener("change", function (e) {
        const target = e.target as HTMLInputElement;
        if (target && target.type === "checkbox") {
          console.log(
            `Checkbox change detected for ${filterType}:`,
            target.id,
            target.checked
          );
          handleMultiSelectChange(filterType, allText);
        }
      });

      // Prevent dropdown close when clicking inside
      dropdown.addEventListener("click", function (e) {
        e.stopPropagation();
      });

      // Close all dropdowns when clicking outside
      if (!document.hasMultiSelectClickHandler) {
        document.addEventListener("click", function () {
          document.querySelectorAll(".multi-select-dropdown").forEach((dd) => {
            dd.classList.add("element-hidden");
          });
        });
        document.hasMultiSelectClickHandler = true;
      }
    }

    function handleMultiSelectChange(filterType: string, allText: string) {
      const dropdown = document.getElementById(`${filterType}FilterDropdown`);
      const display = document.getElementById(`${filterType}FilterDisplay`);

      if (!dropdown || !display) return;

      const allCheckbox = dropdown.querySelector(
        'input[type="checkbox"][id$="-all"]'
      ) as HTMLInputElement;
      const otherCheckboxes = dropdown.querySelectorAll(
        'input[type="checkbox"]:not([id$="-all"])'
      ) as NodeListOf<HTMLInputElement>;

      // Get the event from the global context (this is a workaround for the event access)
      const event =
        (window as any).event ||
        (arguments as any).callee.caller?.arguments?.[0];
      const target = event?.target as HTMLInputElement;

      if (!target) return;

      console.log(`Multi-select change for ${filterType}:`, {
        target: target.id,
        checked: target.checked,
        isAll: target === allCheckbox,
        allCheckboxState: allCheckbox?.checked,
        otherCheckboxCount: Array.from(otherCheckboxes).filter(
          (cb) => cb.checked
        ).length,
      });

      // Prevent updateFilters from being called during this function to avoid race conditions
      let shouldUpdateFilters = true;

      // If "All" was clicked
      if (target === allCheckbox) {
        if (allCheckbox.checked) {
          // Uncheck all others
          otherCheckboxes.forEach((cb) => (cb.checked = false));
          display.textContent = allText;
        } else {
          // If "All" was unchecked, don't allow it (always need something selected)
          allCheckbox.checked = true;
          shouldUpdateFilters = false; // Don't update filters if we're reverting
          return;
        }
      } else {
        // If any other checkbox was clicked
        if (target.checked) {
          // Uncheck "All" when selecting specific items
          if (allCheckbox) allCheckbox.checked = false;
        }

        // Update display text based on current selections
        const checkedBoxes = Array.from(otherCheckboxes).filter(
          (cb) => cb.checked
        );

        console.log(`Checked boxes count after change: ${checkedBoxes.length}`);

        if (checkedBoxes.length === 0) {
          // If nothing is selected, revert to "All"
          if (allCheckbox) {
            allCheckbox.checked = true;
            display.textContent = allText;
          }
        } else if (checkedBoxes.length === 1) {
          const label = checkedBoxes[0].nextElementSibling?.textContent;
          display.textContent =
            label && label.length > 25
              ? label.substring(0, 25) + "..."
              : label || "";
        } else {
          display.textContent = `${checkedBoxes.length} selected`;
        }
      }

      // Only update filters if we should
      if (shouldUpdateFilters) {
        console.log(`Updating filters for ${filterType}`);
        updateFilters();
      }
    }

    function updateFilterOptions(
      filterId: string,
      options: { value: string; label: string }[],
      defaultText: string
    ) {
      const dropdown = document.getElementById(`${filterId}FilterDropdown`);
      const display = document.getElementById(`${filterId}FilterDisplay`);

      if (!dropdown) {
        console.warn(`Dropdown not found for ${filterId}`);
        return;
      }

      console.log(
        `Updating filter options for ${filterId}:`,
        options.length,
        "options"
      );

      // Preserve current selection state before clearing
      const currentSelections = new Map();
      const existingCheckboxes = dropdown.querySelectorAll(
        'input[type="checkbox"]'
      ) as NodeListOf<HTMLInputElement>;
      existingCheckboxes.forEach((cb) => {
        currentSelections.set(cb.id, cb.checked);
      });

      // Clear all existing options
      dropdown.innerHTML = "";

      // Add "All" option first
      const allOptionDiv = document.createElement("div");
      allOptionDiv.className = "multi-select-option";
      allOptionDiv.setAttribute("data-value", "");

      const allCheckbox = document.createElement("input");
      allCheckbox.type = "checkbox";
      allCheckbox.id = `${filterId}-all`;
      // Preserve previous state or default to true if first time
      allCheckbox.checked = currentSelections.has(`${filterId}-all`)
        ? currentSelections.get(`${filterId}-all`)
        : true;

      const allLabel = document.createElement("label");
      allLabel.setAttribute("for", allCheckbox.id);
      allLabel.textContent = defaultText;

      allOptionDiv.appendChild(allCheckbox);
      allOptionDiv.appendChild(allLabel);
      dropdown.appendChild(allOptionDiv);

      // Add individual options
      options.forEach((option) => {
        const optionDiv = document.createElement("div");
        optionDiv.className = "multi-select-option";
        optionDiv.setAttribute("data-value", option.value);

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.id = `${filterId}-${option.value}`;
        // Preserve previous state or default to false
        checkbox.checked = currentSelections.has(`${filterId}-${option.value}`)
          ? currentSelections.get(`${filterId}-${option.value}`)
          : false;

        const label = document.createElement("label");
        label.setAttribute("for", checkbox.id);
        label.textContent = option.label;

        optionDiv.appendChild(checkbox);
        optionDiv.appendChild(label);
        dropdown.appendChild(optionDiv);
      });

      // Update display text based on current selections
      if (display) {
        const checkedSpecificBoxes = dropdown.querySelectorAll(
          'input[type="checkbox"]:not([id$="-all"]):checked'
        ) as NodeListOf<HTMLInputElement>;
        const allCheckbox = dropdown.querySelector(
          'input[id$="-all"]'
        ) as HTMLInputElement;

        if (
          allCheckbox &&
          allCheckbox.checked &&
          checkedSpecificBoxes.length === 0
        ) {
          display.textContent = defaultText;
        } else if (checkedSpecificBoxes.length === 1) {
          const label = checkedSpecificBoxes[0].nextElementSibling?.textContent;
          display.textContent =
            label && label.length > 25
              ? label.substring(0, 25) + "..."
              : label || "";
        } else if (checkedSpecificBoxes.length > 1) {
          display.textContent = `${checkedSpecificBoxes.length} selected`;
        } else {
          // Fallback to "All" if nothing is selected
          display.textContent = defaultText;
          if (allCheckbox) allCheckbox.checked = true;
        }

        console.log(
          `updateFilterOptions for ${filterId}: display set to "${display.textContent}"`
        );
      }
    }

    function setMultiSelectDefault(
      filterType: string,
      value: string,
      label: string
    ) {
      const dropdown = document.getElementById(`${filterType}FilterDropdown`);
      const display = document.getElementById(`${filterType}FilterDisplay`);

      if (!dropdown || !display) return;

      // Uncheck "All"
      const allCheckbox = dropdown.querySelector(
        'input[type="checkbox"][id$="-all"]'
      ) as HTMLInputElement;
      if (allCheckbox) allCheckbox.checked = false;

      // Check the specific option
      const targetCheckbox = dropdown.querySelector(
        `input[id="${filterType}-${value}"]`
      ) as HTMLInputElement;
      if (targetCheckbox) {
        targetCheckbox.checked = true;
        display.textContent = label;
      }
    }

    function restoreMultiSelectFilter(
      filterType: string,
      filterValue: any,
      allText: string
    ) {
      const dropdown = document.getElementById(`${filterType}FilterDropdown`);
      const display = document.getElementById(`${filterType}FilterDisplay`);

      if (!dropdown || !display) return;

      // Reset all checkboxes first
      dropdown
        .querySelectorAll('input[type="checkbox"]')
        .forEach((cb) => ((cb as HTMLInputElement).checked = false));

      if (
        !filterValue ||
        (Array.isArray(filterValue) && filterValue.length === 0)
      ) {
        // No filter - check "All"
        const allCheckbox = dropdown.querySelector(
          'input[type="checkbox"][id$="-all"]'
        ) as HTMLInputElement;
        if (allCheckbox) allCheckbox.checked = true;
        display.textContent = allText;
      } else {
        // Has filter - check specific options
        const values = Array.isArray(filterValue) ? filterValue : [filterValue];
        let checkedCount = 0;

        values.forEach((value) => {
          let checkboxId;
          if (filterType === "device" && typeof value === "object") {
            // Device filter stores objects, need to find by device instance value
            checkboxId = `${filterType}-${value.deviceId}|${value.hardwareHash}`;
          } else {
            checkboxId = `${filterType}-${value}`;
          }

          const checkbox = dropdown.querySelector(
            `input[id="${checkboxId}"]`
          ) as HTMLInputElement;
          if (checkbox) {
            checkbox.checked = true;
            checkedCount++;
          }
        });

        // Update display text
        if (checkedCount === 1) {
          const checkedCheckbox = dropdown.querySelector(
            'input[type="checkbox"]:checked:not([id$="-all"])'
          );
          if (checkedCheckbox && checkedCheckbox.nextElementSibling) {
            display.textContent =
              checkedCheckbox.nextElementSibling.textContent;
          }
        } else if (checkedCount > 1) {
          display.textContent = `${checkedCount} selected`;
        } else {
          // Fallback to "All" if nothing was restored
          const allCheckbox = dropdown.querySelector(
            'input[type="checkbox"][id$="-all"]'
          ) as HTMLInputElement;
          if (allCheckbox) allCheckbox.checked = true;
          display.textContent = allText;
        }
      }
    }

    function renderChart(runs: EventRecord[]) {
      // Check if Chart.js is available
      if (typeof Chart === "undefined") {
        console.error("Chart.js is not available");
        return;
      }

      const canvas = document.getElementById("durationChart");
      if (!canvas) {
        console.error("Chart canvas not found");
        return;
      }

      const ctx = (canvas as HTMLCanvasElement).getContext("2d");
      if (!ctx) {
        console.error("Chart context not available");
        return;
      }

      if (chart) {
        chart.destroy();
        chart = null;
      }

      // Validate data
      if (!runs || !Array.isArray(runs) || runs.length === 0) {
        throw new Error("No valid data to chart");
      }

      const data = runs.map((run) => ({
        x: new Date(run.tsEnd),
        y: run.durationMs,
        success:
          run.success !== undefined ? run.success : (run as any).exitCode === 0,
        command: run.command,
        deviceId: run.deviceId,
        hardwareHash: run.hardwareHash,
      }));



      // Detect hardware changes for annotations
      const hardwareChanges: any[] = [];
      let lastHardwareHash: string | null = null;

      runs.forEach((run) => {
        if (lastHardwareHash && run.hardwareHash !== lastHardwareHash) {
          hardwareChanges.push({
            x: new Date(run.tsEnd),
            label: "Hardware Change",
            device: run.deviceId,
          });
        }
        lastHardwareHash = run.hardwareHash;
      });

      if (data.length === 0) {
        throw new Error("No valid timing data found");
      }

      // Create point colors based on success/failure
      const pointColors = data.map((point) => {
        if (point.success === true) return "#22c55e"; // Green for success
        if (point.success === false) return "#ef4444"; // Red for failure
        return "#eab308"; // Yellow for unclear
      });

      // Analyze value distribution for better chart scaling
      const values = data.map((d) => d.y);
      const maxVal = Math.max(...values);
      const minVal = Math.min(...values.filter((v) => v > 0));
      const ratio = maxVal / minVal;

      // Use log scale only for extreme differences (>100x) and disable it for now to test
      const useLogScale = false; // Temporarily disable log scale to see linear behavior

      console.log("Chart values:", {
        maxVal,
        minVal,
        ratio,
        useLogScale,
        values: values.slice(0, 10), // Show first 10 values for debugging
      });

      chart = new Chart(ctx, {
        type: "line",
        data: {
          datasets: [
            {
              label: "Duration (ms)",
              data: data,
              borderColor: "#4FC3F7",
              backgroundColor: "rgba(79, 195, 247, 0.1)",
              borderWidth: 2,
              fill: false, // Remove fill to reduce visual clutter
              tension: 0, // Straight lines between points
              stepped: false, // Try stepped lines for discrete data
              pointBackgroundColor: pointColors,
              pointRadius: 4,
              pointHoverRadius: 7,
              pointBorderColor: "rgba(255, 255, 255, 0.5)",
              pointBorderWidth: 1,
              pointHoverBorderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              type: "linear",
              position: "bottom",
              grid: {
                color: "rgba(255, 255, 255, 0.1)",
              },
              ticks: {
                color: "rgba(255, 255, 255, 0.7)",
                maxTicksLimit: 8,
                callback: function (value: any, index: number) {
                  if (index < data.length) {
                    const date = new Date(data[index].x);
                    const now = new Date();
                    const diffHours =
                      (now.getTime() - date.getTime()) / (1000 * 60 * 60);

                    if (diffHours < 1) {
                      return date.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      });
                    } else if (diffHours < 24) {
                      return date.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      });
                    } else {
                      return date.toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                      });
                    }
                  }
                  return "";
                },
              },
            },
            y: {
              type: "linear", // Always use linear for now
              beginAtZero: true,
              grid: {
                color: "rgba(255, 255, 255, 0.1)",
              },
              ticks: {
                color: "rgba(255, 255, 255, 0.7)",
                maxTicksLimit: 8, // Limit number of Y-axis labels
                callback: function (value: any) {
                  return formatDuration(Math.round(value));
                },
              },
            },
          },
          plugins: {
            legend: {
              display: false,
            },
            tooltip: {
              callbacks: {
                title: function (context: any) {
                  return new Date(context[0].parsed.x).toLocaleString();
                },
                label: function (context: any) {
                  const dataPoint = data[context.dataIndex];
                  const deviceLabel = dataPoint.deviceId
                    ? dataPoint.deviceId.slice(0, 8) + "..."
                    : "Unknown device";
                  return [
                    `Command: ${dataPoint.command}`,
                    `Duration: ${formatDuration(context.parsed.y)}`,
                    `Status: ${
                      dataPoint.success === true
                        ? "✅ Success"
                        : dataPoint.success === false
                        ? "❌ Failed"
                        : "⚠️ Unknown"
                    }`,
                    `Device: ${deviceLabel}`,
                  ];
                },
              },
            },
            annotation: {
              annotations: hardwareChanges.map((change) => ({
                type: "line",
                mode: "vertical",
                scaleID: "x",
                value: change.x,
                borderColor: "rgba(255, 193, 7, 0.8)",
                borderWidth: 2,
                borderDash: [5, 5],
                label: {
                  display: true,
                  content: "🔧 Hardware Change",
                  position: "top",
                  backgroundColor: "rgba(255, 193, 7, 0.8)",
                  color: "#000",
                  font: {
                    size: 10,
                  },
                },
              })),
            },
          },
          onHover: (event: any, elements: any) => {
            // Show command info below chart when hovering
            const legendEl = document.getElementById("chart-legend");
            if (legendEl && elements.length > 0) {
              const dataIndex = elements[0].index;
              const dataPoint = data[dataIndex];
              legendEl.innerHTML = `
              <div class="chart-hover-info">
                <strong>${dataPoint.command}</strong><br>
                <span class="duration">${formatDuration(dataPoint.y)}</span> • 
                <span class="status ${
                  dataPoint.success === true
                    ? "success"
                    : dataPoint.success === false
                    ? "error"
                    : "warning"
                }">
                  ${
                    dataPoint.success === true
                      ? "✅ Success"
                      : dataPoint.success === false
                      ? "❌ Failed"
                      : "⚠️ Unknown"
                  }
                </span><br>
                <small>${new Date(dataPoint.x).toLocaleString()}</small>
              </div>
            `;
              legendEl.style.display = "block";
            } else if (legendEl) {
              legendEl.style.display = "none";
            }
          },
        },
      });
    }

    function sortCommands(
      commands: CommandSummary[],
      column: string,
      direction: string
    ) {
      return [...commands].sort((a, b) => {
        let aVal, bVal;

        switch (column) {
          case "command":
            aVal = a.command.toLowerCase();
            bVal = b.command.toLowerCase();
            break;
          case "runs":
            aVal = a.runs;
            bVal = b.runs;
            break;
          case "avgMs":
            aVal = a.avgMs;
            bVal = b.avgMs;
            break;
          case "successRate":
            aVal = a.successRate;
            bVal = b.successRate;
            break;
          case "totalTimeMs":
            aVal = a.totalTimeMs;
            bVal = b.totalTimeMs;
            break;
          case "impactScore":
            aVal = a.impactScore;
            bVal = b.impactScore;
            break;
          case "timePerDay":
            aVal = a.timePerDayMs;
            bVal = b.timePerDayMs;
            break;
          case "medianMs":
            aVal = a.medianMs;
            bVal = b.medianMs;
            break;
          case "p95Ms":
            aVal = a.p95Ms;
            bVal = b.p95Ms;
            break;
          case "minMs":
            aVal = a.minMs;
            bVal = b.minMs;
            break;
          case "maxMs":
            aVal = a.maxMs;
            bVal = b.maxMs;
            break;
          case "projectedSavingsMs":
            aVal = a.projectedSavingsMs;
            bVal = b.projectedSavingsMs;
            break;
          case "optimizationPotential":
            aVal = a.optimizationPotential;
            bVal = b.optimizationPotential;
            break;
          default:
            return 0;
        }

        if (aVal < bVal) return direction === "asc" ? -1 : 1;
        if (aVal > bVal) return direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    function renderCommandTable(
      perCommand: CommandSummary[],
      runs: EventRecord[] = []
    ) {
      // Store current data for re-rendering
      currentCommandData = perCommand;

      const tbody = document.getElementById("commandTableBody");
      if (!tbody) {
        console.error("Command table body not found");
        return;
      }

      const tableContainer = tbody.closest(".table-container");

      // Sort commands
      const sorted = sortCommands(
        perCommand,
        commandTableSort.column,
        commandTableSort.direction
      );

      // Paginate
      const startIndex = commandTablePage * COMMANDS_PER_PAGE;
      const endIndex = startIndex + COMMANDS_PER_PAGE;
      const paginatedCommands = sorted.slice(startIndex, endIndex);

      // Clear table
      tbody.innerHTML = "";

      // Render rows
      paginatedCommands.forEach((cmd) => {
        const row = document.createElement("tr");
        const successRate = Math.round(cmd.successRate * 100);
        const successClass =
          successRate >= 90
            ? "success"
            : successRate >= 50
            ? "warning"
            : "error";

        // Create command cell with play button and device icons
        const deviceIcons = getCommandDeviceIcons(cmd.command, runs as any[]);
        const commandCell = `
        <div class="command-cell">
          <button class="play-btn" data-command="${cmd.command.replace(
            /"/g,
            "&quot;"
          )}">▶</button>
          <div class="command-text" data-tooltip="${cmd.command}">
            <span class="command-display">${cmd.command}</span>
          </div>
          <div class="command-devices">
            ${deviceIcons}
          </div>
        </div>
      `;

        // Create trend indicator
        const trendIcon =
          cmd.trend === "up" ? "↗" : cmd.trend === "down" ? "↘" : "→";
        const trendClass = `trend-${cmd.trend}`;

        row.innerHTML = `
        <td data-column="command" class="command-name">${commandCell}</td>
        <td data-column="runs" class="runs-count clickable" data-filter-command="${cmd.command.replace(
          /"/g,
          "&quot;"
        )}">
          ${cmd.runs}
        </td>
        <td data-column="avgMs" class="avg-duration">${formatDuration(
          Math.round(cmd.avgMs)
        )}</td>
        <td data-column="medianMs" class="median-duration column-hidden">${formatDuration(
          Math.round(cmd.medianMs || cmd.avgMs)
        )}</td>
        <td data-column="p95Ms" class="p95-duration column-hidden">${formatDuration(
          Math.round(cmd.p95Ms || cmd.avgMs)
        )}</td>
        <td data-column="minMs" class="min-duration column-hidden">${formatDuration(
          Math.round(cmd.minMs || cmd.avgMs)
        )}</td>
        <td data-column="maxMs" class="max-duration column-hidden">${formatDuration(
          Math.round(cmd.maxMs || cmd.avgMs)
        )}</td>
        <td data-column="successRate" class="success-rate ${successClass} clickable" data-filter-failed="${cmd.command.replace(
          /"/g,
          "&quot;"
        )}">
          ${successRate}%
        </td>
        <td data-column="trend" class="trend-indicator ${trendClass} column-hidden" title="Performance trend for selected period">
          ${trendIcon}
        </td>
        <td data-column="sparkline" class="sparkline-cell column-hidden"></td>
        <td data-column="totalTime" class="total-time column-visible" title="Total time consumed: ${formatDuration(
          cmd.totalTimeMs
        )}">
          ${formatDuration(Math.round(cmd.totalTimeMs))}
        </td>
        <td data-column="impact" class="impact-score column-visible" title="Impact score: ${
          cmd.impactScore
        }/100">
          <div class="impact-bar" data-impact="${cmd.impactScore}">
            <div class="impact-fill"></div>
            <span class="impact-text">${cmd.impactScore}</span>
          </div>
        </td>
        <td data-column="timePerDay" class="time-per-day column-hidden" title="Average time per day: ${formatDuration(
          cmd.timePerDayMs
        )}">
          ${formatDuration(Math.round(cmd.timePerDayMs))}
        </td>
        <td data-column="projectedSavings" class="projected-savings column-hidden" title="Potential savings: ${formatDuration(
          cmd.projectedSavingsMs || 0
        )}">
          ${formatDuration(Math.round(cmd.projectedSavingsMs || 0))}
        </td>
        <td data-column="optimizationPotential" class="optimization-potential column-hidden" title="Optimization priority: ${
          cmd.optimizationPotential || "low"
        }">
          <span class="priority-badge priority-${
            cmd.optimizationPotential || "low"
          }">${String(cmd.optimizationPotential || "low").toUpperCase()}</span>
        </td>
      `;
        tbody.appendChild(row);

        // Store command data on the row for later access
        row.commandData = cmd;

        // Set impact bar width using CSS custom property (CSP-compliant)
        const impactBar = row.querySelector(".impact-bar");
        if (impactBar) {
          (impactBar as HTMLElement).style.setProperty(
            "--impact-width",
            `${cmd.impactScore}%`
          );
        }

        // Add sparkline if column is visible
        if (visibleColumns.sparkline) {
          const sparklineCell = row.querySelector(".sparkline-cell");
          if (sparklineCell) {
            if (cmd.sparkline && cmd.sparkline.length > 1) {
              const sparkline = createSparkline(cmd.sparkline);
              sparklineCell.appendChild(sparkline);
            } else {
              // Show placeholder for commands with insufficient data
              sparklineCell.innerHTML =
                '<span class="sparkline-placeholder" title="Needs 2+ runs to show trend">—</span>';
            }
          }
        }
      });

      // Update pagination info
      updateCommandTablePagination(sorted.length);

      // Update sort indicators in headers
      setTimeout(() => updateSortIndicators(), 10); // Small delay to ensure DOM is ready

      // Update column visibility
      updateColumnVisibility();

      // Update play button states
      updatePlayButtonStates();

      // Set device icon colors using CSS custom properties (CSP-compliant)
      setDeviceIconColors();
    }

    function updateColumnVisibility() {
      const table = document.getElementById("commandTable");
      if (!table) return;

      // Update header visibility using CSS classes (CSP-compliant)
      const headers = table.querySelectorAll("th[data-column]");
      headers.forEach((header) => {
        const column = header.getAttribute("data-column");
        if (column && visibleColumns[column as keyof ColumnVisibility]) {
          header.classList.remove("column-hidden");
          header.classList.add("column-visible");
        } else {
          header.classList.remove("column-visible");
          header.classList.add("column-hidden");
        }
      });

      // Update cell visibility using CSS classes (CSP-compliant)
      const rows = table.querySelectorAll("tbody tr");
      rows.forEach((row) => {
        const cells = row.querySelectorAll("td[data-column]");
        cells.forEach((cell) => {
          const column = cell.getAttribute("data-column");
          if (column && visibleColumns[column as keyof ColumnVisibility]) {
            cell.classList.remove("column-hidden");
            cell.classList.add("column-visible");
          } else {
            cell.classList.remove("column-visible");
            cell.classList.add("column-hidden");
          }

          // If sparkline column is being shown and doesn't have content, render it
          if (
            column === "sparkline" &&
            visibleColumns[column] &&
            cell.innerHTML === ""
          ) {
            const commandData = (row as any).commandData;
            if (commandData) {
              if (
                commandData.recentDurations &&
                commandData.recentDurations.length > 1
              ) {
                const sparkline = createSparkline(commandData.recentDurations);
                cell.appendChild(sparkline);
              } else {
                cell.innerHTML =
                  '<span class="sparkline-placeholder" title="Needs 2+ runs to show trend">—</span>';
              }
            }
          }
        });
      });
    }

    function createSparkline(durations: number[]): HTMLCanvasElement {
      const canvas = document.createElement("canvas");
      canvas.width = 60;
      canvas.height = 20;
      canvas.className = "sparkline";

      const ctx = canvas.getContext("2d");
      if (!ctx || durations.length < 2) return canvas;

      const max = Math.max(...durations);
      const min = Math.min(...durations);
      const range = max - min || 1;

      ctx.strokeStyle = "#007ACC";
      ctx.lineWidth = 1;
      ctx.beginPath();

      durations.forEach((duration: number, i: number) => {
        const x = (i / (durations.length - 1)) * 58 + 1;
        const y = 19 - ((duration - min) / range) * 18;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });

      ctx.stroke();
      return canvas;
    }

    function updateCommandTablePagination(totalCommands: number): void {
      let paginationEl = document.querySelector(".command-pagination");
      if (!paginationEl) {
        paginationEl = document.createElement("div");
        paginationEl.className = "command-pagination";
        const tableBody = document.getElementById("commandTableBody");
        const tableContainer = tableBody?.closest(".table-container");
        if (tableContainer) {
          tableContainer.appendChild(paginationEl);
        }
      }

      const totalPages = Math.ceil(totalCommands / COMMANDS_PER_PAGE);
      const currentPage = commandTablePage + 1;

      if (totalPages <= 1) {
        paginationEl.innerHTML = "";
        return;
      }

      paginationEl.innerHTML = `
      <div class="pagination-info">
        Showing ${commandTablePage * COMMANDS_PER_PAGE + 1}-${Math.min(
        (commandTablePage + 1) * COMMANDS_PER_PAGE,
        totalCommands
      )} of ${totalCommands} commands
      </div>
      <div class="pagination-controls">
        <button class="pagination-btn" data-action="prev" ${
          commandTablePage === 0 ? "disabled" : ""
        }>← Previous</button>
        <span>Page ${currentPage} of ${totalPages}</span>
        <button class="pagination-btn" data-action="next" ${
          commandTablePage >= totalPages - 1 ? "disabled" : ""
        }>Next →</button>
      </div>
    `;

      // Add event listeners for pagination buttons (CSP compliant)
      paginationEl.addEventListener("click", (e) => {
        const target = e.target as HTMLElement;
        if (
          target?.classList.contains("pagination-btn") &&
          !(target as HTMLButtonElement).disabled
        ) {
          const action = target.getAttribute("data-action");
          if (action === "prev") {
            window.prevCommandPage();
          } else if (action === "next") {
            window.nextCommandPage();
          }
        }
      });
    }

    function updateSortIndicators() {
      // Remove existing sort indicators
      document.querySelectorAll(".sort-indicator").forEach((el) => el.remove());

      // Add current sort indicator
      const headers = document.querySelectorAll("th[data-sort]");
      headers.forEach((header) => {
        if ((header as HTMLElement).dataset.sort === commandTableSort.column) {
          const indicator = document.createElement("span");
          indicator.className = "sort-indicator";
          indicator.textContent =
            commandTableSort.direction === "asc" ? " ↑" : " ↓";
          header.appendChild(indicator);
        }
      });
    }

    // Global functions for pagination with boundary checks
    window.nextCommandPage = function (): void {
      if (!lastData || !lastData.perCommand) return;

      const totalPages = Math.ceil(
        lastData.perCommand.length / COMMANDS_PER_PAGE
      );

      // Boundary check: don't go beyond last page
      if (commandTablePage < totalPages - 1) {
        commandTablePage++;
        renderCommandTable(lastData.perCommand, lastData.runs);
      }
    };

    window.prevCommandPage = function (): void {
      if (!lastData || !lastData.perCommand) return;

      // Boundary check: don't go below page 0
      if (commandTablePage > 0) {
        commandTablePage--;
        renderCommandTable(lastData.perCommand, lastData.runs);
      }
    };

    window.sortCommandTable = function (column: string): void {
      console.log("sortCommandTable called with column:", column);
      console.log("Current sort state BEFORE:", commandTableSort);

      if (commandTableSort.column === column) {
        commandTableSort.direction =
          commandTableSort.direction === "asc" ? "desc" : "asc";
      } else {
        commandTableSort.column = column;
        commandTableSort.direction = "desc";
      }

      console.log("Current sort state AFTER:", commandTableSort);
      console.log("Current data length:", currentCommandData.length);

      commandTablePage = 0; // Reset to first page

      // Use current filtered data instead of state
      if (lastData && lastData.perCommand && lastData.runs) {
        renderCommandTable(lastData.perCommand, lastData.runs);
      }
    };

    // Global function to run a command
    window.runCommand = function (command: string): void {
      vscode.postMessage({
        type: "RUN_COMMAND",
        command: command,
      });
    };

    // Global function to filter recent runs by command
    window.filterByCommand = function (command: string): void {
      currentCommandFilter = command;
      if (lastData && lastData.runs) {
        renderRecentRuns(lastData.runs);
      }
    };

    // Global function to filter recent runs by failed status
    window.filterByFailed = function (command: string): void {
      currentCommandFilter = command;
      currentFailedFilter = true;
      if (lastData && lastData.runs) {
        renderRecentRuns(lastData.runs);
      }
    };

    function setupTimeRangeDropdown() {
      const display = document.getElementById("timeRangeDisplay");
      const dropdown = document.getElementById("timeRangeDropdown");

      if (!display || !dropdown) {
        console.log("Time range elements not found, skipping setup");
        return;
      }

      // Toggle dropdown on display click
      display.addEventListener("click", function (e) {
        e.stopPropagation();

        // Close other dropdowns
        document.querySelectorAll(".multi-select-dropdown").forEach((dd) => {
          dd.classList.add("element-hidden");
        });

        // Toggle time range dropdown
        dropdown.classList.toggle("element-hidden");
      });

      // Handle time range option clicks
      dropdown.addEventListener("click", function (e) {
        const target = e.target as HTMLElement;
        if (!target) return;
        const option = target.closest(".time-range-option");
        if (option) {
          // Remove previous selection
          dropdown.querySelectorAll(".time-range-option").forEach((opt) => {
            opt.removeAttribute("data-selected");
          });

          // Mark new selection
          option.setAttribute("data-selected", "true");

          // Update display text
          display.textContent = option.textContent;

          // Update current filter
          const value = option.getAttribute("data-value");
          if (value) currentFilters.window = value;

          // Close dropdown
          dropdown.classList.add("element-hidden");

          // Update filters
          updateFilters();
        }
      });

      // Handle custom date range
      const applyBtn = document.getElementById("applyCustomRange");
      const fromDate = document.getElementById("customFromDate");
      const toDate = document.getElementById("customToDate");

      if (applyBtn && fromDate && toDate) {
        applyBtn.addEventListener("click", function () {
          const from = (fromDate as HTMLInputElement).value;
          const to = (toDate as HTMLInputElement).value;

          if (from && to) {
            // Remove previous selection
            dropdown.querySelectorAll(".time-range-option").forEach((opt) => {
              opt.removeAttribute("data-selected");
            });

            // Update display with custom range
            const fromFormatted = new Date(from).toLocaleDateString();
            const toFormatted = new Date(to).toLocaleDateString();
            display.textContent = `${fromFormatted} - ${toFormatted}`;

            // Set custom filter
            currentFilters.window = "custom";
            currentFilters.customFrom = from;
            currentFilters.customTo = to;

            // Close dropdown
            dropdown.classList.add("element-hidden");

            // Update filters
            updateFilters();
          }
        });
      }

      // Prevent dropdown close when clicking inside
      dropdown.addEventListener("click", function (e) {
        e.stopPropagation();
      });

      // Close dropdown when clicking outside
      document.addEventListener("click", function () {
        dropdown.classList.add("element-hidden");
      });
    }

    function setDeviceIconColors() {
      // Set background colors for device icons using CSS custom properties
      document
        .querySelectorAll(
          ".device-icon[data-device-color], .device-icon-small[data-device-color]"
        )
        .forEach((icon) => {
          const color = icon.getAttribute("data-device-color");
          if (color) {
            (icon as HTMLElement).style.setProperty("--device-color", color);
          }
        });
    }

    function renderRecentRuns(runs: EventRecord[]) {
      const container = document.getElementById("recentRuns");
      if (!container) return;

      container.innerHTML = "";

      if (runs.length === 0) {
        container.innerHTML =
          '<div class="empty-state">No recent runs to display</div>';
        return;
      }

      runs.reverse().forEach((run: EventRecord, index: number) => {
        const item = document.createElement("div");
        item.className = "run-item";

        const success = run.success;
        const relativeTime = getRelativeTime(run.tsEnd);

        // Calculate trend indicator (compare with previous run of same command)
        let trendIndicator = "";
        if (index < runs.length - 1) {
          const previousRuns = runs.slice(index + 1);
          const previousSameCommand = previousRuns.find(
            (prevRun: EventRecord) => prevRun.command === run.command
          );

          if (previousSameCommand) {
            const currentDuration = run.durationMs;
            const previousDuration = previousSameCommand.durationMs;
            const tolerance = 0.1; // 10% tolerance
            const percentChange =
              (currentDuration - previousDuration) / previousDuration;

            if (percentChange > tolerance) {
              trendIndicator =
                '<span class="trend-up" title="Slower than last run">⬆️</span>';
            } else if (percentChange < -tolerance) {
              trendIndicator =
                '<span class="trend-down" title="Faster than last run">⬇️</span>';
            } else {
              trendIndicator =
                '<span class="trend-same" title="Similar to last run">➡️</span>';
            }
          }
        }

        const deviceInfo = getDeviceInfo(run);

        item.innerHTML = `
        <span class="run-status ${success ? "success" : "fail"}">
          ${success ? "✅" : "❌"}
        </span>
        <span class="run-command" title="${run.command}">
          ${run.command}${trendIndicator}
        </span>
        <span class="run-duration">
          ${formatDuration(Math.round(run.durationMs))}
        </span>
        <span class="run-time">
          ${relativeTime}
        </span>
        <span class="run-device">
          <span class="device-icon" title="${
            deviceInfo.tooltip
          }" data-device-color="${deviceInfo.color}" data-tooltip="${
          deviceInfo.tooltip
        }">
            ${deviceInfo.icon}
          </span>
                     <button class="delete-run-btn" data-run-id="${run.tsEnd}-${
          run.command
        }" title="Delete this run (cannot be undone)">🗑️</button>
        </span>
      `;

        if (container) container.appendChild(item);
      });
    }

    function getRelativeTime(timestamp: number) {
      const now = Date.now();
      const diff = now - timestamp;

      if (diff < 60000) return "just now";
      if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
      if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
      return `${Math.floor(diff / 86400000)}d ago`;
    }

    function getDeviceColor(deviceId: string) {
      // Generate a consistent color for each device ID
      let hash = 0;
      for (let i = 0; i < deviceId.length; i++) {
        hash = deviceId.charCodeAt(i) + ((hash << 5) - hash);
      }
      const hue = Math.abs(hash % 360);
      return `hsl(${hue}, 45%, 60%)`;
    }

    function getDeviceInfo(run: EventRecord) {
      const deviceId = run.deviceId;
      const device = (run as any).device; // Device info may not be in EventRecord interface

      // Generate consistent color for device
      const color = getDeviceColor(deviceId);

      // Determine icon and OS info based on OS
      let icon = "💻"; // Default computer icon (emoji fallback)
      let nerdFontIcon = "\uF109"; // Default Nerd Font computer icon (nf-fa-desktop)
      let osName = "Unknown";
      let osVersion = "";

      if (device && device.os) {
        const os = device.os.toLowerCase();

        if (os.includes("darwin") || os.includes("mac")) {
          // macOS detection - use Nerd Font Apple logo
          nerdFontIcon = "\uF179"; // Nerd Font Apple logo (nf-fa-apple)
          icon = "🍎"; // Emoji fallback
          osName = "macOS";

          // Try to extract macOS version from OS string
          const versionMatch =
            device.os.match(/darwin\s*(\d+\.\d+)/i) ||
            device.os.match(/(\d+\.\d+\.\d+)/);
          if (versionMatch) {
            osVersion = versionMatch[1];
            // Convert Darwin version to macOS version if needed
            const darwinVersion = parseFloat(versionMatch[1]);
            if (darwinVersion >= 23) osVersion = "14"; // Sonoma
            else if (darwinVersion >= 22) osVersion = "13"; // Ventura
            else if (darwinVersion >= 21) osVersion = "12"; // Monterey
            else if (darwinVersion >= 20) osVersion = "11"; // Big Sur
            else if (darwinVersion >= 19) osVersion = "10.15"; // Catalina
          }
        } else if (os.includes("win")) {
          // Windows detection - use Nerd Font Windows logo
          nerdFontIcon = "\uF17A"; // Nerd Font Windows logo (nf-fa-windows)
          icon = "🪟"; // Emoji fallback (window)
          osName = "Windows";

          // Try to extract Windows version
          const versionMatch =
            device.os.match(/windows\s*(\d+)/i) || device.os.match(/win(\d+)/i);
          if (versionMatch) {
            osVersion = versionMatch[1];
            if (osVersion === "10") {
              osName = "Windows 10";
            } else if (osVersion === "11") {
              osName = "Windows 11";
            }
          }
        } else if (os.includes("linux")) {
          // Linux detection with distro-specific Nerd Font icons
          if (os.includes("ubuntu")) {
            nerdFontIcon = "\uF31B"; // Nerd Font Ubuntu logo (nf-linux-ubuntu)
            icon = "🟠"; // Orange circle for Ubuntu
            osName = "Ubuntu";
          } else if (os.includes("debian")) {
            nerdFontIcon = "\uF306"; // Nerd Font Debian logo (nf-linux-debian)
            icon = "🌀"; // Spiral for Debian
            osName = "Debian";
          } else if (os.includes("fedora")) {
            nerdFontIcon = "\uF30A"; // Nerd Font Fedora logo (nf-linux-fedora)
            icon = "🎩"; // Hat for Fedora
            osName = "Fedora";
          } else if (os.includes("arch")) {
            nerdFontIcon = "\uF303"; // Nerd Font Arch logo (nf-linux-archlinux)
            icon = "🏔️"; // Mountain for Arch
            osName = "Arch Linux";
          } else if (os.includes("centos")) {
            nerdFontIcon = "\uF304"; // Nerd Font CentOS logo (nf-linux-centos)
            icon = "🔴"; // Red circle for CentOS
            osName = "CentOS";
          } else if (os.includes("rhel")) {
            nerdFontIcon = "\uF316"; // Nerd Font Red Hat logo (nf-linux-redhat)
            icon = "🔴"; // Red circle for RHEL
            osName = "RHEL";
          } else if (os.includes("suse") || os.includes("opensuse")) {
            nerdFontIcon = "\uF314"; // Nerd Font SUSE logo (nf-linux-opensuse)
            icon = "🟢"; // Green circle for SUSE
            osName = "SUSE";
          } else if (os.includes("mint")) {
            nerdFontIcon = "\uF30E"; // Nerd Font Linux Mint logo (nf-linux-mint)
            icon = "🌿"; // Leaf for Mint
            osName = "Linux Mint";
          } else if (os.includes("manjaro")) {
            nerdFontIcon = "\uF312"; // Nerd Font Manjaro logo (nf-linux-manjaro)
            icon = "🟢"; // Green circle for Manjaro
            osName = "Manjaro";
          } else if (os.includes("alpine")) {
            nerdFontIcon = "\uF300"; // Nerd Font Alpine logo (nf-linux-alpine)
            icon = "⛰️"; // Mountain for Alpine
            osName = "Alpine";
          } else {
            nerdFontIcon = "\uF17C"; // Nerd Font generic Linux logo (nf-fa-linux)
            icon = "🐧"; // Penguin for generic Linux
            osName = "Linux";
          }

          // Try to extract Linux version
          const versionMatch = device.os.match(/(\d+\.\d+)/);
          if (versionMatch) {
            osVersion = versionMatch[1];
          }
        }
      }

      // Create detailed tooltip with device info
      let tooltip = deviceId.slice(0, 8) + "...";
      if (device) {
        tooltip = `${osName}${osVersion ? " " + osVersion : ""} • ${
          device.arch
        }`;
        if (device.cpuModel) {
          // Clean up CPU model name
          const cleanCpu = device.cpuModel.replace(/\s+/g, " ").trim();
          tooltip += ` • ${cleanCpu}`;
        }
        if (device.cpus) {
          tooltip += ` • ${device.cpus}-core`;
        }
        if (device.memGB) {
          tooltip += ` • ${device.memGB}GB`;
        }
        tooltip += ` • ${deviceId.slice(0, 8)}...`;
      }

      return {
        icon: nerdFontIcon || icon, // Try Nerd Font first, fallback to emoji
        color,
        tooltip,
        osName,
        osVersion,
      };
    }

    function getCommandDeviceIcons(command: string, runs: any[] = []) {
      // Find all unique devices that ran this command
      const commandRuns = runs.filter((run) => run.command === command);
      const uniqueDevices = new Map();

      commandRuns.forEach((run) => {
        if (!uniqueDevices.has(run.deviceId)) {
          uniqueDevices.set(run.deviceId, run);
        }
      });

      // Generate icons for each device (limit to 3 to avoid clutter)
      const deviceArray = Array.from(uniqueDevices.values()).slice(0, 3);
      const icons = deviceArray.map((run) => {
        const deviceInfo = getDeviceInfo(run);
        return `<span class="device-icon-small" title="${deviceInfo.tooltip}" data-device-color="${deviceInfo.color}" data-tooltip="${deviceInfo.tooltip}">${deviceInfo.icon}</span>`;
      });

      // Add "more" indicator if there are additional devices
      if (uniqueDevices.size > 3) {
        icons.push(
          `<span class="device-more" title="${
            uniqueDevices.size - 3
          } more devices">+${uniqueDevices.size - 3}</span>`
        );
      }

      return icons.join("");
    }

    function showEmptyState(filters: any = {}) {
      // Hide loading and show empty state using CSS classes (CSP-compliant)
      document.querySelector(".loading")?.classList.add("element-hidden");
      document.querySelector(".cards")?.classList.add("element-hidden");
      document
        .querySelector(".empty-state")
        ?.classList.remove("element-hidden");

      // Hide global stats when empty
      document.querySelector(".global-stats")?.classList.add("element-hidden");

      // Update empty state message based on filters
      const emptyStateEl = document.querySelector(".empty-state");
      if (emptyStateEl) {
        let message = "";
        let suggestion = "";

        // Check if it's due to time range filtering
        if (
          filters.window === "custom" &&
          filters.customFrom &&
          filters.customTo
        ) {
          const fromDate = new Date(filters.customFrom).toLocaleDateString();
          const toDate = new Date(filters.customTo).toLocaleDateString();
          message = `📅 No data found in the selected time range: ${fromDate} - ${toDate}`;
          suggestion =
            "Try selecting a different date range or check if you have any commands recorded during this period.";
        } else if (
          filters.window &&
          filters.window !== "all" &&
          filters.window !== "7d"
        ) {
          const timeLabels = {
            "1h": "last hour",
            "24h": "last 24 hours",
            "30d": "last 30 days",
            "90d": "last 3 months",
            "1y": "last year",
          };
          const timeLabel =
            (timeLabels as any)[filters.window] || filters.window;
          message = `⏰ No commands recorded in the ${timeLabel}`;
          suggestion =
            "Try expanding the time range or run some commands to start tracking performance.";
        } else if (hasActiveFilters(filters)) {
          message = "🔍 No data matches your current filters";
          suggestion =
            "Try adjusting your filters (Project, Command, Success, or Device) to see more data.";
        } else {
          // Default empty state (no data at all)
          message = "👋 Welcome to ProcessLens!";
          suggestion =
            "Start tracking your command execution times to identify performance trends and bottlenecks.";
        }

        // Update the empty state content
        emptyStateEl.innerHTML = `
        <div class="welcome-message">
          <h2>${message}</h2>
          <p>${suggestion}</p>
          <div class="getting-started">
            <h3>Getting Started:</h3>
            <ol>
              <li>Click <strong>"ProcessLens: Run"</strong> in the Command Palette</li>
              <li>Select a package.json script or enter a custom command</li>
              <li>Watch the dashboard populate with performance data!</li>
            </ol>
            <p class="tip">💡 <strong>Tip:</strong> You can also browse your shell history or run package.json scripts!</p>
          </div>
        </div>
      `;
      }
    }

    function hasActiveFilters(filters: any) {
      return (
        (filters.projectId && filters.projectId.length > 0) ||
        (filters.command && filters.command.length > 0) ||
        (filters.success && filters.success !== "all") ||
        (filters.deviceInstance && filters.deviceInstance.length > 0)
      );
    }

    function rerenderActiveChartTab() {
      const activeTab = document.querySelector(".chart-tab.active");
      if (!activeTab || !lastData) return;

      const targetTab = activeTab.getAttribute("data-tab");

      // Render the active chart with current filtered data
      if (targetTab === "heatmap") {
        renderHeatmap(lastData.runs);
      } else if (targetTab === "performance") {
        renderPerformanceMatrix(lastData.perCommand);
      }
      // Timeline chart is handled by the main chart rendering in renderData()
    }

    function setupChartTabs() {
      const tabs = document.querySelectorAll(".chart-tab");
      const views = document.querySelectorAll(".chart-view");

      tabs.forEach((tab) => {
        tab.addEventListener("click", () => {
          const targetTab = tab.getAttribute("data-tab");

          // Update active tab
          tabs.forEach((t) => t.classList.remove("active"));
          tab.classList.add("active");

          // Update active view
          views.forEach((view) => {
            view.classList.remove("active");
            view.classList.add("element-hidden");
          });

          const targetView = document.getElementById(`${targetTab}Chart`);
          if (targetView) {
            targetView.classList.add("active");
            targetView.classList.remove("element-hidden");

            // Render specific chart type
            if (targetTab === "heatmap" && lastData) {
              renderHeatmap(lastData.runs);
            } else if (targetTab === "performance" && lastData) {
              renderPerformanceMatrix(lastData.perCommand);
            }
          }
        });
      });
    }

    function renderHeatmap(runs: any[]) {
      const heatmapGrid = document.getElementById("heatmapGrid");
      const heatmapMonths = document.getElementById("heatmapMonths");
      if (!heatmapGrid || !runs || runs.length === 0) return;

      // Clear existing content
      heatmapGrid.innerHTML = "";
      if (heatmapMonths) heatmapMonths.innerHTML = "";

      // Update year navigation
      updateYearNavigationVisibility();
      updateYearDropdown();

      // Check if we have active time filters that should override the default 365-day view
      const hasTimeFilter =
        currentFilters.window && currentFilters.window !== "all";

      let startDate, endDate, gridStartDate;

      if (hasTimeFilter) {
        // Use filter-based date range for short time periods
        const now = Date.now();
        let cutoff;

        if (
          currentFilters.window === "custom" &&
          currentFilters.customFrom &&
          currentFilters.customTo
        ) {
          // Custom date range
          startDate = new Date(currentFilters.customFrom);
          endDate = new Date(currentFilters.customTo);
          startDate.setHours(0, 0, 0, 0);
          endDate.setHours(23, 59, 59, 999);
        } else {
          // Predefined time windows
          switch (currentFilters.window) {
            case "1h":
              cutoff = now - 60 * 60 * 1000;
              break;
            case "24h":
              cutoff = now - 24 * 60 * 60 * 1000;
              break;
            case "7d":
              cutoff = now - 7 * 24 * 60 * 60 * 1000;
              break;
            case "30d":
              cutoff = now - 30 * 24 * 60 * 60 * 1000;
              break;
            case "90d":
              cutoff = now - 90 * 24 * 60 * 60 * 1000;
              break;
            case "1y":
              cutoff = now - 365 * 24 * 60 * 60 * 1000;
              break;
            default:
              cutoff = now - 7 * 24 * 60 * 60 * 1000; // Default to 7 days
          }

          startDate = new Date(cutoff);
          endDate = new Date(now);
          startDate.setHours(0, 0, 0, 0);
          endDate.setHours(23, 59, 59, 999);
        }

        // For short periods (< 30 days), find the Monday that starts our grid
        const dayRange = Math.ceil(
          (endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)
        );
        if (dayRange <= 30) {
          gridStartDate = new Date(startDate);
          const dayOfWeek = gridStartDate.getDay();
          // Adjust to Monday: if Sunday (0), go back 6 days; otherwise go back (dayOfWeek - 1) days
          const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
          gridStartDate.setDate(gridStartDate.getDate() - daysToMonday);
          gridStartDate.setHours(0, 0, 0, 0);
        } else {
          // For longer periods, use standard GitHub-style grid (Monday-first)
          gridStartDate = new Date(startDate);
          const dayOfWeek = gridStartDate.getDay();
          // Adjust to Monday: if Sunday (0), go back 6 days; otherwise go back (dayOfWeek - 1) days
          const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
          gridStartDate.setDate(gridStartDate.getDate() - daysToMonday);
          gridStartDate.setHours(0, 0, 0, 0);
        }
      } else {
        // Default GitHub-style 365-day view for selected year
        if (currentHeatmapYear === new Date().getFullYear()) {
          // Current year: show up to today
          const today = new Date();
          endDate = new Date(today);
          endDate.setHours(23, 59, 59, 999);

          startDate = new Date(endDate);
          startDate.setDate(startDate.getDate() - 364); // 365 days total including today
          startDate.setHours(0, 0, 0, 0);
        } else {
          // Past year: show full year
          startDate = new Date(currentHeatmapYear, 0, 1); // January 1st
          endDate = new Date(currentHeatmapYear, 11, 31, 23, 59, 59, 999); // December 31st
        }

        gridStartDate = new Date(startDate);
        const dayOfWeek = gridStartDate.getDay();
        // Adjust to Monday: if Sunday (0), go back 6 days; otherwise go back (dayOfWeek - 1) days
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        gridStartDate.setDate(gridStartDate.getDate() - daysToMonday);
        gridStartDate.setHours(0, 0, 0, 0);
      }

      // Group runs by date
      const runsByDate = new Map();
      runs.forEach((run: any) => {
        const date = new Date(run.tsEnd);
        const dateKey = date.toISOString().split("T")[0]; // YYYY-MM-DD
        if (!runsByDate.has(dateKey)) {
          runsByDate.set(dateKey, []);
        }
        runsByDate.get(dateKey).push(run);
      });

      // Debug: Log data for recent dates
      console.log("Heatmap debug - Date range:", {
        startDate: startDate.toISOString().split("T")[0],
        endDate: endDate.toISOString().split("T")[0],
        gridStartDate: gridStartDate.toISOString().split("T")[0],
        totalRuns: runs.length,
        datesWithData: Array.from(runsByDate.keys()).sort().slice(-7), // Last 7 dates with data
      });

      // Find max runs per day for scaling
      const maxRunsPerDay = Math.max(
        ...Array.from(runsByDate.values()).map((dayRuns) => dayRuns.length),
        1
      );

      // Calculate number of weeks needed based on date range
      const totalDays = Math.ceil(
        (endDate.getTime() - gridStartDate.getTime()) / (24 * 60 * 60 * 1000)
      );
      const weeksNeeded = Math.ceil(totalDays / 7);
      const maxWeeks =
        hasTimeFilter && currentFilters.window !== "1y"
          ? Math.min(weeksNeeded, 53)
          : 53;

      // Generate grid: dynamic weeks × 7 days
      // Grid layout: each column is a week, each row is a day of week (Mon-Sun)
      const cells = [];
      const monthLabels = [];
      let currentDate = new Date(gridStartDate);

      // Generate all cells first
      for (let week = 0; week < maxWeeks; week++) {
        const weekCells = [];
        const weekStartDate = new Date(currentDate);

        // Generate cells for the week (Monday-first due to gridStartDate adjustment)
        for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
          const dateKey = currentDate.toISOString().split("T")[0];
          const dayRuns = runsByDate.get(dateKey) || [];
          const runCount = dayRuns.length;

          // Only show data for dates within our actual range
          const isInRange = currentDate >= startDate && currentDate <= endDate;
          const actualRunCount = isInRange ? runCount : 0;

          // Calculate intensity (0-4 levels)
          const intensity =
            actualRunCount === 0
              ? 0
              : Math.min(4, Math.ceil((actualRunCount / maxRunsPerDay) * 4));

          const cell = document.createElement("div");
          cell.className = `heatmap-cell level-${intensity}`;

          cell.setAttribute("data-date", dateKey);
          cell.setAttribute("data-runs", actualRunCount);
          cell.setAttribute(
            "data-day",
            currentDate.toLocaleDateString("en-US", { weekday: "long" })
          );

          // Add time range highlighting based on current filters
          addTimeRangeHighlighting(cell, currentDate);

          // Always add tooltips, even for dates outside range (they'll show 0 runs)
          cell.addEventListener("mouseenter", (e) => {
            showHeatmapTooltip(e, dateKey, actualRunCount, dayRuns);
          });

          cell.addEventListener("mouseleave", () => {
            hideHeatmapTooltip();
          });

          // Add click handler for day filtering
          cell.addEventListener("click", () => {
            handleHeatmapDayClick(dateKey, cell);
          });

          weekCells.push(cell);
          currentDate.setDate(currentDate.getDate() + 1);
        }

        cells.push(weekCells);

        // Track month labels - GitHub style (first occurrence of each month)
        if (week === 0) {
          // Always add first week's month
          monthLabels.push({
            week: week,
            month: weekStartDate.getMonth(),
            year: weekStartDate.getFullYear(),
          });
        } else {
          // Check if month changed from previous week
          const prevWeekDate = new Date(
            gridStartDate.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000
          );
          if (weekStartDate.getMonth() !== prevWeekDate.getMonth()) {
            monthLabels.push({
              week: week,
              month: weekStartDate.getMonth(),
              year: weekStartDate.getFullYear(),
            });
          }
        }
      }

      // Add all cells to the grid
      cells.forEach((weekCells) => {
        weekCells.forEach((cell) => {
          heatmapGrid.appendChild(cell);
        });
      });

      // Generate month labels based on tracked positions
      if (heatmapMonths) {
        const monthNames = [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ];
        heatmapMonths.innerHTML = "";

        // Create 53 week slots
        for (let week = 0; week < 53; week++) {
          const monthLabel = document.createElement("div");

          // Find if this week starts a new month
          const monthPos = monthLabels.find((ml) => ml.week === week);
          if (monthPos) {
            monthLabel.textContent = monthNames[monthPos.month];
          }

          heatmapMonths.appendChild(monthLabel);
        }
      }

      // Add year label (GitHub-style)
      const heatmapYear = document.getElementById("heatmapYear");
      if (heatmapYear) {
        const endYear = endDate.getFullYear();
        const startYear = startDate.getFullYear();

        // If the range spans two years, show both
        if (startYear !== endYear) {
          heatmapYear.textContent = `${startYear}-${endYear}`;
        } else {
          heatmapYear.textContent = endYear.toString();
        }
      }

      // Remove week labels for now - they were causing confusion
      const heatmapXLabels = document.getElementById("heatmapXLabels");
      if (heatmapXLabels) {
        heatmapXLabels.innerHTML = "";
      }
    }

    function showHeatmapTooltip(
      event: any,
      date: string,
      runCount: number,
      runs: any[]
    ) {
      const tooltip = document.getElementById("heatmapTooltip");
      if (!tooltip) return;

      const formattedDate = new Date(date).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      let content = `<strong>${formattedDate}</strong><br/>`;
      if (runCount === 0) {
        content += "No commands executed";
      } else {
        content += `${runCount} command${runCount === 1 ? "" : "s"} executed`;
        if (runs.length > 0) {
          const totalTime = runs.reduce(
            (sum: number, run: any) => sum + run.durationMs,
            0
          );
          content += `<br/>Total time: ${formatDuration(totalTime)}`;
        }
      }

      tooltip.innerHTML = content;
      tooltip.classList.remove("element-hidden");

      // Position tooltip
      const rect = event.target.getBoundingClientRect();
      const scrollTop =
        window.pageYOffset || document.documentElement.scrollTop;
      const scrollLeft =
        window.pageXOffset || document.documentElement.scrollLeft;

      tooltip.style.left =
        rect.left +
        scrollLeft +
        rect.width / 2 -
        tooltip.offsetWidth / 2 +
        "px";
      tooltip.style.top =
        rect.top + scrollTop - tooltip.offsetHeight - 8 + "px";
    }

    function hideHeatmapTooltip() {
      const tooltip = document.getElementById("heatmapTooltip");
      if (tooltip) {
        tooltip.classList.add("element-hidden");
      }
    }

    // Global variables for heatmap day selection (declared at top)

    function handleHeatmapDayClick(
      dateKey: string,
      cellElement: HTMLElement
    ): void {
      // If clicking the same day, reset to previous state
      if (selectedHeatmapDay === dateKey) {
        resetHeatmapDayFilter();
        return;
      }

      // Store previous filters state for reset
      previousFiltersState = {
        window: currentFilters.window,
        customFrom: currentFilters.customFrom,
        customTo: currentFilters.customTo,
      };

      // Update selected day
      selectedHeatmapDay = dateKey;

      // Remove previous selection styling
      document.querySelectorAll(".heatmap-cell.selected").forEach((cell) => {
        cell.classList.remove("selected");
      });

      // Add selection styling to clicked cell
      cellElement.classList.add("selected");

      // Set custom date range for the selected day
      const selectedDate = new Date(dateKey);
      const dateStr = selectedDate.toISOString().split("T")[0];

      currentFilters.window = "custom";
      currentFilters.customFrom = dateStr;
      currentFilters.customTo = dateStr;

      // Update the time range dropdown UI to reflect custom selection
      updateTimeRangeDropdownForDay(dateStr);

      // Apply filters and refresh data
      isHeatmapFilterUpdate = true;
      updateFilters();
      isHeatmapFilterUpdate = false;
    }

    function resetHeatmapDayFilter() {
      // Clear selection
      selectedHeatmapDay = null;
      document.querySelectorAll(".heatmap-cell.selected").forEach((cell) => {
        cell.classList.remove("selected");
      });

      // Restore previous filters state
      if (previousFiltersState) {
        currentFilters.window = previousFiltersState.window || "7d";
        currentFilters.customFrom = previousFiltersState.customFrom;
        currentFilters.customTo = previousFiltersState.customTo;
        previousFiltersState = null;
      } else {
        // Default fallback
        currentFilters.window = "7d";
        currentFilters.customFrom = undefined;
        currentFilters.customTo = undefined;
      }

      // Update the time range display and dropdown
      resetTimeRangeDropdown();

      // Apply filters and refresh data
      isHeatmapFilterUpdate = true;
      updateFilters();
      isHeatmapFilterUpdate = false;
    }

    function updateTimeRangeDisplay(selectedDate = null) {
      const display = document.querySelector(".time-range-display");
      if (!display) return;

      if (selectedDate) {
        // Format the selected date nicely
        const date = new Date(selectedDate);
        const formattedDate = date.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
        display.textContent = `📅 ${formattedDate}`;
      } else {
        // Reset to current filter display
        const windowLabels = {
          "1h": "Last 1 hour",
          "24h": "Last 24 hours",
          "7d": "Last 7 days",
          "30d": "Last 30 days",
          "90d": "Last 90 days",
          "1y": "Last 1 year",
          all: "All time",
          custom: "Custom range",
        };
        display.textContent =
          (windowLabels as any)[currentFilters.window] || "Last 7 days";
      }
    }

    function updateTimeRangeDropdownForDay(dateStr: string) {
      const display = document.getElementById("timeRangeDisplay");
      const dropdown = document.getElementById("timeRangeDropdown");
      const fromDate = document.getElementById("customFromDate");
      const toDate = document.getElementById("customToDate");

      if (!display || !dropdown) return;

      // Format the date for display
      const date = new Date(dateStr);
      const formattedDate = date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });

      // Update the main display to show the selected day
      display.textContent = `📅 ${formattedDate}`;

      // Remove selection from all time range options
      dropdown.querySelectorAll(".time-range-option").forEach((opt) => {
        opt.removeAttribute("data-selected");
      });

      // Populate the custom date inputs with the same date
      if (fromDate && toDate) {
        (fromDate as HTMLInputElement).value = dateStr;
        (toDate as HTMLInputElement).value = dateStr;
      }

      // Mark custom range as selected (if there's a custom option)
      const customOption = dropdown.querySelector('[data-value="custom"]');
      if (customOption) {
        customOption.setAttribute("data-selected", "true");
      }
    }

    function resetTimeRangeDropdown() {
      const display = document.getElementById("timeRangeDisplay");
      const dropdown = document.getElementById("timeRangeDropdown");
      const fromDate = document.getElementById("customFromDate");
      const toDate = document.getElementById("customToDate");

      if (!display || !dropdown) return;

      // Clear custom date inputs
      if (fromDate) (fromDate as HTMLInputElement).value = "";
      if (toDate) (toDate as HTMLInputElement).value = "";

      // Remove selection from all options
      dropdown.querySelectorAll(".time-range-option").forEach((opt) => {
        opt.removeAttribute("data-selected");
      });

      // Find and select the option that matches current filter
      const currentOption = dropdown.querySelector(
        `[data-value="${currentFilters.window}"]`
      );
      if (currentOption) {
        currentOption.setAttribute("data-selected", "true");
        display.textContent = currentOption.textContent;
      } else {
        // Fallback to default
        const defaultOption = dropdown.querySelector('[data-value="7d"]');
        if (defaultOption) {
          defaultOption.setAttribute("data-selected", "true");
          display.textContent = defaultOption.textContent;
        }
      }
    }

    function addTimeRangeHighlighting(cell: HTMLElement, cellDate: Date) {
      // Don't highlight if no specific time filter is active
      if (!currentFilters.window || currentFilters.window === "all") {
        return;
      }

      // Calculate the filter's date range
      const now = new Date();
      let filterStartDate, filterEndDate;

      if (
        currentFilters.window === "custom" &&
        currentFilters.customFrom &&
        currentFilters.customTo
      ) {
        // Custom date range
        filterStartDate = new Date(currentFilters.customFrom);
        filterEndDate = new Date(currentFilters.customTo);
        filterStartDate.setHours(0, 0, 0, 0);
        filterEndDate.setHours(23, 59, 59, 999);
      } else {
        // Predefined time windows
        let cutoff;
        switch (currentFilters.window) {
          case "1h":
            cutoff = now.getTime() - 60 * 60 * 1000;
            break;
          case "24h":
            cutoff = now.getTime() - 24 * 60 * 60 * 1000;
            break;
          case "7d":
            cutoff = now.getTime() - 7 * 24 * 60 * 60 * 1000;
            break;
          case "30d":
            cutoff = now.getTime() - 30 * 24 * 60 * 60 * 1000;
            break;
          case "90d":
            cutoff = now.getTime() - 90 * 24 * 60 * 60 * 1000;
            break;
          case "1y":
            cutoff = now.getTime() - 365 * 24 * 60 * 60 * 1000;
            break;
          default:
            return; // Unknown filter, don't highlight
        }

        filterStartDate = new Date(cutoff);
        filterEndDate = new Date(now);
        filterStartDate.setHours(0, 0, 0, 0);
        filterEndDate.setHours(23, 59, 59, 999);
      }

      // Check if cell date is within filter range
      const cellDateStart = new Date(cellDate);
      cellDateStart.setHours(0, 0, 0, 0);

      const isInFilterRange =
        cellDateStart >= filterStartDate && cellDateStart <= filterEndDate;

      if (isInFilterRange) {
        cell.classList.add("in-range");
      } else {
        cell.classList.add("out-of-range");
      }
    }

    // Global variable for heatmap year (declared above)

    function setupHeatmapYearNavigation() {
      const yearNav = document.getElementById("heatmapYearNav");
      const yearSelect = document.getElementById("heatmapYearSelect");
      const prevBtn = document.getElementById("heatmapPrevYear");
      const nextBtn = document.getElementById("heatmapNextYear");

      if (!yearNav || !yearSelect || !prevBtn || !nextBtn) return;

      // Populate year dropdown with available years (based on data)
      updateYearDropdown();

      // Year select change handler
      yearSelect.addEventListener("change", (e) => {
        const target = e.target as HTMLSelectElement;
        const newYear = parseInt(target.value);
        if (!isNaN(newYear) && newYear > 1900 && newYear < 3000) {
          currentHeatmapYear = newYear;
          if (lastData && lastData.runs) {
            renderHeatmap(lastData.runs);
          }
        }
      });

      // Previous year button
      prevBtn.addEventListener("click", () => {
        if (!(prevBtn as HTMLButtonElement).disabled) {
          currentHeatmapYear--;
          (yearSelect as HTMLSelectElement).value =
            currentHeatmapYear.toString();
          updateYearDropdown();
          if (lastData && lastData.runs) {
            renderHeatmap(lastData.runs);
          }
        }
      });

      // Next year button
      nextBtn.addEventListener("click", () => {
        if (!(nextBtn as HTMLButtonElement).disabled) {
          currentHeatmapYear++;
          (yearSelect as HTMLSelectElement).value =
            currentHeatmapYear.toString();
          updateYearDropdown();
          if (lastData && lastData.runs) {
            renderHeatmap(lastData.runs);
          }
        }
      });

      // Show/hide year navigation based on time filter
      updateYearNavigationVisibility();
    }

    function updateYearDropdown() {
      const yearSelect = document.getElementById("heatmapYearSelect");
      if (!yearSelect) return;

      // Get available years from data
      const years = new Set();

      // Add years from data if available
      if (lastData && lastData.runs && lastData.runs.length > 0) {
        lastData.runs.forEach((run) => {
          const year = new Date(run.tsEnd).getFullYear();
          if (!isNaN(year)) {
            years.add(year);
          }
        });
      }

      // Always add current year
      const currentYear = new Date().getFullYear();
      years.add(currentYear);

      // Always add the currently selected year (in case user navigated to a year without data)
      if (currentHeatmapYear && !isNaN(currentHeatmapYear)) {
        years.add(currentHeatmapYear);
      }

      // Sort years (newest first)
      const sortedYears = Array.from(years)
        .filter((year) => !isNaN(year as number))
        .sort((a, b) => (b as number) - (a as number));

      // Update dropdown options
      yearSelect.innerHTML = "";
      sortedYears.forEach((year) => {
        const option = document.createElement("option");
        option.value = (year as number).toString();
        option.textContent = (year as number).toString();
        if (year === currentHeatmapYear) {
          option.selected = true;
        }
        yearSelect.appendChild(option);
      });

      // Update button states
      const prevBtn = document.getElementById("heatmapPrevYear");
      const nextBtn = document.getElementById("heatmapNextYear");

      if (prevBtn && sortedYears.length > 0) {
        const minYear = Math.min(...(sortedYears as number[]));
        (prevBtn as HTMLButtonElement).disabled = currentHeatmapYear <= minYear;
      }

      if (nextBtn) {
        // Allow navigation up to current year + 1 for future planning
        (nextBtn as HTMLButtonElement).disabled =
          currentHeatmapYear >= currentYear + 1;
      }
    }

    function updateYearNavigationVisibility() {
      const yearNav = document.getElementById("heatmapYearNav");
      if (!yearNav) return;

      // Show year navigation for multi-year ranges or when data spans multiple years
      const shouldShow = shouldShowYearNavigation();

      if (shouldShow) {
        yearNav.classList.remove("element-hidden");
      } else {
        yearNav.classList.add("element-hidden");
      }
    }

    function shouldShowYearNavigation() {
      // Always show if we have data spanning multiple years
      if (lastData && lastData.runs && lastData.runs.length > 0) {
        const years = new Set();
        lastData.runs.forEach((run) => {
          years.add(new Date(run.tsEnd).getFullYear());
        });
        if (years.size > 1) return true;
      }

      // Show for custom ranges that might span years
      if (
        currentFilters.window === "custom" &&
        currentFilters.customFrom &&
        currentFilters.customTo
      ) {
        const startYear = new Date(currentFilters.customFrom).getFullYear();
        const endYear = new Date(currentFilters.customTo).getFullYear();
        if (startYear !== endYear) return true;
      }

      // Show for very long time ranges
      if (currentFilters.window === "1y" || currentFilters.window === "all") {
        return true;
      }

      return false;
    }

    function renderPerformanceMatrix(commands: CommandSummary[]) {
      const matrix = document.getElementById("performanceMatrix");
      if (!matrix || !commands || commands.length === 0) return;

      matrix.innerHTML = "";

      // Show top 10 commands by frequency
      const topCommands = commands.slice(0, 10);

      // Add explanation header
      const header = document.createElement("div");
      header.className = "performance-matrix-header";
      header.innerHTML = `
       <h4>⚡ Performance Overview</h4>
       <p>Your most frequently used commands ranked by performance. Colors indicate relative speed: <span class="speed-fast">Fast</span> (fastest 33%), <span class="speed-medium">Medium</span> (middle 33%), <span class="speed-slow">Slow</span> (slowest 33%)</p>
     `;
      matrix.appendChild(header);

      const grid = document.createElement("div");
      grid.className = "performance-grid";
      matrix.appendChild(grid);

      // Calculate adaptive thresholds based on data distribution
      const durations = topCommands
        .map((cmd) => cmd.avgMs)
        .sort((a, b) => a - b);
      let fastThreshold, slowThreshold;

      if (durations.length >= 3) {
        // Use percentile-based thresholds for 3+ commands
        fastThreshold = durations[Math.floor(durations.length * 0.33)]; // 33rd percentile
        slowThreshold = durations[Math.floor(durations.length * 0.67)]; // 67th percentile
      } else {
        // Fallback to simple thresholds for very few commands
        const minDuration = Math.min(...durations);
        const maxDuration = Math.max(...durations);
        const range = maxDuration - minDuration;
        fastThreshold = minDuration + range * 0.33;
        slowThreshold = minDuration + range * 0.67;
      }

      topCommands.forEach((cmd) => {
        const card = document.createElement("div");
        card.className = "performance-card";

        // Determine speed class based on adaptive thresholds
        const speedClass =
          cmd.avgMs <= fastThreshold
            ? "fast"
            : cmd.avgMs <= slowThreshold
            ? "medium"
            : "slow";
        card.classList.add(`speed-${speedClass}`);

        // Better command text handling with smart truncation
        const maxLength = 30;
        let commandText = cmd.command;
        let isCommandTruncated = false;

        if (cmd.command.length > maxLength) {
          // Try to truncate at word boundary
          const truncated = cmd.command.substring(0, maxLength);
          const lastSpace = truncated.lastIndexOf(" ");
          if (lastSpace > maxLength * 0.6) {
            // If we can truncate at a reasonable word boundary
            commandText = truncated.substring(0, lastSpace) + "...";
          } else {
            commandText = truncated + "...";
          }
          isCommandTruncated = true;
        }
        // successRate is a decimal from storage (0.01 = 1%), convert to percentage
        const successRate = Math.round(cmd.successRate * 100);
        const successClass =
          successRate >= 80
            ? "success-high"
            : successRate >= 50
            ? "success-medium"
            : "success-low";

        card.innerHTML = `
         <div class="command-name" title="${cmd.command}">${commandText}</div>
         <div class="duration-display">${formatDuration(cmd.avgMs)}</div>
         <div class="stats-row">
           <span class="run-count">${cmd.runs} runs</span>
           <span class="success-rate ${successClass}">${successRate}% ✓</span>
         </div>
       `;

        grid.appendChild(card);
      });
    }

    // Initialize the dashboard
    // Restore saved settings if available
    const savedState = vscode.getState();
    if (savedState && savedState.settings) {
      restoreSettings(savedState.settings);
    }

    loadData();

    // Ensure all dropdown menus are closed on load
    const columnMenu = document.querySelector(".column-menu");
    if (columnMenu) {
      columnMenu.classList.add("element-hidden");
    }

    // Close all multi-select dropdowns using CSS classes (CSP-compliant)
    document.querySelectorAll(".multi-select-dropdown").forEach((dd) => {
      dd.classList.add("element-hidden");
    });
  }
})();
