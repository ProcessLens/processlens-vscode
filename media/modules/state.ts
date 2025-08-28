// State management for ProcessLens Dashboard
import {
  Filters,
  LastData,
  CommandTableSort,
  ColumnVisibility,
  CommandSummary,
} from "./types.js";

export class DashboardState {
  // Core state
  public currentFilters: Filters = {
    projectId: "",
    command: "",
    success: "all",
    window: "all",
    deviceInstance: null,
  };

  public chart: any = null;
  public isLoadingData: boolean = false;
  public isCommandRunning: boolean = false;
  public runningTaskExecution: any = null;

  // Data store
  public lastData: LastData = {
    runs: [],
    perCommand: [],
    projects: [],
    commands: [],
    devices: [],
  };

  // Display preferences
  public timeFormat: "human" | "raw" = "human";
  public commandTableSort: CommandTableSort = {
    column: "runs",
    direction: "desc",
  };

  public commandTablePage: number = 0;
  public readonly COMMANDS_PER_PAGE: number = 10;
  public currentCommandData: CommandSummary[] = [];
  public currentCommandFilter: string | null = null;
  public currentFailedFilter: boolean = false;
  public trendPeriodDays: number = 7;

  // Removed heatmap variables (keeping stubs for compatibility)
  public selectedHeatmapDay: string | null = null;
  public previousFiltersState: Partial<Filters> | null = null;
  public currentHeatmapYear: number = new Date().getFullYear();
  public isHeatmapFilterUpdate = false;

  // Column visibility
  public visibleColumns: ColumnVisibility = {
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
    totalTime: true, // Shows biggest time sinks
    impact: true, // Visual impact score
    timePerDay: false,
    projectedSavings: false,
    optimizationPotential: false,
  };

  // Settings persistence
  public saveCurrentSettings(): void {
    const settings = {
      filters: this.currentFilters,
      timeFormat: this.timeFormat,
      commandTableSort: this.commandTableSort,
      visibleColumns: this.visibleColumns,
      trendPeriodDays: this.trendPeriodDays,
    };

    try {
      localStorage.setItem(
        "processlens-dashboard-settings",
        JSON.stringify(settings)
      );
    } catch (error) {
      console.warn("Failed to save dashboard settings:", error);
    }
  }

  public restoreSettings(): void {
    try {
      const saved = localStorage.getItem("processlens-dashboard-settings");
      if (saved) {
        const settings = JSON.parse(saved);

        if (settings.filters) {
          console.log("Restoring filters from localStorage:", settings.filters);
          // Convert any empty arrays in saved filters to undefined
          const cleanFilters = { ...settings.filters };
          if (
            Array.isArray(cleanFilters.projectId) &&
            cleanFilters.projectId.length === 0
          ) {
            cleanFilters.projectId = undefined;
          }
          if (
            Array.isArray(cleanFilters.command) &&
            cleanFilters.command.length === 0
          ) {
            cleanFilters.command = undefined;
          }
          if (
            Array.isArray(cleanFilters.success) &&
            cleanFilters.success.length === 0
          ) {
            cleanFilters.success = "all";
          }
          if (
            Array.isArray(cleanFilters.deviceInstance) &&
            cleanFilters.deviceInstance.length === 0
          ) {
            cleanFilters.deviceInstance = undefined;
          }

          this.currentFilters = { ...this.currentFilters, ...cleanFilters };
          console.log("Cleaned filters applied:", this.currentFilters);
        }
        if (settings.timeFormat) {
          this.timeFormat = settings.timeFormat;
        }
        if (settings.commandTableSort) {
          this.commandTableSort = settings.commandTableSort;
        }
        if (settings.visibleColumns) {
          this.visibleColumns = {
            ...this.visibleColumns,
            ...settings.visibleColumns,
          };
        }
        if (settings.trendPeriodDays) {
          this.trendPeriodDays = settings.trendPeriodDays;
        }
      }
    } catch (error) {
      console.warn("Failed to restore dashboard settings:", error);
    }
  }

  public reset(): void {
    this.currentFilters = {
      projectId: "",
      command: "",
      success: "all",
      window: "all",
      deviceInstance: null,
    };
    this.timeFormat = "human";
    this.commandTableSort = { column: "runs", direction: "desc" };
    this.commandTablePage = 0;
    this.currentCommandData = [];
    this.currentCommandFilter = null;
    this.currentFailedFilter = false;
    this.trendPeriodDays = 7;

    this.saveCurrentSettings();
  }
}

// Global state instance
export const dashboardState = new DashboardState();
