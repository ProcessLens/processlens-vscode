// Main ProcessLens Dashboard - Modular Version
import { dashboardState } from "./state.js";
import { EventHandlers } from "./events.js";
import { FilterManager } from "./filters.js";

// Initialize dashboard when DOM is ready
(function (): void {
  // Acquire VS Code API once and store globally
  if (!(window as any).vscode) {
    (window as any).vscode = (window as any).acquireVsCodeApi();
  }
  const vscode = (window as any).vscode;

  // Initialize dashboard
  function initializeDashboard(): void {
    console.log("ProcessLens Dashboard initializing...");

    // Restore saved settings
    dashboardState.restoreSettings();

    // Set up all event listeners
    EventHandlers.setupEventListeners();

    // Load initial data
    FilterManager.loadData();

    console.log("ProcessLens Dashboard initialized");
  }

  // Handle messages from the extension
  window.addEventListener("message", (event) => {
    const message = event.data;
    EventHandlers.handleMessage(message);
  });

  // Initialize when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeDashboard);
  } else {
    initializeDashboard();
  }

  // Expose global functions for debugging and compatibility
  (window as any).ProcessLensDashboard = {
    state: dashboardState,
    loadData: () => FilterManager.loadData(),
    clearFilters: () => FilterManager.clearAllFilters(),
    exportData: () => EventHandlers.exportData(),
    importData: () => EventHandlers.importData(),
  };

  // Expose pagination functions globally for compatibility
  (window as any).nextCommandPage = () => {
    const TableRenderer = (window as any).TableRenderer;
    if (TableRenderer) {
      TableRenderer.nextCommandPage();
    }
  };

  (window as any).prevCommandPage = () => {
    const TableRenderer = (window as any).TableRenderer;
    if (TableRenderer) {
      TableRenderer.prevCommandPage();
    }
  };
})();
