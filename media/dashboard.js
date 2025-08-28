// ProcessLens Dashboard - Bundled from modular TypeScript sources
// Generated automatically - do not edit directly


// === types module ===
(function() {
// TypeScript interfaces and types for ProcessLens Dashboard
{};
//# sourceMappingURL=types.js.map
})();

// === formatters module ===
(function() {
// Data formatting utilities for ProcessLens Dashboard
window.DataFormatters = class DataFormatters {
    static formatDuration(ms, format = "human") {
        if (format === "raw") {
            return `${ms}ms`;
        }
        if (ms < 1000) {
            return `${Math.round(ms)}ms`;
        }
        else if (ms < 60000) {
            return `${(ms / 1000).toFixed(1)}s`;
        }
        else if (ms < 3600000) {
            const minutes = Math.floor(ms / 60000);
            const seconds = Math.floor((ms % 60000) / 1000);
            return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
        }
        else {
            const hours = Math.floor(ms / 3600000);
            const minutes = Math.floor((ms % 3600000) / 60000);
            return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
        }
    }
    static formatBytes(bytes) {
        if (bytes === 0)
            return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB", "TB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    }
    static formatPercentage(value) {
        return `${Math.round(value * 100)}%`;
    }
    static formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + "M";
        }
        else if (num >= 1000) {
            return (num / 1000).toFixed(1) + "K";
        }
        return num.toString();
    }
    static formatDate(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays === 0) {
            return date.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
            });
        }
        else if (diffDays === 1) {
            return "Yesterday";
        }
        else if (diffDays < 7) {
            return `${diffDays} days ago`;
        }
        else {
            return date.toLocaleDateString();
        }
    }
    static formatTrend(trend) {
        switch (trend) {
            case "up":
                return "↗ slower";
            case "down":
                return "↘ faster";
            case "stable":
                return "→ stable";
            default:
                return "- no data";
        }
    }
    static formatImpactScore(score) {
        if (score >= 80)
            return "HIGH";
        if (score >= 40)
            return "MEDIUM";
        return "LOW";
    }
    static formatOptimizationPotential(potential) {
        if (potential >= 0.8)
            return "HIGH";
        if (potential >= 0.4)
            return "MEDIUM";
        return "LOW";
    }
    static truncateCommand(command, maxLength = 50) {
        if (command.length <= maxLength)
            return command;
        return command.substring(0, maxLength - 3) + "...";
    }
    static formatDeviceInfo(device) {
        if (!device)
            return "Unknown Device";
        const parts = [];
        if (device.os)
            parts.push(device.os);
        if (device.cpuModel)
            parts.push(device.cpuModel);
        if (device.memGB)
            parts.push(`${device.memGB}GB RAM`);
        return parts.join(" • ") || "Unknown Device";
    }
    static createSparklineData(durations) {
        if (!durations || durations.length < 2)
            return "";
        const max = Math.max(...durations);
        const min = Math.min(...durations);
        const range = max - min;
        if (range === 0)
            return "▬".repeat(durations.length);
        return durations
            .map((duration) => {
            const normalized = (duration - min) / range;
            const index = Math.floor(normalized * 7);
            return "▁▂▃▄▅▆▇█"[Math.min(index, 7)];
        })
            .join("");
    }
    static sanitizeHtml(str) {
        const div = document.createElement("div");
        div.textContent = str;
        return div.innerHTML;
    }
    static formatSuccessRate(rate, total) {
        const percentage = DataFormatters.formatPercentage(rate);
        const failed = total - Math.round(rate * total);
        return failed > 0 ? `${percentage} (${failed} failed)` : percentage;
    }
    static getRelativeTime(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        if (days > 0)
            return `${days}d ago`;
        if (hours > 0)
            return `${hours}h ago`;
        if (minutes > 0)
            return `${minutes}m ago`;
        return `${seconds}s ago`;
    }
    static getDeviceInfo(run) {
        const deviceId = run.deviceId;
        const device = run.device; // Device info may not be in EventRecord interface
        // Generate consistent color for device
        const color = DataFormatters.getDeviceColor(deviceId);
        // Determine icon and OS info based on OS
        let icon = "💻"; // Default computer icon (emoji fallback)
        let nerdFontIcon = "\uF109"; // Default Nerd Font computer icon (nf-fa-desktop)
        let osName = "Unknown";
        let osVersion = "";
        if (device && device.os) {
            const osLower = device.os.toLowerCase();
            osVersion = run.osVersion || "";
            if (osLower.includes("darwin") || osLower.includes("macos")) {
                icon = "🍎";
                nerdFontIcon = "\uF179"; // nf-fa-apple
                osName = "macOS";
            }
            else if (osLower.includes("linux")) {
                icon = "🐧";
                nerdFontIcon = "\uF17C"; // nf-fa-linux
                osName = "Linux";
                // Detect specific Linux distributions
                if (osLower.includes("ubuntu")) {
                    nerdFontIcon = "\uF31B"; // nf-fa-ubuntu
                    osName = "Ubuntu";
                }
                else if (osLower.includes("debian")) {
                    nerdFontIcon = "\uF306"; // nf-fa-debian
                    osName = "Debian";
                }
                else if (osLower.includes("fedora")) {
                    nerdFontIcon = "\uF30A"; // nf-fa-fedora
                    osName = "Fedora";
                }
                else if (osLower.includes("arch")) {
                    nerdFontIcon = "\uF303"; // nf-fa-archlinux
                    osName = "Arch";
                }
                else if (osLower.includes("centos")) {
                    nerdFontIcon = "\uF304"; // nf-fa-centos
                    osName = "CentOS";
                }
            }
            else if (osLower.includes("win")) {
                icon = "🪟";
                nerdFontIcon = "\uF17A"; // nf-fa-windows
                osName = "Windows";
            }
            else if (osLower.includes("freebsd")) {
                icon = "👹";
                nerdFontIcon = "\uF30C"; // nf-fa-freebsd
                osName = "FreeBSD";
            }
        }
        // Create detailed tooltip with device info
        let tooltip = deviceId.slice(0, 8) + "...";
        if (device) {
            tooltip = `${osName}${osVersion ? " " + osVersion : ""} • ${device.arch}`;
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
        // Smart icon selection: prefer emoji fallbacks for better compatibility
        const finalIcon = DataFormatters.supportsNerdFonts() ? nerdFontIcon : icon;
        return {
            icon: finalIcon,
            color,
            tooltip,
            osName,
            osVersion,
        };
    }
    static getDeviceColor(deviceId) {
        // Generate a consistent color for each device ID
        let hash = 0;
        for (let i = 0; i < deviceId.length; i++) {
            hash = deviceId.charCodeAt(i) + ((hash << 5) - hash);
        }
        const hue = Math.abs(hash % 360);
        return `hsl(${hue}, 45%, 60%)`;
    }
    static supportsNerdFonts() {
        // Test if Nerd Fonts are available by checking a known character
        const testCanvas = document.createElement("canvas");
        const ctx = testCanvas.getContext("2d");
        if (!ctx)
            return false;
        // Set font to one of our Nerd Font options
        ctx.font = '16px "MesloLGS NF", "FiraCode Nerd Font", monospace';
        // Test with a common Nerd Font icon (Apple logo)
        const nerdFontWidth = ctx.measureText("\uF179").width;
        // Set font to fallback monospace without Nerd Font
        ctx.font = "16px monospace";
        const fallbackWidth = ctx.measureText("\uF179").width;
        // If widths differ significantly, Nerd Font is likely rendering
        return Math.abs(nerdFontWidth - fallbackWidth) > 1;
    }
}
//# sourceMappingURL=formatters.js.map
})();

