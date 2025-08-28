// Data formatting utilities for ProcessLens Dashboard

export class DataFormatters {
  public static formatDuration(
    ms: number,
    format: "human" | "raw" = "human"
  ): string {
    if (format === "raw") {
      return `${ms}ms`;
    }

    if (ms < 1000) {
      return `${Math.round(ms)}ms`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)}s`;
    } else if (ms < 3600000) {
      const minutes = Math.floor(ms / 60000);
      const seconds = Math.floor((ms % 60000) / 1000);
      return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
    } else {
      const hours = Math.floor(ms / 3600000);
      const minutes = Math.floor((ms % 3600000) / 60000);
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
  }

  public static formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";

    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  public static formatPercentage(value: number): string {
    return `${Math.round(value * 100)}%`;
  }

  public static formatNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + "M";
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + "K";
    }
    return num.toString();
  }

  public static formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  public static formatTrend(trend: string): string {
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

  public static formatImpactScore(score: number): string {
    if (score >= 80) return "HIGH";
    if (score >= 40) return "MEDIUM";
    return "LOW";
  }

  public static formatOptimizationPotential(potential: number): string {
    if (potential >= 0.8) return "HIGH";
    if (potential >= 0.4) return "MEDIUM";
    return "LOW";
  }

  public static truncateCommand(
    command: string,
    maxLength: number = 50
  ): string {
    if (command.length <= maxLength) return command;
    return command.substring(0, maxLength - 3) + "...";
  }

  public static formatDeviceInfo(device: any): string {
    if (!device) return "Unknown Device";

    const parts = [];
    if (device.os) parts.push(device.os);
    if (device.cpuModel) parts.push(device.cpuModel);
    if (device.memGB) parts.push(`${device.memGB}GB RAM`);

    return parts.join(" • ") || "Unknown Device";
  }

  public static createSparklineData(durations: number[]): string {
    if (!durations || durations.length < 2) return "";

    const max = Math.max(...durations);
    const min = Math.min(...durations);
    const range = max - min;

    if (range === 0) return "▬".repeat(durations.length);

    return durations
      .map((duration) => {
        const normalized = (duration - min) / range;
        const index = Math.floor(normalized * 7);
        return "▁▂▃▄▅▆▇█"[Math.min(index, 7)];
      })
      .join("");
  }

  public static sanitizeHtml(str: string): string {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  public static formatSuccessRate(rate: number, total: number): string {
    const percentage = DataFormatters.formatPercentage(rate);
    const failed = total - Math.round(rate * total);
    return failed > 0 ? `${percentage} (${failed} failed)` : percentage;
  }

  public static getRelativeTime(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return `${seconds}s ago`;
  }

  public static getDeviceInfo(run: any): {
    icon: string;
    color: string;
    tooltip: string;
    osName: string;
    osVersion: string;
  } {
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
      } else if (osLower.includes("linux")) {
        icon = "🐧";
        nerdFontIcon = "\uF17C"; // nf-fa-linux
        osName = "Linux";

        // Detect specific Linux distributions
        if (osLower.includes("ubuntu")) {
          nerdFontIcon = "\uF31B"; // nf-fa-ubuntu
          osName = "Ubuntu";
        } else if (osLower.includes("debian")) {
          nerdFontIcon = "\uF306"; // nf-fa-debian
          osName = "Debian";
        } else if (osLower.includes("fedora")) {
          nerdFontIcon = "\uF30A"; // nf-fa-fedora
          osName = "Fedora";
        } else if (osLower.includes("arch")) {
          nerdFontIcon = "\uF303"; // nf-fa-archlinux
          osName = "Arch";
        } else if (osLower.includes("centos")) {
          nerdFontIcon = "\uF304"; // nf-fa-centos
          osName = "CentOS";
        }
      } else if (osLower.includes("win")) {
        icon = "🪟";
        nerdFontIcon = "\uF17A"; // nf-fa-windows
        osName = "Windows";
      } else if (osLower.includes("freebsd")) {
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

  public static getDeviceColor(deviceId: string): string {
    // Generate a consistent color for each device ID
    let hash = 0;
    for (let i = 0; i < deviceId.length; i++) {
      hash = deviceId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 45%, 60%)`;
  }

  public static supportsNerdFonts(): boolean {
    // Test if Nerd Fonts are available by checking a known character
    const testCanvas = document.createElement("canvas");
    const ctx = testCanvas.getContext("2d");
    if (!ctx) return false;

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
