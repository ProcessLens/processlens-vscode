// Event handling for ProcessLens Dashboard
import { dashboardState } from "./state.js";
import { FilterManager } from "./filters.js";
import { TableRenderer } from "./tables.js";

export class EventHandlers {
  public static setupEventListeners(): void {
    // Set up filter dropdowns
    FilterManager.setupMultiSelectDropdown("project", "All Projects");
    FilterManager.setupMultiSelectDropdown("command", "All Commands");
    FilterManager.setupMultiSelectDropdown("success", "All");
    FilterManager.setupMultiSelectDropdown("device", "All Devices");
    FilterManager.setupTimeRangeDropdown();

    // Set up action buttons
    EventHandlers.setupActionButtons();

    // Set up table interactions
    EventHandlers.setupTableInteractions();

    // Set up column visibility
    EventHandlers.setupColumnVisibility();

    // Set up time format toggle
    EventHandlers.setupTimeFormatToggle();

    // Set up trend period selector
    EventHandlers.setupTrendPeriodSelector();

    // Set up chart tabs
    EventHandlers.setupChartTabs();

    // Set up device tooltips
    EventHandlers.setupDeviceTooltips();
  }

  public static setupActionButtons(): void {
    // Clear filters button
    const clearFiltersBtn = document.getElementById("clearFiltersBtn");
    if (clearFiltersBtn) {
      clearFiltersBtn.addEventListener("click", () => {
        FilterManager.clearAllFilters();
      });
    }

    // Export data button
    const exportDataBtn = document.getElementById("exportDataBtn");
    if (exportDataBtn) {
      exportDataBtn.addEventListener("click", () => {
        EventHandlers.exportData();
      });
    }

    // Import data button
    const importDataBtn = document.getElementById("importDataBtn");
    if (importDataBtn) {
      importDataBtn.addEventListener("click", () => {
        EventHandlers.importData();
      });
    }

    // Clear all data button
    const clearBtn = document.getElementById("clearBtn");
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        EventHandlers.clearAllData();
      });
    }

    // Cancel task button
    const cancelTaskBtn = document.getElementById("cancelTaskBtn");
    if (cancelTaskBtn) {
      cancelTaskBtn.addEventListener("click", () => {
        EventHandlers.cancelRunningTask();
      });
    }

    // Coffee button
    const coffeeBtn = document.getElementById("coffeeBtn");
    if (coffeeBtn) {
      coffeeBtn.addEventListener("click", () => {
        const vscode = (window as any).vscode;
        vscode.postMessage({ type: "OPEN_COFFEE_LINK" });
      });
    }

    // Sign in button (placeholder)
    const signinBtn = document.getElementById("signinBtn");
    if (signinBtn) {
      signinBtn.addEventListener("click", () => {
        alert(
          "Sign-in functionality coming soon! This will enable data sync across devices."
        );
      });
    }
  }

  public static setupTableInteractions(): void {
    // Set up table sorting
    TableRenderer.setupTableSorting();

    // Set up command run buttons (delegated event handling)
    document.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;

      // Play button clicks
      if (target.classList.contains("play-btn")) {
        const command = target.getAttribute("data-command");
        if (command) {
          EventHandlers.runCommand(command);
        }
      }

      // Delete run button clicks
      if (target.classList.contains("delete-run-btn")) {
        const runId = target.getAttribute("data-run-id");
        if (runId) {
          EventHandlers.deleteRun(runId);
        }
      }

      // Runs link clicks (filter by command)
      if (target.classList.contains("runs-link")) {
        const command = target.getAttribute("data-command");
        if (command) {
          EventHandlers.filterByCommand(command);
        }
      }

      // Success link clicks (show failed runs)
      if (target.classList.contains("success-link")) {
        const command = target.getAttribute("data-command");
        if (command) {
          EventHandlers.showFailedRuns(command);
        }
      }
    });
  }

  public static setupColumnVisibility(): void {
    const menuBtn = document.querySelector(".column-menu-btn");
    const menu = document.querySelector(".column-menu");

    if (!menuBtn || !menu) return;

    // Toggle menu
    menuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      menu.classList.toggle("element-hidden");
    });

    // Handle checkbox changes
    menu.addEventListener("change", (e) => {
      const target = e.target as HTMLInputElement;
      if (target.type === "checkbox") {
        const column = target.getAttribute("data-column");
        if (column && dashboardState.visibleColumns.hasOwnProperty(column)) {
          (dashboardState.visibleColumns as any)[column] = target.checked;
          TableRenderer.updateColumnVisibility();
          dashboardState.saveCurrentSettings();
        }
      }
    });

    // Close menu on outside click
    document.addEventListener("click", () => {
      menu.classList.add("element-hidden");
    });

    // Initialize checkbox states
    Object.entries(dashboardState.visibleColumns).forEach(
      ([column, isVisible]) => {
        const checkbox = menu.querySelector(
          `input[data-column="${column}"]`
        ) as HTMLInputElement;
        if (checkbox) {
          checkbox.checked = isVisible;
        }
      }
    );
  }

  public static setupTimeFormatToggle(): void {
    const toggle = document.getElementById(
      "timeFormatToggle"
    ) as HTMLSelectElement;
    if (!toggle) return;

    toggle.value = dashboardState.timeFormat;

    toggle.addEventListener("change", () => {
      dashboardState.timeFormat = toggle.value as "human" | "raw";
      dashboardState.saveCurrentSettings();

      // Re-render table with new format
      TableRenderer.renderCommandTable(
        dashboardState.lastData.perCommand,
        dashboardState.lastData.runs
      );
    });
  }

  public static setupTrendPeriodSelector(): void {
    const selector = document.getElementById(
      "trendPeriodSelect"
    ) as HTMLSelectElement;
    if (!selector) return;

    selector.value = dashboardState.trendPeriodDays.toString();

    selector.addEventListener("change", () => {
      dashboardState.trendPeriodDays = parseInt(selector.value);
      dashboardState.saveCurrentSettings();

      // Reload data to recalculate trends
      FilterManager.loadData();
    });
  }

  public static setupChartTabs(): void {
    const tabs = document.querySelectorAll(".chart-tab");

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const targetTab = tab.getAttribute("data-tab");
        if (!targetTab) return;

        // Update active tab
        tabs.forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");

        // Show/hide chart views
        document.querySelectorAll(".chart-view").forEach((view) => {
          view.classList.add("element-hidden");
          view.classList.remove("active");
        });

        const targetView = document.getElementById(`${targetTab}Chart`);
        if (targetView) {
          targetView.classList.add("active");
          targetView.classList.remove("element-hidden");

          // Render specific chart type
          if (targetTab === "performance" && dashboardState.lastData) {
            // Use global ChartRenderer directly
            const ChartRenderer = (window as any).ChartRenderer;
            ChartRenderer.renderPerformanceMatrix(
              dashboardState.lastData.perCommand
            );
          }
        }
      });
    });
  }

  // Action handlers
  public static runCommand(command: string): void {
    const vscode = (window as any).vscode;
    vscode.postMessage({
      type: "RUN_COMMAND",
      command: command,
    });
  }

  public static deleteRun(runId: string): void {
    const vscode = (window as any).vscode;
    if (vscode) {
      // Send confirmation request to extension (webview can't show confirm dialogs)
      vscode.postMessage({
        type: "CONFIRM_DELETE_RUN",
        runId: runId,
      });
    }
  }

  public static filterByCommand(command: string): void {
    // Update command filter
    const dropdown = document.getElementById("commandFilterDropdown");
    if (dropdown) {
      // Uncheck all
      dropdown.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
        (cb as HTMLInputElement).checked = false;
      });

      // Check the specific command
      const targetCheckbox = dropdown.querySelector(
        `input[value="${command}"]`
      ) as HTMLInputElement;
      if (targetCheckbox) {
        targetCheckbox.checked = true;
      }
    }

    FilterManager.handleMultiSelectChange("command", "All Commands");
  }

  public static showFailedRuns(command: string): void {
    // Filter by command and failed status
    EventHandlers.filterByCommand(command);

    // Set success filter to failed
    const successDropdown = document.getElementById("successFilterDropdown");
    if (successDropdown) {
      successDropdown
        .querySelectorAll('input[type="checkbox"]')
        .forEach((cb) => {
          (cb as HTMLInputElement).checked = false;
        });

      const failedCheckbox = successDropdown.querySelector(
        'input[value="fail"]'
      ) as HTMLInputElement;
      if (failedCheckbox) {
        failedCheckbox.checked = true;
      }
    }

    FilterManager.handleMultiSelectChange("success", "All");
  }

  public static exportData(): void {
    const vscode = (window as any).vscode;
    vscode.postMessage({ type: "EXPORT_DATA" });
  }

  public static importData(): void {
    const vscode = (window as any).vscode;
    vscode.postMessage({ type: "IMPORT_DATA" });
  }

  public static clearAllData(): void {
    // Send confirmation request to extension (webview can't show confirm dialogs due to CSP)
    const vscode = (window as any).vscode;
    vscode.postMessage({ type: "CONFIRM_CLEAR_DATA" });
  }

  public static cancelRunningTask(): void {
    const vscode = (window as any).vscode;
    vscode.postMessage({ type: "CANCEL_TASK" });
  }

  // Message handlers from extension
  public static handleMessage(message: any): void {
    switch (message.type) {
      case "DATA":
        EventHandlers.handleDataMessage(message);
        break;
      case "UPDATED":
        // Reload data when commands are executed
        console.log("Dashboard received UPDATED message, reloading data...");
        FilterManager.loadData();
        break;
      case "COMMAND_STARTED":
        EventHandlers.handleCommandStarted(message);
        break;
      case "COMMAND_COMPLETED":
        EventHandlers.handleCommandCompleted(message);
        break;
      case "DATA_CLEARED":
        // Reset filters and show empty state
        EventHandlers.handleDataCleared();
        break;
      case "RUN_DELETED":
        // Reload data after run deletion
        FilterManager.loadData();
        break;
      case "PROFILE_IMPORTED":
        EventHandlers.handleProfileImported(message);
        break;
      case "EXPORT_COMPLETE":
        EventHandlers.handleExportComplete(message);
        break;
      case "IMPORT_COMPLETE":
        EventHandlers.handleImportComplete(message);
        break;
      default:
        console.warn("Unknown message type:", message.type);
    }
  }

  private static handleDataMessage(message: any): void {
    dashboardState.isLoadingData = false;

    // Debug logging
    console.log("Received DATA message:", {
      runs: message.runs?.length || 0,
      perCommand: message.perCommand?.length || 0,
      projects: message.projects?.length || 0,
      commands: message.commands?.length || 0,
      devices: message.devices?.length || 0,
    });

    if (message.error) {
      console.error("Data loading error:", message.error);
      document.querySelector(".loading")?.classList.add("element-hidden");
      return;
    }

    // Store data
    dashboardState.lastData = {
      runs: message.runs || [],
      perCommand: message.perCommand || [],
      projects: message.projects || [],
      commands: message.commands || [],
      devices: message.devices || [],
    };

    // Populate filter options
    FilterManager.populateFilterOptions(dashboardState.lastData);

    // Render dashboard
    EventHandlers.renderDashboard();
  }

  private static handleCommandStarted(message: any): void {
    dashboardState.isCommandRunning = true;

    // Show cancel button
    const cancelBtn = document.getElementById("cancelTaskBtn");
    if (cancelBtn) {
      cancelBtn.classList.remove("element-hidden");
    }

    // Update status
    console.log("Command started:", message.command);
  }

  private static handleCommandCompleted(message: any): void {
    dashboardState.isCommandRunning = false;

    // Hide cancel button
    const cancelBtn = document.getElementById("cancelTaskBtn");
    if (cancelBtn) {
      cancelBtn.classList.add("element-hidden");
    }

    // Reload data to show new results
    if (!message.cancelled) {
      setTimeout(() => FilterManager.loadData(), 500);
    }
  }

  private static handleExportComplete(message: any): void {
    if (message.success) {
      alert("Data exported successfully!");
    } else {
      alert("Export failed: " + (message.error || "Unknown error"));
    }
  }

  private static handleImportComplete(message: any): void {
    if (message.success) {
      alert("Data imported successfully!");
      FilterManager.loadData(); // Reload to show imported data
    } else {
      alert("Import failed: " + (message.error || "Unknown error"));
    }
  }

  private static renderDashboard(): void {
    const { runs, perCommand, projects, commands, devices } =
      dashboardState.lastData;

    // Use global classes directly (available after bundling)
    const ChartRenderer = (window as any).ChartRenderer;
    const TableRenderer = (window as any).TableRenderer;

    // Check if we have data
    if (!runs || runs.length === 0) {
      document.querySelector(".loading")?.classList.add("element-hidden");
      document
        .querySelector(".empty-state")
        ?.classList.remove("element-hidden");
      document.querySelector(".cards")?.classList.add("element-hidden");
      document.querySelector(".global-stats")?.classList.add("element-hidden");
      return;
    }

    // Show content
    document.querySelector(".loading")?.classList.add("element-hidden");
    document.querySelector(".empty-state")?.classList.add("element-hidden");
    document.querySelector(".cards")?.classList.remove("element-hidden");
    document.querySelector(".global-stats")?.classList.remove("element-hidden");

    // Render components
    try {
      if (runs && runs.length > 0) {
        ChartRenderer.renderChart(runs);
      }
    } catch (error) {
      console.error("Chart rendering error:", error);
    }

    TableRenderer.renderCommandTable(perCommand, runs);
    TableRenderer.renderGlobalStats(
      runs,
      perCommand,
      projects,
      commands,
      devices
    );
    TableRenderer.renderRecentRuns(runs.slice(-10));
    ChartRenderer.setDeviceIconColors();
  }

  public static setupDeviceTooltips(): void {
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
        padding: 8px 12px;
        border-radius: 3px;
        font-size: 12px;
        z-index: 1000;
        display: none;
        pointer-events: none;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        max-width: 300px;
        word-wrap: break-word;
        line-height: 1.4;
      `;
      document.body.appendChild(tooltip);
    }

    // Add event listeners using delegation for dynamic content
    document.addEventListener("mouseover", function (e) {
      const target = e.target as HTMLElement;
      if (target && target.matches(".device-icon, .device-icon-small")) {
        const tooltipText = target.getAttribute("data-tooltip");
        if (tooltipText) {
          tooltip!.textContent = tooltipText;
          tooltip!.style.display = "block";

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
            tooltip!.style.left = "-9999px";
            tooltip!.style.top = rect.top + scrollTop - 5 + "px";

            // Wait for next frame to get accurate width
            requestAnimationFrame(() => {
              const tooltipWidth = tooltip!.offsetWidth;
              tooltip!.style.left =
                rect.left + scrollLeft - tooltipWidth - 10 + "px";
            });
          } else {
            // Position to the right in Command Summary (more space)
            tooltip!.style.left = rect.right + scrollLeft + 10 + "px";
            tooltip!.style.top = rect.top + scrollTop - 5 + "px";
          }
        }
      }
    });

    document.addEventListener("mouseout", function (e) {
      const target = e.target as HTMLElement;
      if (target && target.matches(".device-icon, .device-icon-small")) {
        tooltip!.style.display = "none";
      }
    });
  }

  private static handleDataCleared(): void {
    // Reset all filters and UI elements to default state
    // Note: We need to reset the UI manually since clearAllFilters() would call loadData()

    // Note: We clear the entire dropdown contents below instead of just resetting checkboxes

    // Reset time range to default (7 days)
    document
      .querySelectorAll(".time-range-option[data-type='relative']")
      .forEach((opt) => {
        opt.removeAttribute("data-selected");
      });
    const defaultTimeRange = document.querySelector(
      '.time-range-option[data-value="7d"]'
    );
    if (defaultTimeRange) {
      defaultTimeRange.setAttribute("data-selected", "true");
    }

    // Clear custom dates
    const fromInput = document.getElementById(
      "customFromDate"
    ) as HTMLInputElement;
    const toInput = document.getElementById("customToDate") as HTMLInputElement;
    if (fromInput) fromInput.value = "";
    if (toInput) toInput.value = "";

    // Reset success filter dropdown
    const successFilter = document.getElementById(
      "successFilter"
    ) as HTMLSelectElement;
    if (successFilter) successFilter.value = "all";

    // Update displays
    const projectDisplay = document.getElementById("projectFilterDisplay");
    const commandDisplay = document.getElementById("commandFilterDisplay");
    const successDisplay = document.getElementById("successFilterDisplay");
    const deviceDisplay = document.getElementById("deviceFilterDisplay");
    const timeRangeDisplay = document.getElementById("timeRangeDisplay");

    if (projectDisplay) projectDisplay.textContent = "All Projects";
    if (commandDisplay) commandDisplay.textContent = "All Commands";
    if (successDisplay) successDisplay.textContent = "All";
    if (deviceDisplay) deviceDisplay.textContent = "All Devices";
    if (timeRangeDisplay) timeRangeDisplay.textContent = "Last 7 Days";

    // Reset state
    dashboardState.reset();

    // Clear dropdown contents (remove old project/command options)
    console.log("Clearing dropdown contents...");
    const dropdownIds = [
      "projectFilterDropdown",
      "commandFilterDropdown",
      "deviceFilterDropdown",
    ];
    dropdownIds.forEach((dropdownId) => {
      const dropdown = document.getElementById(dropdownId);
      if (dropdown) {
        // Clear all options and add back just the "All" option
        dropdown.innerHTML = "";

        // Create the "All" option based on dropdown type
        const filterType = dropdownId.replace("FilterDropdown", "");
        const allText =
          filterType === "project"
            ? "All Projects"
            : filterType === "command"
            ? "All Commands"
            : filterType === "device"
            ? "All Devices"
            : "All";

        const allOptionDiv = document.createElement("div");
        allOptionDiv.className = "multi-select-option";
        allOptionDiv.setAttribute("data-value", "all");

        const allCheckbox = document.createElement("input");
        allCheckbox.type = "checkbox";
        allCheckbox.id = `${filterType}-all`;
        allCheckbox.checked = true;

        const allLabel = document.createElement("label");
        allLabel.setAttribute("for", allCheckbox.id);
        allLabel.textContent = allText;

        allOptionDiv.appendChild(allCheckbox);
        allOptionDiv.appendChild(allLabel);
        dropdown.appendChild(allOptionDiv);

        console.log(`Cleared ${dropdownId} and added ${allText} option`);
      }
    });

    // Show empty state immediately
    EventHandlers.showEmptyState();
  }

  private static handleProfileImported(message: any): void {
    if (message.profile) {
      EventHandlers.applyProfile(message.profile);
    }
  }

  private static showEmptyState(): void {
    // Hide loading and show empty state
    document.querySelector(".loading")?.classList.add("element-hidden");
    document.querySelector(".cards")?.classList.add("element-hidden");
    document.querySelector(".empty-state")?.classList.remove("element-hidden");

    // Reset global stats to zero
    TableRenderer.renderGlobalStats([], [], [], [], []);
  }

  private static applyProfile(profile: any): void {
    if (profile.filters) {
      dashboardState.currentFilters = {
        ...dashboardState.currentFilters,
        ...profile.filters,
      };
    }
    if (profile.timeFormat) {
      dashboardState.timeFormat = profile.timeFormat;
    }
    if (profile.visibleColumns) {
      dashboardState.visibleColumns = {
        ...dashboardState.visibleColumns,
        ...profile.visibleColumns,
      };
    }
    if (profile.commandTableSort) {
      dashboardState.commandTableSort = {
        ...dashboardState.commandTableSort,
        ...profile.commandTableSort,
      };
    }
    if (profile.trendPeriodDays) {
      dashboardState.trendPeriodDays = profile.trendPeriodDays;
    }

    // Save the imported settings
    dashboardState.saveCurrentSettings();

    // Reload data with new profile settings
    FilterManager.loadData();
  }
}
