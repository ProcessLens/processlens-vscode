// Table rendering functionality for ProcessLens Dashboard
import { EventRecord, CommandSummary } from "./types.js";
import { DataFormatters } from "./formatters.js";
import { dashboardState } from "./state.js";
import { ChartRenderer } from "./charts.js";

export class TableRenderer {
  public static renderCommandTable(
    perCommand: CommandSummary[],
    runs: EventRecord[]
  ): void {
    const tableBody = document.getElementById("commandTableBody");
    if (!tableBody || !perCommand) return;

    // Apply current sorting
    const sortedCommands = [...perCommand].sort((a, b) => {
      const { column, direction } = dashboardState.commandTableSort;
      let aVal: any = (a as any)[column];
      let bVal: any = (b as any)[column];

      // Handle string sorting
      if (typeof aVal === "string") {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      const result = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return direction === "asc" ? result : -result;
    });

    // Apply pagination
    const startIndex =
      dashboardState.commandTablePage * dashboardState.COMMANDS_PER_PAGE;
    const endIndex = startIndex + dashboardState.COMMANDS_PER_PAGE;
    const pageCommands = sortedCommands.slice(startIndex, endIndex);

    // Store current data for filtering
    dashboardState.currentCommandData = sortedCommands;

    // Generate table rows
    const rows = pageCommands
      .map((cmd) => {
        const successRate = Math.round(cmd.successRate * 100);
        const successClass =
          successRate >= 90
            ? "success"
            : successRate >= 50
            ? "warning"
            : "error";

        // Create command cell with play button and device icons
        const deviceIcons = TableRenderer.getCommandDeviceIcons(
          cmd.command,
          runs
        );
        const commandCell = `
        <div class="command-cell">
          <button class="play-btn" data-command="${DataFormatters.sanitizeHtml(
            cmd.command
          )}">▶</button>
          <div class="command-text" data-tooltip="${DataFormatters.sanitizeHtml(
            cmd.command
          )}">
            <span class="command-display">${DataFormatters.sanitizeHtml(
              cmd.command
            )}</span>
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

        return `
        <tr class="command-row" data-command="${DataFormatters.sanitizeHtml(
          cmd.command
        )}">
          <td data-column="command" class="command-name">${commandCell}</td>
          <td data-column="runs" class="runs-count clickable ${
            dashboardState.visibleColumns.runs ? "" : "column-hidden"
          }" data-filter-command="${DataFormatters.sanitizeHtml(cmd.command)}">
            ${cmd.runs}
          </td>
          <td data-column="avgMs" class="avg-duration ${
            dashboardState.visibleColumns.avgMs ? "" : "column-hidden"
          }">
            ${DataFormatters.formatDuration(
              Math.round(cmd.avgMs),
              dashboardState.timeFormat
            )}
          </td>
          <td data-column="medianMs" class="median-duration ${
            dashboardState.visibleColumns.medianMs ? "" : "column-hidden"
          }">
            ${DataFormatters.formatDuration(
              Math.round(cmd.medianMs || cmd.avgMs),
              dashboardState.timeFormat
            )}
          </td>
          <td data-column="p95Ms" class="p95-duration ${
            dashboardState.visibleColumns.p95Ms ? "" : "column-hidden"
          }">
            ${DataFormatters.formatDuration(
              Math.round(cmd.p95Ms || cmd.avgMs),
              dashboardState.timeFormat
            )}
          </td>
          <td data-column="minMs" class="min-duration ${
            dashboardState.visibleColumns.minMs ? "" : "column-hidden"
          }">
            ${DataFormatters.formatDuration(
              Math.round(cmd.minMs || cmd.avgMs),
              dashboardState.timeFormat
            )}
          </td>
          <td data-column="maxMs" class="max-duration ${
            dashboardState.visibleColumns.maxMs ? "" : "column-hidden"
          }">
            ${DataFormatters.formatDuration(
              Math.round(cmd.maxMs || cmd.avgMs),
              dashboardState.timeFormat
            )}
          </td>
          <td data-column="successRate" class="success-rate ${successClass} clickable ${
          dashboardState.visibleColumns.successRate ? "" : "column-hidden"
        }" data-filter-failed="${DataFormatters.sanitizeHtml(cmd.command)}">
            ${successRate}%
          </td>
          <td data-column="trend" class="trend-indicator ${trendClass} ${
          dashboardState.visibleColumns.trend ? "" : "column-hidden"
        }" title="Performance trend for selected period">
            ${trendIcon}
          </td>
          <td data-column="sparkline" class="sparkline-cell ${
            dashboardState.visibleColumns.sparkline ? "" : "column-hidden"
          }">
            ${
              cmd.sparkline && cmd.sparkline.length > 1
                ? `<div class="sparkline-container" data-durations="${(
                    cmd.sparkline || []
                  ).join(",")}"></div>`
                : '<span class="sparkline-placeholder" title="Needs 2+ runs to show trend">—</span>'
            }
          </td>
          <td data-column="totalTime" class="total-time column-visible ${
            dashboardState.visibleColumns.totalTime ? "" : "column-hidden"
          }" title="Total time consumed: ${DataFormatters.formatDuration(
          cmd.totalTimeMs,
          dashboardState.timeFormat
        )}">
            ${DataFormatters.formatDuration(
              Math.round(cmd.totalTimeMs),
              dashboardState.timeFormat
            )}
          </td>
          <td data-column="impact" class="impact-score column-visible ${
            dashboardState.visibleColumns.impact ? "" : "column-hidden"
          }" title="Impact score: ${cmd.impactScore}/100">
            <div class="impact-bar" data-impact="${cmd.impactScore}">
              <div class="impact-fill" data-width="${cmd.impactScore}"></div>
              <span class="impact-text">${cmd.impactScore}</span>
            </div>
          </td>
          <td data-column="timePerDay" class="time-per-day ${
            dashboardState.visibleColumns.timePerDay ? "" : "column-hidden"
          }" title="Average time per day: ${DataFormatters.formatDuration(
          cmd.timePerDayMs,
          dashboardState.timeFormat
        )}">
            ${DataFormatters.formatDuration(
              Math.round(cmd.timePerDayMs),
              dashboardState.timeFormat
            )}
          </td>
          <td data-column="projectedSavings" class="projected-savings ${
            dashboardState.visibleColumns.projectedSavings
              ? ""
              : "column-hidden"
          }" title="Potential savings: ${DataFormatters.formatDuration(
          cmd.projectedSavingsMs || 0,
          dashboardState.timeFormat
        )}">
            ${DataFormatters.formatDuration(
              Math.round(cmd.projectedSavingsMs || 0),
              dashboardState.timeFormat
            )}
          </td>
          <td data-column="optimizationPotential" class="optimization-potential ${
            dashboardState.visibleColumns.optimizationPotential
              ? ""
              : "column-hidden"
          }" title="Optimization priority: ${
          cmd.optimizationPotential || "low"
        }">
            <span class="priority-badge priority-${
              cmd.optimizationPotential || "low"
            }">${String(
          cmd.optimizationPotential || "low"
        ).toUpperCase()}</span>
          </td>
        </tr>
      `;
      })
      .join("");

    tableBody.innerHTML = rows;

    // Render sparklines
    document.querySelectorAll(".sparkline-container").forEach((container) => {
      const durationsStr = container.getAttribute("data-durations");
      if (durationsStr) {
        const durations = durationsStr.split(",").map(Number);
        ChartRenderer.createSparklineChart(container as HTMLElement, durations);
      }
    });

    // Update column visibility
    TableRenderer.updateColumnVisibility();

    // Apply bar widths using JavaScript (CSP-compliant)
    TableRenderer.applyBarWidths();

    // Update pagination info
    TableRenderer.updatePaginationInfo(sortedCommands.length);

    // Update sort indicators in headers
    setTimeout(() => TableRenderer.updateSortIndicators(), 10);

    // Update play button states
    TableRenderer.updatePlayButtonStates();

    // Set device icon colors using JavaScript (CSP-compliant)
    ChartRenderer.setDeviceIconColors();
  }

  public static renderRecentRuns(runs: EventRecord[]): void {
    const container = document.getElementById("recentRuns");
    if (!container) return;

    container.innerHTML = "";

    if (runs.length === 0) {
      container.innerHTML =
        '<div class="empty-state">No recent runs to display</div>';
      return;
    }

    const reversedRuns = [...runs].reverse();

    reversedRuns.forEach((run: EventRecord, index: number) => {
      const item = document.createElement("div");
      item.className = "run-item";

      const success =
        run.success !== undefined ? run.success : (run as any).exitCode === 0;
      const relativeTime = DataFormatters.getRelativeTime(run.tsEnd);

      // Calculate trend indicator (compare with previous run of same command)
      let trendIndicator = "";
      if (index < reversedRuns.length - 1) {
        const previousRuns = reversedRuns.slice(index + 1);
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

      const deviceInfo = DataFormatters.getDeviceInfo(run);

      item.innerHTML = `
        <span class="run-status ${success ? "success" : "fail"}">
          ${success ? "✅" : "❌"}
        </span>
        <span class="run-command" title="${DataFormatters.sanitizeHtml(
          run.command
        )}">
          ${DataFormatters.sanitizeHtml(run.command)}${trendIndicator}
        </span>
        <span class="run-duration">
          ${DataFormatters.formatDuration(
            Math.round(run.durationMs),
            dashboardState.timeFormat
          )}
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
          <button class="delete-run-btn" data-run-id="${run.tsStart}-${
        run.command
      }" title="Delete this run (cannot be undone)">🗑️</button>
        </span>
      `;

      container.appendChild(item);
    });
  }

  public static renderGlobalStats(
    runs: EventRecord[],
    perCommand: CommandSummary[],
    projects: string[],
    commands: string[],
    devices: string[]
  ): void {
    // Update total runs
    const totalRunsEl = document.getElementById("totalRuns");
    if (totalRunsEl) {
      totalRunsEl.textContent = DataFormatters.formatNumber(runs.length);
    }

    // Update command count
    const commandCountEl = document.getElementById("commandCount");
    if (commandCountEl) {
      commandCountEl.textContent = DataFormatters.formatNumber(
        perCommand.length
      );
    }

    // Calculate overall success rate
    const successfulRuns = runs.filter((run) => {
      const success =
        run.success !== undefined ? run.success : (run as any).exitCode === 0;
      return success;
    }).length;
    const successRate = runs.length > 0 ? successfulRuns / runs.length : 0;

    const overallSuccessEl = document.getElementById("overallSuccess");
    if (overallSuccessEl) {
      overallSuccessEl.textContent =
        DataFormatters.formatPercentage(successRate);
    }

    // Update active projects
    const activeProjectsEl = document.getElementById("activeProjects");
    if (activeProjectsEl) {
      activeProjectsEl.textContent = DataFormatters.formatNumber(
        projects.length
      );
    }

    // Update active devices
    const activeDevicesEl = document.getElementById("activeDevices");
    if (activeDevicesEl) {
      activeDevicesEl.textContent = DataFormatters.formatNumber(devices.length);
    }
  }

  public static updateColumnVisibility(): void {
    // Update table headers
    document.querySelectorAll("th[data-column]").forEach((header) => {
      const column = header.getAttribute("data-column");
      if (column && dashboardState.visibleColumns.hasOwnProperty(column)) {
        const isVisible = (dashboardState.visibleColumns as any)[column];
        header.classList.toggle("column-hidden", !isVisible);
      }
    });

    // Update table cells
    document.querySelectorAll('td[class*="column-hidden"]').forEach((cell) => {
      cell.classList.remove("column-hidden");
    });

    // Re-apply visibility based on current state
    Object.entries(dashboardState.visibleColumns).forEach(
      ([column, isVisible]) => {
        if (!isVisible) {
          document
            .querySelectorAll(`td.${column}-cell, th[data-column="${column}"]`)
            .forEach((el) => {
              el.classList.add("column-hidden");
            });
        }
      }
    );
  }

  public static applyBarWidths(): void {
    // Apply widths to impact fill bars
    document.querySelectorAll(".impact-fill[data-width]").forEach((bar) => {
      const width = bar.getAttribute("data-width");
      if (width) {
        (bar as HTMLElement).style.width = `${width}%`;
      }
    });

    // Apply widths to success bars
    document.querySelectorAll(".success-bar[data-width]").forEach((bar) => {
      const width = bar.getAttribute("data-width");
      if (width) {
        (bar as HTMLElement).style.width = `${width}%`;
      }
    });

    // Apply impact scores to impact bars
    document.querySelectorAll(".impact-bar[data-impact]").forEach((bar) => {
      const impact = parseInt(bar.getAttribute("data-impact") || "0");
      const impactClass =
        impact >= 80 ? "high" : impact >= 40 ? "medium" : "low";
      bar.classList.add(impactClass);
    });
  }

  public static updatePaginationInfo(totalCommands: number): void {
    const totalPages = Math.ceil(
      totalCommands / dashboardState.COMMANDS_PER_PAGE
    );
    const currentPage = dashboardState.commandTablePage + 1;

    // Update pagination display if it exists
    const paginationEl = document.getElementById("paginationInfo");
    if (paginationEl) {
      paginationEl.textContent = `Page ${currentPage} of ${totalPages} (${totalCommands} commands)`;
    }

    // Create pagination controls if they don't exist
    TableRenderer.createPaginationControls(totalCommands);
  }

  public static createPaginationControls(totalCommands: number): void {
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

    const totalPages = Math.ceil(
      totalCommands / dashboardState.COMMANDS_PER_PAGE
    );
    const currentPage = dashboardState.commandTablePage + 1;

    if (totalPages <= 1) {
      paginationEl.innerHTML = "";
      return;
    }

    paginationEl.innerHTML = `
      <div class="pagination-info">
        Showing ${
          dashboardState.commandTablePage * dashboardState.COMMANDS_PER_PAGE + 1
        }-${Math.min(
      (dashboardState.commandTablePage + 1) * dashboardState.COMMANDS_PER_PAGE,
      totalCommands
    )} of ${totalCommands} commands
      </div>
      <div class="pagination-controls">
        <button class="pagination-btn" data-action="prev" ${
          dashboardState.commandTablePage === 0 ? "disabled" : ""
        }>← Previous</button>
        <span>Page ${currentPage} of ${totalPages}</span>
        <button class="pagination-btn" data-action="next" ${
          dashboardState.commandTablePage >= totalPages - 1 ? "disabled" : ""
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
          TableRenderer.prevCommandPage();
        } else if (action === "next") {
          TableRenderer.nextCommandPage();
        }
      }
    });
  }

  public static nextCommandPage(): void {
    const totalPages = Math.ceil(
      dashboardState.currentCommandData.length /
        dashboardState.COMMANDS_PER_PAGE
    );
    if (dashboardState.commandTablePage < totalPages - 1) {
      dashboardState.commandTablePage++;
      TableRenderer.renderCommandTable(
        dashboardState.currentCommandData,
        dashboardState.lastData.runs
      );
    }
  }

  public static prevCommandPage(): void {
    if (dashboardState.commandTablePage > 0) {
      dashboardState.commandTablePage--;
      TableRenderer.renderCommandTable(
        dashboardState.currentCommandData,
        dashboardState.lastData.runs
      );
    }
  }

  private static getCommandDeviceIcons(
    command: string,
    runs: EventRecord[] = []
  ): string {
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
      const deviceInfo = DataFormatters.getDeviceInfo(run);
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

  public static setupTableSorting(): void {
    document.querySelectorAll("th.sortable").forEach((header) => {
      header.addEventListener("click", () => {
        const column = header.getAttribute("data-sort");
        if (!column) return;

        // Toggle sort direction if same column, otherwise default to desc
        if (dashboardState.commandTableSort.column === column) {
          dashboardState.commandTableSort.direction =
            dashboardState.commandTableSort.direction === "asc"
              ? "desc"
              : "asc";
        } else {
          dashboardState.commandTableSort.column = column;
          dashboardState.commandTableSort.direction = "desc";
        }

        // Update visual indicators
        document.querySelectorAll("th.sortable").forEach((th) => {
          th.classList.remove("sort-asc", "sort-desc");
        });

        header.classList.add(
          dashboardState.commandTableSort.direction === "asc"
            ? "sort-asc"
            : "sort-desc"
        );

        // Re-render table with new sorting
        TableRenderer.renderCommandTable(
          dashboardState.lastData.perCommand,
          dashboardState.lastData.runs
        );

        // Save settings
        dashboardState.saveCurrentSettings();
      });
    });
  }

  public static updateSortIndicators(): void {
    // Remove existing sort indicators
    document.querySelectorAll(".sort-indicator").forEach((el) => el.remove());

    // Add current sort indicator
    const headers = document.querySelectorAll("th[data-sort]");
    headers.forEach((header) => {
      if (
        (header as HTMLElement).dataset.sort ===
        dashboardState.commandTableSort.column
      ) {
        const indicator = document.createElement("span");
        indicator.className = "sort-indicator";
        indicator.textContent =
          dashboardState.commandTableSort.direction === "asc" ? " ↑" : " ↓";
        header.appendChild(indicator);
      }
    });
  }

  public static updatePlayButtonStates(): void {
    // Update play button states based on running command status
    document.querySelectorAll(".play-btn").forEach((btn) => {
      const button = btn as HTMLButtonElement;
      if (dashboardState.isCommandRunning) {
        button.disabled = true;
        button.textContent = "⏸";
        button.title = "Command running...";
      } else {
        button.disabled = false;
        button.textContent = "▶";
        button.title = "Run this command";
      }
    });
  }
}