// === state module ===
(function() {
window.DashboardState = class DashboardState {
    constructor() {
        // Core state
        this.currentFilters = {
            projectId: "",
            command: "",
            success: "all",
            window: "all",
            deviceInstance: null,
        };
        this.chart = null;
        this.isLoadingData = false;
        this.isCommandRunning = false;
        this.runningTaskExecution = null;
        // Data store
        this.lastData = {
            runs: [],
            perCommand: [],
            projects: [],
            commands: [],
            devices: [],
        };
        // Display preferences
        this.timeFormat = "human";
        this.commandTableSort = {
            column: "runs",
            direction: "desc",
        };
        this.commandTablePage = 0;
        this.COMMANDS_PER_PAGE = 10;
        this.currentCommandData = [];
        this.currentCommandFilter = null;
        this.currentFailedFilter = false;
        this.trendPeriodDays = 7;
        // Removed heatmap variables (keeping stubs for compatibility)
        this.selectedHeatmapDay = null;
        this.previousFiltersState = null;
        this.currentHeatmapYear = new Date().getFullYear();
        this.isHeatmapFilterUpdate = false;
        // Column visibility
        this.visibleColumns = {
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
    }
    // Settings persistence
    saveCurrentSettings() {
        const settings = {
            filters: this.currentFilters,
            timeFormat: this.timeFormat,
            commandTableSort: this.commandTableSort,
            visibleColumns: this.visibleColumns,
            trendPeriodDays: this.trendPeriodDays,
        };
        try {
            localStorage.setItem("processlens-dashboard-settings", JSON.stringify(settings));
        }
        catch (error) {
            console.warn("Failed to save dashboard settings:", error);
        }
    }
    restoreSettings() {
        try {
            const saved = localStorage.getItem("processlens-dashboard-settings");
            if (saved) {
                const settings = JSON.parse(saved);
                if (settings.filters) {
                    console.log("Restoring filters from localStorage:", settings.filters);
                    // Convert any empty arrays in saved filters to undefined
                    const cleanFilters = { ...settings.filters };
                    if (Array.isArray(cleanFilters.projectId) &&
                        cleanFilters.projectId.length === 0) {
                        cleanFilters.projectId = undefined;
                    }
                    if (Array.isArray(cleanFilters.command) &&
                        cleanFilters.command.length === 0) {
                        cleanFilters.command = undefined;
                    }
                    if (Array.isArray(cleanFilters.success) &&
                        cleanFilters.success.length === 0) {
                        cleanFilters.success = "all";
                    }
                    if (Array.isArray(cleanFilters.deviceInstance) &&
                        cleanFilters.deviceInstance.length === 0) {
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
        }
        catch (error) {
            console.warn("Failed to restore dashboard settings:", error);
        }
    }
    reset() {
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
window.dashboardState = new DashboardState();
//# sourceMappingURL=state.js.map
})();

// === charts module ===
(function() {


window.ChartRenderer = class ChartRenderer {
    static renderChart(runs) {
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
        const ctx = canvas.getContext("2d");
        if (!ctx) {
            console.error("Chart context not available");
            return;
        }
        // Destroy existing chart
        if (dashboardState.chart) {
            dashboardState.chart.destroy();
            dashboardState.chart = null;
        }
        // Validate data
        if (!runs || !Array.isArray(runs) || runs.length === 0) {
            throw new Error("No valid data to chart");
        }
        // Prepare data with proper mapping
        const chartData = runs.map((run) => ({
            x: new Date(run.tsEnd),
            y: run.durationMs,
            success: run.success !== undefined ? run.success : run.exitCode === 0,
            command: run.command,
            deviceId: run.deviceId,
            hardwareHash: run.hardwareHash,
            projectName: run.projectName,
            // Include device data for proper OS detection
            device: run.device,
            osVersion: run.osVersion,
        }));
        // Detect hardware changes for annotations
        const hardwareChanges = [];
        let lastHardwareHash = null;
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
        if (chartData.length === 0) {
            throw new Error("No valid timing data found");
        }
        // Create point colors based on success/failure
        const pointColors = chartData.map((point) => {
            if (point.success === true)
                return "#22c55e"; // Green for success
            if (point.success === false)
                return "#ef4444"; // Red for failure
            return "#eab308"; // Yellow for unclear
        });
        // Analyze value distribution for better chart scaling
        const values = chartData.map((d) => d.y);
        const maxVal = Math.max(...values);
        const minVal = Math.min(...values);
        const range = maxVal - minVal;
        const padding = range * 0.1;
        // Create chart with linear scale for X-axis (timestamps as numbers)
        const chartDataWithTimestamps = chartData.map((point) => ({
            ...point,
            x: point.x.getTime(), // Convert to timestamp number
        }));
        // Sort data by timestamp to ensure proper line connections
        chartDataWithTimestamps.sort((a, b) => a.x - b.x);
        // Adjust point radius based on data density to reduce overlap
        const dataCount = chartDataWithTimestamps.length;
        const baseRadius = dataCount > 50 ? 3 : dataCount > 20 ? 4 : 5;
        const hoverRadius = baseRadius + 2;
        dashboardState.chart = new Chart(ctx, {
            type: "line",
            data: {
                datasets: [
                    {
                        label: "Duration (ms)",
                        data: chartDataWithTimestamps,
                        borderColor: "#4FC3F7",
                        backgroundColor: "rgba(79, 195, 247, 0.1)",
                        borderWidth: 2,
                        fill: false,
                        tension: 0,
                        stepped: false,
                        pointBackgroundColor: pointColors,
                        pointRadius: baseRadius,
                        pointHoverRadius: hoverRadius,
                        pointBorderColor: "rgba(255, 255, 255, 0.5)",
                        pointBorderWidth: 1,
                        pointHoverBorderWidth: 2,
                        // Add some spacing between points
                        showLine: true,
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
                            // Add some padding to prevent overlap
                            autoSkip: true,
                            autoSkipPadding: 20,
                            callback: function (value) {
                                const date = new Date(value);
                                const now = new Date();
                                const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
                                if (diffHours < 1) {
                                    return date.toLocaleTimeString([], {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                    });
                                }
                                else if (diffHours < 24) {
                                    return date.toLocaleTimeString([], {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                    });
                                }
                                else {
                                    return date.toLocaleDateString([], {
                                        month: "short",
                                        day: "numeric",
                                    });
                                }
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
                            callback: function (value) {
                                return DataFormatters.formatDuration(Math.round(value), dashboardState.timeFormat);
                            },
                        },
                    },
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            title: (context) => {
                                const dataPoint = chartData[context[0].dataIndex];
                                return DataFormatters.truncateCommand(dataPoint.command, 50);
                            },
                            label: (context) => {
                                const dataPoint = chartData[context.dataIndex];
                                const duration = DataFormatters.formatDuration(context.parsed.y, dashboardState.timeFormat);
                                const status = dataPoint.success
                                    ? "✅ Success"
                                    : dataPoint.success === false
                                        ? "❌ Failed"
                                        : "⚠️ Unknown";
                                const time = new Date(context.parsed.x).toLocaleString();
                                const project = dataPoint.projectName
                                    ? ` • ${dataPoint.projectName}`
                                    : "";
                                // Get human-friendly device info with full specs
                                let deviceInfo = "";
                                if (dataPoint.deviceId) {
                                    const deviceData = DataFormatters.getDeviceInfo(dataPoint);
                                    // Use the full tooltip that includes CPU, memory, etc.
                                    deviceInfo = deviceData.tooltip;
                                }
                                return [
                                    `Duration: ${duration}`,
                                    `Status: ${status}`,
                                    `Time: ${time}`,
                                    project ? `Project: ${dataPoint.projectName}` : "",
                                    deviceInfo ? `Device: ${deviceInfo}` : "",
                                ].filter(Boolean);
                            },
                        },
                    },
                    legend: {
                        display: false,
                    },
                },
                interaction: {
                    intersect: false,
                    mode: "nearest",
                },
                animation: {
                    duration: 750,
                    easing: "easeInOutQuart",
                },
            },
        });
    }
    static renderPerformanceMatrix(perCommand) {
        const container = document.getElementById("performanceMatrix");
        if (!container || !perCommand || perCommand.length === 0) {
            if (container) {
                container.innerHTML =
                    '<div class="matrix-message">No performance data available</div>';
            }
            return;
        }
        container.innerHTML = "";
        // Show top 10 commands by frequency
        const topCommands = perCommand.slice(0, 10);
        // Add explanation header
        const header = document.createElement("div");
        header.className = "performance-matrix-header";
        header.innerHTML = `
      <h4>⚡ Performance Overview</h4>
      <p>Your most frequently used commands ranked by performance. Colors indicate relative speed: <span class="speed-fast">Fast</span> (fastest 33%), <span class="speed-medium">Medium</span> (middle 33%), <span class="speed-slow">Slow</span> (slowest 33%)</p>
    `;
        container.appendChild(header);
        const grid = document.createElement("div");
        grid.className = "performance-grid";
        container.appendChild(grid);
        // Calculate adaptive thresholds based on data distribution
        const durations = topCommands.map((cmd) => cmd.avgMs).sort((a, b) => a - b);
        let fastThreshold, slowThreshold;
        if (durations.length >= 3) {
            // Use percentile-based thresholds for 3+ commands
            fastThreshold = durations[Math.floor(durations.length * 0.33)]; // 33rd percentile
            slowThreshold = durations[Math.floor(durations.length * 0.67)]; // 67th percentile
        }
        else {
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
            let speedClass = "speed-medium";
            if (cmd.avgMs <= fastThreshold) {
                speedClass = "speed-fast";
            }
            else if (cmd.avgMs >= slowThreshold) {
                speedClass = "speed-slow";
            }
            card.classList.add(speedClass);
            // Create card content
            const commandName = DataFormatters.truncateCommand(cmd.command, 25);
            const duration = DataFormatters.formatDuration(cmd.avgMs, dashboardState.timeFormat);
            const successRate = DataFormatters.formatPercentage(cmd.successRate);
            const runs = cmd.runs;
            card.innerHTML = `
        <div class="command-name" title="${DataFormatters.sanitizeHtml(cmd.command)}">
          ${DataFormatters.sanitizeHtml(commandName)}
        </div>
        <div class="duration-display">${duration}</div>
        <div class="stats-row">
          <span class="success-rate">${successRate} success</span>
          <span class="run-count">${runs} runs</span>
        </div>
      `;
            // Add click handler to filter by this command
            card.addEventListener("click", () => {
                // Set command filter and reload data
                const commandFilter = document.getElementById("commandFilterDisplay");
                if (commandFilter) {
                    commandFilter.textContent = commandName;
                    // Update the actual filter state
                    dashboardState.currentFilters.command = [cmd.command];
                    dashboardState.saveCurrentSettings();
                    // Reload data with new filter
                    const FilterManager = window.FilterManager;
                    if (FilterManager) {
                        FilterManager.loadData();
                    }
                }
            });
            grid.appendChild(card);
        });
    }
    static applyMatrixBarWidths() {
        // Apply widths to matrix bars
        document
            .querySelectorAll(".success-bar[data-width], .impact-bar[data-width]")
            .forEach((bar) => {
            const width = bar.getAttribute("data-width");
            if (width) {
                bar.style.width = `${width}%`;
            }
        });
    }
    static setDeviceIconColors() {
        // Apply device-specific colors using data attributes (CSP-compliant)
        const deviceIcons = document.querySelectorAll("[data-device-color]");
        deviceIcons.forEach((icon) => {
            const color = icon.getAttribute("data-device-color");
            if (color) {
                icon.style.color = color;
            }
        });
    }
    static createSparklineChart(container, data) {
        if (!data || data.length < 2) {
            container.innerHTML = '<span class="no-sparkline">—</span>';
            return;
        }
        const sparkline = DataFormatters.createSparklineData(data);
        container.innerHTML = `<span class="sparkline" title="Recent duration trend">${sparkline}</span>`;
    }
}
//# sourceMappingURL=charts.js.map
})();

// === tables module ===
(function() {



window.TableRenderer = class TableRenderer {
    static renderCommandTable(perCommand, runs) {
        const tableBody = document.getElementById("commandTableBody");
        if (!tableBody || !perCommand)
            return;
        // Apply current sorting
        const sortedCommands = [...perCommand].sort((a, b) => {
            const { column, direction } = dashboardState.commandTableSort;
            let aVal = a[column];
            let bVal = b[column];
            // Handle string sorting
            if (typeof aVal === "string") {
                aVal = aVal.toLowerCase();
                bVal = bVal.toLowerCase();
            }
            const result = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
            return direction === "asc" ? result : -result;
        });
        // Apply pagination
        const startIndex = dashboardState.commandTablePage * dashboardState.COMMANDS_PER_PAGE;
        const endIndex = startIndex + dashboardState.COMMANDS_PER_PAGE;
        const pageCommands = sortedCommands.slice(startIndex, endIndex);
        // Store current data for filtering
        dashboardState.currentCommandData = sortedCommands;
        // Generate table rows
        const rows = pageCommands
            .map((cmd) => {
            const successRate = Math.round(cmd.successRate * 100);
            const successClass = successRate >= 90
                ? "success"
                : successRate >= 50
                    ? "warning"
                    : "error";
            // Create command cell with play button and device icons
            const deviceIcons = TableRenderer.getCommandDeviceIcons(cmd.command, runs);
            const commandCell = `
        <div class="command-cell">
          <button class="play-btn" data-command="${DataFormatters.sanitizeHtml(cmd.command)}">▶</button>
          <div class="command-text" data-tooltip="${DataFormatters.sanitizeHtml(cmd.command)}">
            <span class="command-display">${DataFormatters.sanitizeHtml(cmd.command)}</span>
          </div>
          <div class="command-devices">
            ${deviceIcons}
          </div>
        </div>
      `;
            // Create trend indicator
            const trendIcon = cmd.trend === "up" ? "↗" : cmd.trend === "down" ? "↘" : "→";
            const trendClass = `trend-${cmd.trend}`;
            return `
        <tr class="command-row" data-command="${DataFormatters.sanitizeHtml(cmd.command)}">
          <td data-column="command" class="command-name">${commandCell}</td>
          <td data-column="runs" class="runs-count clickable ${dashboardState.visibleColumns.runs ? "" : "column-hidden"}" data-filter-command="${DataFormatters.sanitizeHtml(cmd.command)}">
            ${cmd.runs}
          </td>
          <td data-column="avgMs" class="avg-duration ${dashboardState.visibleColumns.avgMs ? "" : "column-hidden"}">
            ${DataFormatters.formatDuration(Math.round(cmd.avgMs), dashboardState.timeFormat)}
          </td>
          <td data-column="medianMs" class="median-duration ${dashboardState.visibleColumns.medianMs ? "" : "column-hidden"}">
            ${DataFormatters.formatDuration(Math.round(cmd.medianMs || cmd.avgMs), dashboardState.timeFormat)}
          </td>
          <td data-column="p95Ms" class="p95-duration ${dashboardState.visibleColumns.p95Ms ? "" : "column-hidden"}">
            ${DataFormatters.formatDuration(Math.round(cmd.p95Ms || cmd.avgMs), dashboardState.timeFormat)}
          </td>
          <td data-column="minMs" class="min-duration ${dashboardState.visibleColumns.minMs ? "" : "column-hidden"}">
            ${DataFormatters.formatDuration(Math.round(cmd.minMs || cmd.avgMs), dashboardState.timeFormat)}
          </td>
          <td data-column="maxMs" class="max-duration ${dashboardState.visibleColumns.maxMs ? "" : "column-hidden"}">
            ${DataFormatters.formatDuration(Math.round(cmd.maxMs || cmd.avgMs), dashboardState.timeFormat)}
          </td>
          <td data-column="successRate" class="success-rate ${successClass} clickable ${dashboardState.visibleColumns.successRate ? "" : "column-hidden"}" data-filter-failed="${DataFormatters.sanitizeHtml(cmd.command)}">
            ${successRate}%
          </td>
          <td data-column="trend" class="trend-indicator ${trendClass} ${dashboardState.visibleColumns.trend ? "" : "column-hidden"}" title="Performance trend for selected period">
            ${trendIcon}
          </td>
          <td data-column="sparkline" class="sparkline-cell ${dashboardState.visibleColumns.sparkline ? "" : "column-hidden"}">
            ${cmd.sparkline && cmd.sparkline.length > 1
                ? `<div class="sparkline-container" data-durations="${(cmd.sparkline || []).join(",")}"></div>`
                : '<span class="sparkline-placeholder" title="Needs 2+ runs to show trend">—</span>'}
          </td>
          <td data-column="totalTime" class="total-time column-visible ${dashboardState.visibleColumns.totalTime ? "" : "column-hidden"}" title="Total time consumed: ${DataFormatters.formatDuration(cmd.totalTimeMs, dashboardState.timeFormat)}">
            ${DataFormatters.formatDuration(Math.round(cmd.totalTimeMs), dashboardState.timeFormat)}
          </td>
          <td data-column="impact" class="impact-score column-visible ${dashboardState.visibleColumns.impact ? "" : "column-hidden"}" title="Impact score: ${cmd.impactScore}/100">
            <div class="impact-bar" data-impact="${cmd.impactScore}">
              <div class="impact-fill" data-width="${cmd.impactScore}"></div>
              <span class="impact-text">${cmd.impactScore}</span>
            </div>
          </td>
          <td data-column="timePerDay" class="time-per-day ${dashboardState.visibleColumns.timePerDay ? "" : "column-hidden"}" title="Average time per day: ${DataFormatters.formatDuration(cmd.timePerDayMs, dashboardState.timeFormat)}">
            ${DataFormatters.formatDuration(Math.round(cmd.timePerDayMs), dashboardState.timeFormat)}
          </td>
          <td data-column="projectedSavings" class="projected-savings ${dashboardState.visibleColumns.projectedSavings
                ? ""
                : "column-hidden"}" title="Potential savings: ${DataFormatters.formatDuration(cmd.projectedSavingsMs || 0, dashboardState.timeFormat)}">
            ${DataFormatters.formatDuration(Math.round(cmd.projectedSavingsMs || 0), dashboardState.timeFormat)}
          </td>
          <td data-column="optimizationPotential" class="optimization-potential ${dashboardState.visibleColumns.optimizationPotential
                ? ""
                : "column-hidden"}" title="Optimization priority: ${cmd.optimizationPotential || "low"}">
            <span class="priority-badge priority-${cmd.optimizationPotential || "low"}">${String(cmd.optimizationPotential || "low").toUpperCase()}</span>
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
                ChartRenderer.createSparklineChart(container, durations);
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
    static renderRecentRuns(runs) {
        const container = document.getElementById("recentRuns");
        if (!container)
            return;
        container.innerHTML = "";
        if (runs.length === 0) {
            container.innerHTML =
                '<div class="empty-state">No recent runs to display</div>';
            return;
        }
        const reversedRuns = [...runs].reverse();
        reversedRuns.forEach((run, index) => {
            const item = document.createElement("div");
            item.className = "run-item";
            const success = run.success !== undefined ? run.success : run.exitCode === 0;
            const relativeTime = DataFormatters.getRelativeTime(run.tsEnd);
            // Calculate trend indicator (compare with previous run of same command)
            let trendIndicator = "";
            if (index < reversedRuns.length - 1) {
                const previousRuns = reversedRuns.slice(index + 1);
                const previousSameCommand = previousRuns.find((prevRun) => prevRun.command === run.command);
                if (previousSameCommand) {
                    const currentDuration = run.durationMs;
                    const previousDuration = previousSameCommand.durationMs;
                    const tolerance = 0.1; // 10% tolerance
                    const percentChange = (currentDuration - previousDuration) / previousDuration;
                    if (percentChange > tolerance) {
                        trendIndicator =
                            '<span class="trend-up" title="Slower than last run">⬆️</span>';
                    }
                    else if (percentChange < -tolerance) {
                        trendIndicator =
                            '<span class="trend-down" title="Faster than last run">⬇️</span>';
                    }
                    else {
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
        <span class="run-command" title="${DataFormatters.sanitizeHtml(run.command)}">
          ${DataFormatters.sanitizeHtml(run.command)}${trendIndicator}
        </span>
        <span class="run-duration">
          ${DataFormatters.formatDuration(Math.round(run.durationMs), dashboardState.timeFormat)}
        </span>
        <span class="run-time">
          ${relativeTime}
        </span>
        <span class="run-device">
          <span class="device-icon" title="${deviceInfo.tooltip}" data-device-color="${deviceInfo.color}" data-tooltip="${deviceInfo.tooltip}">
            ${deviceInfo.icon}
          </span>
          <button class="delete-run-btn" data-run-id="${run.tsStart}-${run.command}" title="Delete this run (cannot be undone)">🗑️</button>
        </span>
      `;
            container.appendChild(item);
        });
    }
    static renderGlobalStats(runs, perCommand, projects, commands, devices) {
        // Update total runs
        const totalRunsEl = document.getElementById("totalRuns");
        if (totalRunsEl) {
            totalRunsEl.textContent = DataFormatters.formatNumber(runs.length);
        }
        // Update command count
        const commandCountEl = document.getElementById("commandCount");
        if (commandCountEl) {
            commandCountEl.textContent = DataFormatters.formatNumber(perCommand.length);
        }
        // Calculate overall success rate
        const successfulRuns = runs.filter((run) => {
            const success = run.success !== undefined ? run.success : run.exitCode === 0;
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
            activeProjectsEl.textContent = DataFormatters.formatNumber(projects.length);
        }
        // Update active devices
        const activeDevicesEl = document.getElementById("activeDevices");
        if (activeDevicesEl) {
            activeDevicesEl.textContent = DataFormatters.formatNumber(devices.length);
        }
    }
    static updateColumnVisibility() {
        // Update table headers
        document.querySelectorAll("th[data-column]").forEach((header) => {
            const column = header.getAttribute("data-column");
            if (column && dashboardState.visibleColumns.hasOwnProperty(column)) {
                const isVisible = dashboardState.visibleColumns[column];
                header.classList.toggle("column-hidden", !isVisible);
            }
        });
        // Update table cells
        document.querySelectorAll('td[class*="column-hidden"]').forEach((cell) => {
            cell.classList.remove("column-hidden");
        });
        // Re-apply visibility based on current state
        Object.entries(dashboardState.visibleColumns).forEach(([column, isVisible]) => {
            if (!isVisible) {
                document
                    .querySelectorAll(`td.${column}-cell, th[data-column="${column}"]`)
                    .forEach((el) => {
                    el.classList.add("column-hidden");
                });
            }
        });
    }
    static applyBarWidths() {
        // Apply widths to impact fill bars
        document.querySelectorAll(".impact-fill[data-width]").forEach((bar) => {
            const width = bar.getAttribute("data-width");
            if (width) {
                bar.style.width = `${width}%`;
            }
        });
        // Apply widths to success bars
        document.querySelectorAll(".success-bar[data-width]").forEach((bar) => {
            const width = bar.getAttribute("data-width");
            if (width) {
                bar.style.width = `${width}%`;
            }
        });
        // Apply impact scores to impact bars
        document.querySelectorAll(".impact-bar[data-impact]").forEach((bar) => {
            const impact = parseInt(bar.getAttribute("data-impact") || "0");
            const impactClass = impact >= 80 ? "high" : impact >= 40 ? "medium" : "low";
            bar.classList.add(impactClass);
        });
    }
    static updatePaginationInfo(totalCommands) {
        const totalPages = Math.ceil(totalCommands / dashboardState.COMMANDS_PER_PAGE);
        const currentPage = dashboardState.commandTablePage + 1;
        // Update pagination display if it exists
        const paginationEl = document.getElementById("paginationInfo");
        if (paginationEl) {
            paginationEl.textContent = `Page ${currentPage} of ${totalPages} (${totalCommands} commands)`;
        }
        // Create pagination controls if they don't exist
        TableRenderer.createPaginationControls(totalCommands);
    }
    static createPaginationControls(totalCommands) {
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
        const totalPages = Math.ceil(totalCommands / dashboardState.COMMANDS_PER_PAGE);
        const currentPage = dashboardState.commandTablePage + 1;
        if (totalPages <= 1) {
            paginationEl.innerHTML = "";
            return;
        }
        paginationEl.innerHTML = `
      <div class="pagination-info">
        Showing ${dashboardState.commandTablePage * dashboardState.COMMANDS_PER_PAGE + 1}-${Math.min((dashboardState.commandTablePage + 1) * dashboardState.COMMANDS_PER_PAGE, totalCommands)} of ${totalCommands} commands
      </div>
      <div class="pagination-controls">
        <button class="pagination-btn" data-action="prev" ${dashboardState.commandTablePage === 0 ? "disabled" : ""}>← Previous</button>
        <span>Page ${currentPage} of ${totalPages}</span>
        <button class="pagination-btn" data-action="next" ${dashboardState.commandTablePage >= totalPages - 1 ? "disabled" : ""}>Next →</button>
      </div>
    `;
        // Add event listeners for pagination buttons (CSP compliant)
        paginationEl.addEventListener("click", (e) => {
            const target = e.target;
            if (target?.classList.contains("pagination-btn") &&
                !target.disabled) {
                const action = target.getAttribute("data-action");
                if (action === "prev") {
                    TableRenderer.prevCommandPage();
                }
                else if (action === "next") {
                    TableRenderer.nextCommandPage();
                }
            }
        });
    }
    static nextCommandPage() {
        const totalPages = Math.ceil(dashboardState.currentCommandData.length /
            dashboardState.COMMANDS_PER_PAGE);
        if (dashboardState.commandTablePage < totalPages - 1) {
            dashboardState.commandTablePage++;
            TableRenderer.renderCommandTable(dashboardState.currentCommandData, dashboardState.lastData.runs);
        }
    }
    static prevCommandPage() {
        if (dashboardState.commandTablePage > 0) {
            dashboardState.commandTablePage--;
            TableRenderer.renderCommandTable(dashboardState.currentCommandData, dashboardState.lastData.runs);
        }
    }
    static getCommandDeviceIcons(command, runs = []) {
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
            icons.push(`<span class="device-more" title="${uniqueDevices.size - 3} more devices">+${uniqueDevices.size - 3}</span>`);
        }
        return icons.join("");
    }
    static setupTableSorting() {
        document.querySelectorAll("th.sortable").forEach((header) => {
            header.addEventListener("click", () => {
                const column = header.getAttribute("data-sort");
                if (!column)
                    return;
                // Toggle sort direction if same column, otherwise default to desc
                if (dashboardState.commandTableSort.column === column) {
                    dashboardState.commandTableSort.direction =
                        dashboardState.commandTableSort.direction === "asc"
                            ? "desc"
                            : "asc";
                }
                else {
                    dashboardState.commandTableSort.column = column;
                    dashboardState.commandTableSort.direction = "desc";
                }
                // Update visual indicators
                document.querySelectorAll("th.sortable").forEach((th) => {
                    th.classList.remove("sort-asc", "sort-desc");
                });
                header.classList.add(dashboardState.commandTableSort.direction === "asc"
                    ? "sort-asc"
                    : "sort-desc");
                // Re-render table with new sorting
                TableRenderer.renderCommandTable(dashboardState.lastData.perCommand, dashboardState.lastData.runs);
                // Save settings
                dashboardState.saveCurrentSettings();
            });
        });
    }
    static updateSortIndicators() {
        // Remove existing sort indicators
        document.querySelectorAll(".sort-indicator").forEach((el) => el.remove());
        // Add current sort indicator
        const headers = document.querySelectorAll("th[data-sort]");
        headers.forEach((header) => {
            if (header.dataset.sort ===
                dashboardState.commandTableSort.column) {
                const indicator = document.createElement("span");
                indicator.className = "sort-indicator";
                indicator.textContent =
                    dashboardState.commandTableSort.direction === "asc" ? " ↑" : " ↓";
                header.appendChild(indicator);
            }
        });
    }
    static updatePlayButtonStates() {
        // Update play button states based on running command status
        document.querySelectorAll(".play-btn").forEach((btn) => {
            const button = btn;
            if (dashboardState.isCommandRunning) {
                button.disabled = true;
                button.textContent = "⏸";
                button.title = "Command running...";
            }
            else {
                button.disabled = false;
                button.textContent = "▶";
                button.title = "Run this command";
            }
        });
    }
}
//# sourceMappingURL=tables.js.map
})();

// === filters module ===
(function() {

window.FilterManager = class FilterManager {
    static setupMultiSelectDropdown(filterType, placeholder) {
        const display = document.getElementById(`${filterType}FilterDisplay`);
        const dropdown = document.getElementById(`${filterType}FilterDropdown`);
        if (!display || !dropdown)
            return;
        // Toggle dropdown on display click
        display.addEventListener("click", (e) => {
            e.stopPropagation();
            const isHidden = dropdown.classList.contains("element-hidden");
            // Close all other dropdowns
            document.querySelectorAll(".multi-select-dropdown").forEach((dd) => {
                dd.classList.add("element-hidden");
            });
            // Toggle this dropdown
            dropdown.classList.toggle("element-hidden", !isHidden);
        });
        // Add change event listener like original
        dropdown.addEventListener("change", (event) => {
            const target = event.target;
            if (target && target.type === "checkbox") {
                console.log(`Checkbox change detected for ${filterType}:`, target.id, target.checked);
                // Store the target for the handler to access
                window.currentChangeTarget = target;
                FilterManager.handleMultiSelectChange(filterType, FilterManager.getPlaceholderText(filterType));
                window.currentChangeTarget = null;
            }
        });
        // Consolidated click handler for better reliability (like original)
        dropdown.addEventListener("click", (e) => {
            e.stopPropagation();
            const target = e.target;
            let checkbox = null;
            // Find the checkbox based on what was clicked (like original)
            if (target.tagName === "INPUT" &&
                target.type === "checkbox") {
                // Direct checkbox click - let the change event handle it
                return;
            }
            else if (target.tagName === "LABEL") {
                // For label clicks, let the browser handle the natural label-checkbox association
                // The change event will be triggered automatically
                return;
            }
            else if (target.classList.contains("multi-select-option")) {
                // Only handle container clicks (not label or checkbox)
                checkbox = target.querySelector('input[type="checkbox"]');
                if (checkbox) {
                    checkbox.checked = !checkbox.checked;
                    // Trigger change event manually to ensure it's processed
                    const changeEvent = new Event("change", { bubbles: true });
                    checkbox.dispatchEvent(changeEvent);
                }
            }
        });
        // Close dropdown when clicking outside
        document.addEventListener("click", () => {
            dropdown.classList.add("element-hidden");
        });
    }
    static handleMultiSelectChange(filterType, allText) {
        const dropdown = document.getElementById(`${filterType}FilterDropdown`);
        const display = document.getElementById(`${filterType}FilterDisplay`);
        if (!dropdown || !display)
            return;
        const allCheckbox = dropdown.querySelector('input[id$="-all"]');
        const otherCheckboxes = dropdown.querySelectorAll('input[type="checkbox"]:not([id$="-all"])');
        // Get the target from our stored reference (more reliable than global event context)
        const target = window.currentChangeTarget;
        if (!target)
            return;
        console.log(`Multi-select change for ${filterType}:`, {
            target: target.id,
            checked: target.checked,
            isAll: target === allCheckbox,
            allCheckboxState: allCheckbox?.checked,
            otherCheckboxCount: Array.from(otherCheckboxes).filter((cb) => cb.checked)
                .length,
        });
        // Prevent updateFilters from being called during this function to avoid race conditions
        let shouldUpdateFilters = true;
        // If "All" was clicked (like original logic)
        if (target === allCheckbox) {
            if (allCheckbox.checked) {
                // Uncheck all others
                otherCheckboxes.forEach((cb) => (cb.checked = false));
                display.textContent = allText;
            }
            else {
                // If "All" was unchecked, don't allow it (always need something selected)
                allCheckbox.checked = true;
                shouldUpdateFilters = false; // Don't update filters if we're reverting
                return;
            }
        }
        else {
            // If any other checkbox was clicked (like original logic)
            if (target.checked) {
                // Uncheck "All" when selecting specific items
                console.log(`Before unchecking All: otherCheckboxes checked count = ${Array.from(otherCheckboxes).filter((cb) => cb.checked).length}`);
                if (allCheckbox) {
                    console.log(`Unchecking "All" checkbox`);
                    allCheckbox.checked = false;
                }
                console.log(`After unchecking All: otherCheckboxes checked count = ${Array.from(otherCheckboxes).filter((cb) => cb.checked).length}`);
            }
            // Update display text based on current selections
            const checkedOthers = Array.from(otherCheckboxes).filter((cb) => cb.checked);
            console.log(`Checked boxes count after change: ${checkedOthers.length}`);
            console.log(`Checked box IDs:`, checkedOthers.map((cb) => cb.id));
            if (checkedOthers.length === 0) {
                // If nothing is selected, revert to "All"
                if (allCheckbox) {
                    allCheckbox.checked = true;
                    display.textContent = allText;
                }
            }
            else if (checkedOthers.length === 1) {
                // Show single selection
                const label = checkedOthers[0].nextElementSibling;
                const labelText = label?.textContent || checkedOthers[0].value;
                display.textContent =
                    labelText && labelText.length > 25
                        ? labelText.substring(0, 25) + "..."
                        : labelText || "";
            }
            else {
                // Show count
                display.textContent = `${checkedOthers.length} selected`;
            }
        }
        // Only update filters if we should
        if (shouldUpdateFilters) {
            console.log(`Updating filters for ${filterType}`);
            FilterManager.updateFilters();
        }
    }
    static getMultiSelectValues(filterType) {
        const dropdown = document.getElementById(`${filterType}FilterDropdown`);
        if (!dropdown)
            return undefined;
        const checkboxes = dropdown.querySelectorAll('input[type="checkbox"]:checked');
        // Get all checked values using data-value from parent element (like original)
        const allValues = Array.from(checkboxes)
            .map((cb) => cb.parentElement?.getAttribute("data-value"))
            .filter((value) => value !== null);
        // Handle success filter specially (uses "all" instead of "")
        const isSuccessFilter = filterType === "success";
        const allValue = isSuccessFilter ? "all" : "";
        // Filter out the "All" option to get only specific selections
        const specificValues = allValues.filter((v) => v !== allValue);
        console.log(`getMultiSelectValues for ${filterType}:`, {
            allValues,
            specificValues,
            hasAll: allValues.includes(allValue),
            hasSpecific: specificValues.length > 0,
            isSuccessFilter,
            allValue,
        });
        // If "All" is checked OR no checkboxes are checked, return undefined (no filter)
        // Exception: success filter returns "all" when All is selected
        if (allValues.includes(allValue) || allValues.length === 0) {
            return isSuccessFilter && allValues.includes(allValue)
                ? ["all"]
                : undefined;
        }
        // Return specific values only
        return specificValues.length > 0 ? specificValues : undefined;
    }
    static getPlaceholderText(filterType) {
        switch (filterType) {
            case "project":
                return "All Projects";
            case "command":
                return "All Commands";
            case "success":
                return "All";
            case "device":
                return "All Devices";
            default:
                return "All";
        }
    }
    static updateFilters() {
        // Get filter values and convert empty arrays to undefined
        const projectValues = FilterManager.getMultiSelectValues("project");
        const commandValues = FilterManager.getMultiSelectValues("command");
        const successValues = FilterManager.getMultiSelectValues("success");
        const deviceValues = FilterManager.getMultiSelectDeviceInstances();
        dashboardState.currentFilters = {
            projectId: projectValues && projectValues.length > 0 ? projectValues : undefined,
            command: commandValues && commandValues.length > 0 ? commandValues : undefined,
            success: successValues && successValues.length > 0 ? successValues : "all",
            window: FilterManager.getTimeRangeValue(),
            customFrom: FilterManager.getCustomFromDate(),
            customTo: FilterManager.getCustomToDate(),
            deviceInstance: deviceValues && deviceValues.length > 0 ? deviceValues : undefined,
        };
        dashboardState.saveCurrentSettings();
        FilterManager.loadData();
    }
    static getTimeRangeValue() {
        const selected = document.querySelector('.time-range-option[data-selected="true"]');
        return selected ? selected.getAttribute("data-value") || "all" : "all";
    }
    static getCustomFromDate() {
        const input = document.getElementById("customFromDate");
        return input?.value || undefined;
    }
    static getCustomToDate() {
        const input = document.getElementById("customToDate");
        return input?.value || undefined;
    }
    static getMultiSelectDeviceInstances() {
        const values = FilterManager.getMultiSelectValues("device");
        console.log(`getMultiSelectDeviceInstances: raw values =`, values);
        if (!values || values.length === 0)
            return undefined;
        // Parse device instances from specific values (like original)
        const parsed = values
            .map((value) => FilterManager.parseDeviceInstance(value))
            .filter(Boolean);
        console.log(`getMultiSelectDeviceInstances: parsed =`, parsed);
        return parsed;
    }
    static parseDeviceInstance(value) {
        if (!value)
            return null;
        const [deviceId, hardwareHash] = value.split("|");
        return deviceId && hardwareHash ? { deviceId, hardwareHash } : null;
    }
    static setupTimeRangeDropdown() {
        const display = document.getElementById("timeRangeDisplay");
        const dropdown = document.getElementById("timeRangeDropdown");
        if (!display || !dropdown)
            return;
        // Toggle dropdown
        display.addEventListener("click", (e) => {
            e.stopPropagation();
            // Close other dropdowns first
            document.querySelectorAll(".multi-select-dropdown").forEach((dd) => {
                dd.classList.add("element-hidden");
            });
            dropdown.classList.toggle("element-hidden");
        });
        // Handle relative time range option clicks
        dropdown.addEventListener("click", (e) => {
            const target = e.target;
            if (target.classList.contains("time-range-option") &&
                target.getAttribute("data-type") === "relative") {
                FilterManager.selectRelativeTimeRange(target, display, dropdown);
            }
        });
        // Handle custom range application
        const applyBtn = document.getElementById("applyCustomRange");
        if (applyBtn) {
            applyBtn.addEventListener("click", () => {
                FilterManager.applyCustomTimeRange(display, dropdown);
            });
        }
        // Handle custom date input changes (clear relative selection when user types)
        const fromInput = document.getElementById("customFromDate");
        const toInput = document.getElementById("customToDate");
        if (fromInput && toInput) {
            [fromInput, toInput].forEach((input) => {
                input.addEventListener("input", () => {
                    if (input.value) {
                        // Clear relative selections when user starts typing custom dates
                        dropdown
                            .querySelectorAll(".time-range-option[data-type='relative']")
                            .forEach((opt) => {
                            opt.removeAttribute("data-selected");
                        });
                    }
                });
            });
        }
        // Close on outside click
        document.addEventListener("click", () => {
            dropdown.classList.add("element-hidden");
        });
    }
    static selectRelativeTimeRange(target, display, dropdown) {
        // Clear all relative selections
        dropdown
            .querySelectorAll(".time-range-option[data-type='relative']")
            .forEach((opt) => {
            opt.removeAttribute("data-selected");
        });
        // Clear custom date inputs when selecting relative range
        const fromInput = document.getElementById("customFromDate");
        const toInput = document.getElementById("customToDate");
        if (fromInput)
            fromInput.value = "";
        if (toInput)
            toInput.value = "";
        // Set new relative selection
        target.setAttribute("data-selected", "true");
        display.textContent = target.textContent || "All Time";
        console.log(`Selected relative time range: ${target.getAttribute("data-value")}`);
        // Close dropdown and update filters
        dropdown.classList.add("element-hidden");
        FilterManager.updateFilters();
    }
    static applyCustomTimeRange(display, dropdown) {
        const fromInput = document.getElementById("customFromDate");
        const toInput = document.getElementById("customToDate");
        if (!fromInput?.value || !toInput?.value) {
            // Show error if dates are missing
            console.warn("Both from and to dates are required for custom range");
            return;
        }
        // Validate date range
        const fromDate = new Date(fromInput.value);
        const toDate = new Date(toInput.value);
        if (fromDate > toDate) {
            console.warn("From date cannot be after to date");
            return;
        }
        // Clear all relative selections when applying custom range
        dropdown
            .querySelectorAll(".time-range-option[data-type='relative']")
            .forEach((opt) => {
            opt.removeAttribute("data-selected");
        });
        // Format display text
        const fromFormatted = fromDate.toLocaleDateString();
        const toFormatted = toDate.toLocaleDateString();
        display.textContent = `${fromFormatted} to ${toFormatted}`;
        console.log(`Applied custom time range: ${fromInput.value} to ${toInput.value}`);
        // Close dropdown and update filters
        dropdown.classList.add("element-hidden");
        FilterManager.updateFilters();
    }
    static clearAllFilters() {
        // Reset all multi-select dropdowns
        document
            .querySelectorAll('.multi-select-dropdown input[type="checkbox"]')
            .forEach((cb) => {
            const checkbox = cb;
            checkbox.checked = checkbox.id.endsWith("-all");
        });
        // Reset time range to default (7 days)
        document
            .querySelectorAll(".time-range-option[data-type='relative']")
            .forEach((opt) => {
            opt.removeAttribute("data-selected");
        });
        const defaultTimeRange = document.querySelector('.time-range-option[data-value="7d"]');
        if (defaultTimeRange) {
            defaultTimeRange.setAttribute("data-selected", "true");
        }
        // Clear custom dates
        const fromInput = document.getElementById("customFromDate");
        const toInput = document.getElementById("customToDate");
        if (fromInput)
            fromInput.value = "";
        if (toInput)
            toInput.value = "";
        // Update displays
        document.getElementById("projectFilterDisplay").textContent =
            "All Projects";
        document.getElementById("commandFilterDisplay").textContent =
            "All Commands";
        document.getElementById("successFilterDisplay").textContent = "All";
        document.getElementById("deviceFilterDisplay").textContent = "All Devices";
        document.getElementById("timeRangeDisplay").textContent = "Last 7 Days";
        // Reset state and reload
        dashboardState.reset();
        FilterManager.loadData();
    }
    static loadData() {
        if (dashboardState.isLoadingData)
            return;
        dashboardState.isLoadingData = true;
        // Debug logging
        console.log("Loading data with filters:", dashboardState.currentFilters);
        // Show loading state
        document.querySelector(".loading")?.classList.remove("element-hidden");
        document.querySelector(".cards")?.classList.add("element-hidden");
        // Send message to extension
        const vscode = window.vscode;
        vscode.postMessage({
            type: "LOAD",
            filters: dashboardState.currentFilters,
        });
    }
    static populateFilterOptions(data) {
        FilterManager.populateProjectFilter(data.projects || []);
        FilterManager.populateCommandFilter(data.commands || []);
        FilterManager.populateDeviceFilter(data.devices || []);
    }
    static populateProjectFilter(projects) {
        const dropdown = document.getElementById("projectFilterDropdown");
        if (!dropdown)
            return;
        // Preserve existing checkbox states before removing options
        const existingStates = new Map();
        const existingOptions = dropdown.querySelectorAll('.multi-select-option:not([data-value=""])');
        existingOptions.forEach((opt) => {
            const checkbox = opt.querySelector('input[type="checkbox"]');
            if (checkbox) {
                existingStates.set(checkbox.value, checkbox.checked);
            }
            opt.remove();
        });
        projects.forEach((project) => {
            // Handle both string and object formats
            let projectValue;
            let projectLabel;
            if (typeof project === "string") {
                projectValue = project;
                projectLabel = project;
            }
            else if (project && typeof project === "object") {
                projectValue = project.value || project.projectId || String(project);
                projectLabel =
                    project.label ||
                        project.projectName ||
                        project.value ||
                        String(project);
            }
            else {
                projectValue = String(project);
                projectLabel = String(project);
            }
            const option = document.createElement("div");
            option.className = "multi-select-option";
            option.setAttribute("data-value", projectValue);
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.id = `project-${projectValue.replace(/[^a-zA-Z0-9]/g, "_")}`;
            checkbox.value = projectValue;
            // Restore previous checkbox state if it existed
            checkbox.checked = existingStates.get(projectValue) || false;
            const label = document.createElement("label");
            label.setAttribute("for", checkbox.id);
            label.textContent = projectLabel;
            option.appendChild(checkbox);
            option.appendChild(label);
            dropdown.appendChild(option);
        });
    }
    static populateCommandFilter(commands) {
        const dropdown = document.getElementById("commandFilterDropdown");
        if (!dropdown)
            return;
        // Preserve existing checkbox states before removing options
        const existingStates = new Map();
        const existingOptions = dropdown.querySelectorAll('.multi-select-option:not([data-value=""])');
        existingOptions.forEach((opt) => {
            const checkbox = opt.querySelector('input[type="checkbox"]');
            if (checkbox) {
                existingStates.set(checkbox.value, checkbox.checked);
            }
            opt.remove();
        });
        commands.forEach((command) => {
            // Handle both string and object formats
            let commandValue;
            let commandLabel;
            if (typeof command === "string") {
                commandValue = command;
                commandLabel = command;
            }
            else if (command && typeof command === "object") {
                commandValue = command.value || command.command || String(command);
                commandLabel =
                    command.label || command.command || command.value || String(command);
            }
            else {
                commandValue = String(command);
                commandLabel = String(command);
            }
            const option = document.createElement("div");
            option.className = "multi-select-option";
            option.setAttribute("data-value", commandValue);
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.id = `command-${commandValue.replace(/[^a-zA-Z0-9]/g, "_")}`;
            checkbox.value = commandValue;
            // Restore previous checkbox state if it existed
            checkbox.checked = existingStates.get(commandValue) || false;
            const label = document.createElement("label");
            label.setAttribute("for", checkbox.id);
            label.textContent =
                commandLabel.length > 40
                    ? commandLabel.substring(0, 37) + "..."
                    : commandLabel;
            label.title = commandLabel;
            option.appendChild(checkbox);
            option.appendChild(label);
            dropdown.appendChild(option);
        });
    }
    static populateDeviceFilter(devices) {
        const dropdown = document.getElementById("deviceFilterDropdown");
        if (!dropdown)
            return;
        // Preserve existing checkbox states before removing options
        const existingStates = new Map();
        const existingOptions = dropdown.querySelectorAll('.multi-select-option:not([data-value=""])');
        existingOptions.forEach((opt) => {
            const checkbox = opt.querySelector('input[type="checkbox"]');
            if (checkbox) {
                existingStates.set(checkbox.value, checkbox.checked);
            }
            opt.remove();
        });
        devices.forEach((device, index) => {
            // Handle device format: { value: "deviceId|hardwareHash", label: "Device Name" }
            let deviceValue;
            let deviceLabel;
            if (typeof device === "string") {
                deviceValue = device;
                deviceLabel = device;
            }
            else if (device && typeof device === "object") {
                deviceValue = device.value || String(device);
                deviceLabel = device.label || device.value || String(device);
            }
            else {
                deviceValue = String(device);
                deviceLabel = String(device);
            }
            const option = document.createElement("div");
            option.className = "multi-select-option";
            option.setAttribute("data-value", deviceValue);
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.id = `device-${index}`;
            checkbox.value = deviceValue;
            // Restore previous checkbox state if it existed
            checkbox.checked = existingStates.get(deviceValue) || false;
            const label = document.createElement("label");
            label.setAttribute("for", checkbox.id);
            label.textContent = deviceLabel;
            option.appendChild(checkbox);
            option.appendChild(label);
            dropdown.appendChild(option);
        });
    }
}
//# sourceMappingURL=filters.js.map
})();

// === events module ===
(function() {
// Event handling for ProcessLens Dashboard



window.EventHandlers = class EventHandlers {
    static setupEventListeners() {
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
    static setupActionButtons() {
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
                const vscode = window.vscode;
                vscode.postMessage({ type: "OPEN_COFFEE_LINK" });
            });
        }
        // Sign in button (placeholder)
        const signinBtn = document.getElementById("signinBtn");
        if (signinBtn) {
            signinBtn.addEventListener("click", () => {
                alert("Sign-in functionality coming soon! This will enable data sync across devices.");
            });
        }
    }
    static setupTableInteractions() {
        // Set up table sorting
        TableRenderer.setupTableSorting();
        // Set up command run buttons (delegated event handling)
        document.addEventListener("click", (e) => {
            const target = e.target;
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
    static setupColumnVisibility() {
        const menuBtn = document.querySelector(".column-menu-btn");
        const menu = document.querySelector(".column-menu");
        if (!menuBtn || !menu)
            return;
        // Toggle menu
        menuBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            menu.classList.toggle("element-hidden");
        });
        // Handle checkbox changes
        menu.addEventListener("change", (e) => {
            const target = e.target;
            if (target.type === "checkbox") {
                const column = target.getAttribute("data-column");
                if (column && dashboardState.visibleColumns.hasOwnProperty(column)) {
                    dashboardState.visibleColumns[column] = target.checked;
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
        Object.entries(dashboardState.visibleColumns).forEach(([column, isVisible]) => {
            const checkbox = menu.querySelector(`input[data-column="${column}"]`);
            if (checkbox) {
                checkbox.checked = isVisible;
            }
        });
    }
    static setupTimeFormatToggle() {
        const toggle = document.getElementById("timeFormatToggle");
        if (!toggle)
            return;
        toggle.value = dashboardState.timeFormat;
        toggle.addEventListener("change", () => {
            dashboardState.timeFormat = toggle.value;
            dashboardState.saveCurrentSettings();
            // Re-render table with new format
            TableRenderer.renderCommandTable(dashboardState.lastData.perCommand, dashboardState.lastData.runs);
        });
    }
    static setupTrendPeriodSelector() {
        const selector = document.getElementById("trendPeriodSelect");
        if (!selector)
            return;
        selector.value = dashboardState.trendPeriodDays.toString();
        selector.addEventListener("change", () => {
            dashboardState.trendPeriodDays = parseInt(selector.value);
            dashboardState.saveCurrentSettings();
            // Reload data to recalculate trends
            FilterManager.loadData();
        });
    }
    static setupChartTabs() {
        const tabs = document.querySelectorAll(".chart-tab");
        tabs.forEach((tab) => {
            tab.addEventListener("click", () => {
                const targetTab = tab.getAttribute("data-tab");
                if (!targetTab)
                    return;
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
                        const ChartRenderer = window.ChartRenderer;
                        ChartRenderer.renderPerformanceMatrix(dashboardState.lastData.perCommand);
                    }
                }
            });
        });
    }
    // Action handlers
    static runCommand(command) {
        const vscode = window.vscode;
        vscode.postMessage({
            type: "RUN_COMMAND",
            command: command,
        });
    }
    static deleteRun(runId) {
        const vscode = window.vscode;
        if (vscode) {
            // Send confirmation request to extension (webview can't show confirm dialogs)
            vscode.postMessage({
                type: "CONFIRM_DELETE_RUN",
                runId: runId,
            });
        }
    }
    static filterByCommand(command) {
        // Update command filter
        const dropdown = document.getElementById("commandFilterDropdown");
        if (dropdown) {
            // Uncheck all
            dropdown.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
                cb.checked = false;
            });
            // Check the specific command
            const targetCheckbox = dropdown.querySelector(`input[value="${command}"]`);
            if (targetCheckbox) {
                targetCheckbox.checked = true;
            }
        }
        FilterManager.handleMultiSelectChange("command", "All Commands");
    }
    static showFailedRuns(command) {
        // Filter by command and failed status
        EventHandlers.filterByCommand(command);
        // Set success filter to failed
        const successDropdown = document.getElementById("successFilterDropdown");
        if (successDropdown) {
            successDropdown
                .querySelectorAll('input[type="checkbox"]')
                .forEach((cb) => {
                cb.checked = false;
            });
            const failedCheckbox = successDropdown.querySelector('input[value="fail"]');
            if (failedCheckbox) {
                failedCheckbox.checked = true;
            }
        }
        FilterManager.handleMultiSelectChange("success", "All");
    }
    static exportData() {
        const vscode = window.vscode;
        vscode.postMessage({ type: "EXPORT_DATA" });
    }
    static importData() {
        const vscode = window.vscode;
        vscode.postMessage({ type: "IMPORT_DATA" });
    }
    static clearAllData() {
        if (confirm("Are you sure you want to delete ALL ProcessLens data? This cannot be undone!")) {
            const vscode = window.vscode;
            vscode.postMessage({ type: "CLEAR_DATA" });
        }
    }
    static cancelRunningTask() {
        const vscode = window.vscode;
        vscode.postMessage({ type: "CANCEL_TASK" });
    }
    // Message handlers from extension
    static handleMessage(message) {
        switch (message.type) {
            case "DATA":
                EventHandlers.handleDataMessage(message);
                break;
            case "UPDATED":
                // Reload data when commands are executed
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
    static handleDataMessage(message) {
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
    static handleCommandStarted(message) {
        dashboardState.isCommandRunning = true;
        // Show cancel button
        const cancelBtn = document.getElementById("cancelTaskBtn");
        if (cancelBtn) {
            cancelBtn.classList.remove("element-hidden");
        }
        // Update status
        console.log("Command started:", message.command);
    }
    static handleCommandCompleted(message) {
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
    static handleExportComplete(message) {
        if (message.success) {
            alert("Data exported successfully!");
        }
        else {
            alert("Export failed: " + (message.error || "Unknown error"));
        }
    }
    static handleImportComplete(message) {
        if (message.success) {
            alert("Data imported successfully!");
            FilterManager.loadData(); // Reload to show imported data
        }
        else {
            alert("Import failed: " + (message.error || "Unknown error"));
        }
    }
    static renderDashboard() {
        const { runs, perCommand, projects, commands, devices } = dashboardState.lastData;
        // Use global classes directly (available after bundling)
        const ChartRenderer = window.ChartRenderer;
        const TableRenderer = window.TableRenderer;
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
        }
        catch (error) {
            console.error("Chart rendering error:", error);
        }
        TableRenderer.renderCommandTable(perCommand, runs);
        TableRenderer.renderGlobalStats(runs, perCommand, projects, commands, devices);
        TableRenderer.renderRecentRuns(runs.slice(-10));
        ChartRenderer.setDeviceIconColors();
    }
    static setupDeviceTooltips() {
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
            const target = e.target;
            if (target && target.matches(".device-icon, .device-icon-small")) {
                const tooltipText = target.getAttribute("data-tooltip");
                if (tooltipText) {
                    tooltip.textContent = tooltipText;
                    tooltip.style.display = "block";
                    // Position tooltip near cursor, accounting for scroll
                    const rect = target.getBoundingClientRect();
                    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
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
                    }
                    else {
                        // Position to the right in Command Summary (more space)
                        tooltip.style.left = rect.right + scrollLeft + 10 + "px";
                        tooltip.style.top = rect.top + scrollTop - 5 + "px";
                    }
                }
            }
        });
        document.addEventListener("mouseout", function (e) {
            const target = e.target;
            if (target && target.matches(".device-icon, .device-icon-small")) {
                tooltip.style.display = "none";
            }
        });
    }
    static handleDataCleared() {
        // Reset filters to default state
        dashboardState.currentFilters = {
            projectId: "",
            command: "",
            success: "all",
            window: "all",
            deviceInstance: null,
        };
        // Show empty state
        EventHandlers.showEmptyState();
        // Save the reset state
        dashboardState.saveCurrentSettings();
    }
    static handleProfileImported(message) {
        if (message.profile) {
            EventHandlers.applyProfile(message.profile);
        }
    }
    static showEmptyState() {
        // Hide loading and show empty state
        document.querySelector(".loading")?.classList.add("element-hidden");
        document.querySelector(".cards")?.classList.add("element-hidden");
        document.querySelector(".empty-state")?.classList.remove("element-hidden");
    }
    static applyProfile(profile) {
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
//# sourceMappingURL=events.js.map
})();

// === dashboard-main module ===
(function() {
// Main ProcessLens Dashboard - Modular Version



// Initialize dashboard when DOM is ready
(function () {
    // Acquire VS Code API once and store globally
    if (!window.vscode) {
        window.vscode = window.acquireVsCodeApi();
    }
    const vscode = window.vscode;
    // Initialize dashboard
    function initializeDashboard() {
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
    }
    else {
        initializeDashboard();
    }
    // Expose global functions for debugging and compatibility
    window.ProcessLensDashboard = {
        state: dashboardState,
        loadData: () => FilterManager.loadData(),
        clearFilters: () => FilterManager.clearAllFilters(),
        exportData: () => EventHandlers.exportData(),
        importData: () => EventHandlers.importData(),
    };
    // Expose pagination functions globally for compatibility
    window.nextCommandPage = () => {
        const TableRenderer = window.TableRenderer;
        if (TableRenderer) {
            TableRenderer.nextCommandPage();
        }
    };
    window.prevCommandPage = () => {
        const TableRenderer = window.TableRenderer;
        if (TableRenderer) {
            TableRenderer.prevCommandPage();
        }
    };
})();
//# sourceMappingURL=dashboard-main.js.map
})();
