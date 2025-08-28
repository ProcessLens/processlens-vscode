// Chart rendering functionality for ProcessLens Dashboard
import { EventRecord, CommandSummary } from "./types.js";
import { DataFormatters } from "./formatters.js";
import { dashboardState } from "./state.js";

declare var Chart: any;

export class ChartRenderer {
  public static renderChart(runs: EventRecord[]): void {
    // Check if Chart.js is available
    if (typeof Chart === "undefined") {
      console.error("Chart.js is not available");
      return;
    }

    const canvas = document.getElementById(
      "durationChart"
    ) as HTMLCanvasElement;
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
      success:
        run.success !== undefined ? run.success : (run as any).exitCode === 0,
      command: run.command,
      deviceId: run.deviceId,
      hardwareHash: run.hardwareHash,
      projectName: run.projectName,
      // Include device data for proper OS detection
      device: run.device,
      osVersion: run.osVersion,
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

    if (chartData.length === 0) {
      throw new Error("No valid timing data found");
    }

    // Create point colors based on success/failure
    const pointColors = chartData.map((point) => {
      if (point.success === true) return "#22c55e"; // Green for success
      if (point.success === false) return "#ef4444"; // Red for failure
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
              callback: function (value: any) {
                const date = new Date(value);
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
                return DataFormatters.formatDuration(
                  Math.round(value),
                  dashboardState.timeFormat
                );
              },
            },
          },
        },
        plugins: {
          tooltip: {
            callbacks: {
              title: (context: any) => {
                const dataPoint = chartData[context[0].dataIndex];
                return DataFormatters.truncateCommand(dataPoint.command, 50);
              },
              label: (context: any) => {
                const dataPoint = chartData[context.dataIndex];
                const duration = DataFormatters.formatDuration(
                  context.parsed.y,
                  dashboardState.timeFormat
                );
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

  public static renderPerformanceMatrix(perCommand: CommandSummary[]): void {
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
    let fastThreshold: number, slowThreshold: number;

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
      let speedClass = "speed-medium";
      if (cmd.avgMs <= fastThreshold) {
        speedClass = "speed-fast";
      } else if (cmd.avgMs >= slowThreshold) {
        speedClass = "speed-slow";
      }
      card.classList.add(speedClass);

      // Create card content
      const commandName = DataFormatters.truncateCommand(cmd.command, 25);
      const duration = DataFormatters.formatDuration(
        cmd.avgMs,
        dashboardState.timeFormat
      );
      const successRate = DataFormatters.formatPercentage(cmd.successRate);
      const runs = cmd.runs;

      card.innerHTML = `
        <div class="command-name" title="${DataFormatters.sanitizeHtml(
          cmd.command
        )}">
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
          const FilterManager = (window as any).FilterManager;
          if (FilterManager) {
            FilterManager.loadData();
          }
        }
      });

      grid.appendChild(card);
    });
  }

  public static applyMatrixBarWidths(): void {
    // Apply widths to matrix bars
    document
      .querySelectorAll(".success-bar[data-width], .impact-bar[data-width]")
      .forEach((bar) => {
        const width = bar.getAttribute("data-width");
        if (width) {
          (bar as HTMLElement).style.width = `${width}%`;
        }
      });
  }

  public static setDeviceIconColors(): void {
    // Apply device-specific colors using data attributes (CSP-compliant)
    const deviceIcons = document.querySelectorAll("[data-device-color]");

    deviceIcons.forEach((icon) => {
      const color = icon.getAttribute("data-device-color");
      if (color) {
        (icon as HTMLElement).style.color = color;
      }
    });
  }

  public static createSparklineChart(
    container: HTMLElement,
    data: number[]
  ): void {
    if (!data || data.length < 2) {
      container.innerHTML = '<span class="no-sparkline">—</span>';
      return;
    }

    const sparkline = DataFormatters.createSparklineData(data);
    container.innerHTML = `<span class="sparkline" title="Recent duration trend">${sparkline}</span>`;
  }
}
