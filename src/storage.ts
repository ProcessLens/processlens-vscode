import * as vscode from "vscode";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export interface EventRecord {
  tsStart: number;
  tsEnd: number;
  durationMs: number;
  exitCode?: number;
  command: string;
  cwd: string;
  projectId: string;
  projectName: string;

  // Enhanced project identification (for global database)
  globalProjectId?: string; // Git-based, machine-independent
  localProjectId?: string; // Machine-specific
  repositoryName?: string; // e.g., "microsoft/vscode"
  gitOriginUrl?: string; // For team collaboration

  // Device identity
  deviceId: string;
  hardwareHash: string;

  // Hardware snapshot (for labels)
  device?: {
    os: string;
    arch: string;
    cpuModel?: string;
    cpus?: number;
    memGB?: number;
    node: string;
  };
}

export interface Filters {
  projectId?: string | string[];
  command?: string | string[];
  success?: "all" | "success" | "fail" | ("all" | "success" | "fail")[];
  window?: "all" | "1h" | "24h" | "7d" | "30d" | "90d" | "1y" | "custom";
  customFrom?: string; // ISO date string for custom range start
  customTo?: string; // ISO date string for custom range end
  deviceInstance?:
    | { deviceId: string; hardwareHash: string }
    | { deviceId: string; hardwareHash: string }[];
  limit?: number;
}

export interface CommandSummary {
  command: string;
  runs: number;
  avgMs: number;
  medianMs: number;
  p95Ms: number;
  minMs: number;
  maxMs: number;
  successRate: number;
  failedRuns: number;
  recentTrend: "up" | "down" | "stable";
  recentDurations: number[]; // Last 20 runs for sparklines

  // Impact Analysis
  totalTimeMs: number; // Total time consumed (duration × frequency)
  impactScore: number; // Normalized impact score (0-100)
  timePerDayMs: number; // Average time per day in milliseconds

  // Performance Predictions
  projectedSavingsMs?: number; // Potential time savings if optimized
  optimizationPotential?: "high" | "medium" | "low"; // Optimization priority
  trendVelocity?: number; // Rate of performance change (ms/day)
}

export interface EventStore {
  append(event: EventRecord): Promise<void>;
  recent(filters: Filters, limit: number): Promise<EventRecord[]>;
  aggregateByCommand(
    filters: Filters,
    trendPeriodDays?: number
  ): Promise<CommandSummary[]>;
  clear(): Promise<void>;
  deleteRun(tsStart: number, command: string): Promise<void>;
  getRecentCommands(projectId?: string, limit?: number): Promise<string[]>;
  getProjectStats(): Promise<
    { projectId: string; projectName: string; runs: number }[]
  >;
}

export class JsonlEventStore implements EventStore {
  private filePath: string;

  constructor(private context: vscode.ExtensionContext) {
    this.filePath = path.join(context.globalStorageUri.fsPath, "events.jsonl");
  }

  async append(event: EventRecord): Promise<void> {
    await this.ensureStorageDir();
    await fs.promises.appendFile(
      this.filePath,
      JSON.stringify(event) + os.EOL,
      "utf8"
    );
  }

  async recent(filters: Filters, limit: number = 100): Promise<EventRecord[]> {
    try {
      const content = await fs.promises.readFile(this.filePath, "utf8");
      const lines = content.split(/\r?\n/).filter(Boolean);
      const events = lines.map((line) => JSON.parse(line) as EventRecord);

      return this.applyFilters(events, filters).slice(-limit);
    } catch {
      return [];
    }
  }

  async aggregateByCommand(
    filters: Filters,
    trendPeriodDays: number = 7
  ): Promise<CommandSummary[]> {
    const events = await this.recent(filters, 10000); // Get more for aggregation
    const byCommand = new Map<string, EventRecord[]>();

    for (const event of events) {
      if (!byCommand.has(event.command)) {
        byCommand.set(event.command, []);
      }
      byCommand.get(event.command)!.push(event);
    }

    return Array.from(byCommand.entries())
      .map(([command, events]) => {
        // Sort events by timestamp for trend analysis
        const sortedEvents = events.sort((a, b) => a.tsStart - b.tsStart);
        const durations = sortedEvents.map((e) => e.durationMs);
        const sortedDurations = [...durations].sort((a, b) => a - b);

        // Calculate statistics
        const avgMs =
          durations.reduce((sum, d) => sum + d, 0) / durations.length;
        const medianMs =
          sortedDurations[Math.floor(sortedDurations.length / 2)];
        const p95Index = Math.floor(sortedDurations.length * 0.95);
        const p95Ms =
          sortedDurations[p95Index] ||
          sortedDurations[sortedDurations.length - 1];
        const minMs = sortedDurations[0];
        const maxMs = sortedDurations[sortedDurations.length - 1];

        const successful = events.filter((e) => e.exitCode === 0).length;
        const successRate = successful / events.length;
        const failedRuns = events.length - successful;

        // Calculate recent trend (configurable period vs previous period)
        const now = Date.now();
        const periodMs = trendPeriodDays * 24 * 60 * 60 * 1000;
        const periodAgo = now - periodMs;
        const doublePeriodAgo = now - 2 * periodMs;

        const recentEvents = sortedEvents.filter((e) => e.tsStart >= periodAgo);
        const previousEvents = sortedEvents.filter(
          (e) => e.tsStart >= doublePeriodAgo && e.tsStart < periodAgo
        );

        let recentTrend: "up" | "down" | "stable" = "stable";
        if (recentEvents.length > 0 && previousEvents.length > 0) {
          const recentAvg =
            recentEvents.reduce((sum, e) => sum + e.durationMs, 0) /
            recentEvents.length;
          const previousAvg =
            previousEvents.reduce((sum, e) => sum + e.durationMs, 0) /
            previousEvents.length;
          const change = (recentAvg - previousAvg) / previousAvg;

          if (change > 0.1) recentTrend = "up";
          else if (change < -0.1) recentTrend = "down";
        }

        // Get last 20 runs for sparklines
        const recentDurations = durations.slice(-20);

        // Calculate impact analysis
        const totalTimeMs = durations.reduce((sum, d) => sum + d, 0);

        // Calculate time per day (based on data span)
        const oldestEvent = sortedEvents[0];
        const newestEvent = sortedEvents[sortedEvents.length - 1];
        const dataSpanDays = Math.max(
          1,
          (newestEvent.tsStart - oldestEvent.tsStart) / (24 * 60 * 60 * 1000)
        );
        const timePerDay = totalTimeMs / dataSpanDays;

        return {
          command,
          runs: events.length,
          avgMs: Math.round(avgMs),
          medianMs: Math.round(medianMs),
          p95Ms: Math.round(p95Ms),
          minMs: Math.round(minMs),
          maxMs: Math.round(maxMs),
          successRate: Math.round(successRate * 100) / 100,
          failedRuns,
          recentTrend,
          recentDurations,

          // Impact Analysis
          totalTimeMs,
          impactScore: 0, // Will be calculated after all commands are processed
          timePerDayMs: timePerDay,
        };
      })
      .map((summary, index, array) => {
        // Calculate impact score (0-100) based on total time relative to highest
        const maxTotalTime = Math.max(...array.map((s) => s.totalTimeMs));
        const impactScore =
          maxTotalTime > 0
            ? Math.round((summary.totalTimeMs / maxTotalTime) * 100)
            : 0;

        // Calculate performance predictions
        const predictions = this.calculatePerformancePredictions(
          summary,
          events
        );

        return {
          ...summary,
          impactScore,
          ...predictions,
        };
      })
      .sort((a, b) => b.runs - a.runs);
  }

  private calculatePerformancePredictions(
    summary: any,
    commandEvents: EventRecord[]
  ) {
    // Sort events by timestamp for trend analysis
    const sortedEvents = commandEvents.sort((a, b) => a.tsStart - b.tsStart);

    if (sortedEvents.length < 3) {
      // Need at least 3 data points for meaningful predictions
      return {
        projectedSavingsMs: 0,
        optimizationPotential: "low" as const,
        trendVelocity: 0,
      };
    }

    // Calculate trend velocity (performance change over time)
    const firstHalf = sortedEvents.slice(
      0,
      Math.floor(sortedEvents.length / 2)
    );
    const secondHalf = sortedEvents.slice(Math.floor(sortedEvents.length / 2));

    const firstHalfAvg =
      firstHalf.reduce((sum, e) => sum + e.durationMs, 0) / firstHalf.length;
    const secondHalfAvg =
      secondHalf.reduce((sum, e) => sum + e.durationMs, 0) / secondHalf.length;

    const timeSpanDays = Math.max(
      1,
      (secondHalf[secondHalf.length - 1].tsStart - firstHalf[0].tsStart) /
        (24 * 60 * 60 * 1000)
    );
    const trendVelocity = (secondHalfAvg - firstHalfAvg) / timeSpanDays; // ms change per day

    // Calculate optimization potential based on multiple factors
    let optimizationScore = 0;

    // Factor 1: High impact commands have more optimization potential
    optimizationScore += summary.impactScore * 0.4;

    // Factor 2: Commands getting slower have high optimization potential
    if (trendVelocity > 100) {
      // Getting slower by >100ms/day
      optimizationScore += 30;
    } else if (trendVelocity > 10) {
      // Getting slower by >10ms/day
      optimizationScore += 15;
    }

    // Factor 3: High variability suggests optimization opportunities
    const durations = sortedEvents.map((e) => e.durationMs);
    const variance = this.calculateVariance(durations);
    const coefficientOfVariation = Math.sqrt(variance) / summary.avgMs;
    if (coefficientOfVariation > 0.5) {
      // High variability
      optimizationScore += 20;
    } else if (coefficientOfVariation > 0.3) {
      optimizationScore += 10;
    }

    // Factor 4: Frequently run commands have more optimization potential
    if (summary.runs > 50) {
      optimizationScore += 15;
    } else if (summary.runs > 20) {
      optimizationScore += 10;
    } else if (summary.runs > 10) {
      optimizationScore += 5;
    }

    // Determine optimization potential category
    let optimizationPotential: "high" | "medium" | "low";
    if (optimizationScore >= 70) {
      optimizationPotential = "high";
    } else if (optimizationScore >= 40) {
      optimizationPotential = "medium";
    } else {
      optimizationPotential = "low";
    }

    // Calculate projected savings (conservative estimate)
    let projectedSavingsMs = 0;

    if (optimizationPotential === "high") {
      // Assume 30% improvement for high-potential commands
      const potentialImprovement = summary.avgMs * 0.3;
      projectedSavingsMs = potentialImprovement * summary.runs;
    } else if (optimizationPotential === "medium") {
      // Assume 15% improvement for medium-potential commands
      const potentialImprovement = summary.avgMs * 0.15;
      projectedSavingsMs = potentialImprovement * summary.runs;
    } else {
      // Assume 5% improvement for low-potential commands
      const potentialImprovement = summary.avgMs * 0.05;
      projectedSavingsMs = potentialImprovement * summary.runs;
    }

    return {
      projectedSavingsMs: Math.round(projectedSavingsMs),
      optimizationPotential,
      trendVelocity: Math.round(trendVelocity * 100) / 100, // Round to 2 decimal places
    };
  }

  private calculateVariance(numbers: number[]): number {
    const mean = numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
    const squaredDifferences = numbers.map((n) => Math.pow(n - mean, 2));
    return squaredDifferences.reduce((sum, sq) => sum + sq, 0) / numbers.length;
  }

  private applyFilters(events: EventRecord[], filters: Filters): EventRecord[] {
    let filtered = events;

    if (filters.projectId) {
      if (Array.isArray(filters.projectId)) {
        filtered = filtered.filter((e) =>
          filters.projectId!.includes(e.projectId)
        );
      } else {
        filtered = filtered.filter((e) => e.projectId === filters.projectId);
      }
    }

    if (filters.command) {
      if (Array.isArray(filters.command)) {
        filtered = filtered.filter((e) => filters.command!.includes(e.command));
      } else {
        filtered = filtered.filter((e) => e.command === filters.command);
      }
    }

    if (filters.success) {
      if (Array.isArray(filters.success)) {
        const successFilters = filters.success;
        filtered = filtered.filter((e) => {
          if (
            successFilters.includes("success") &&
            (!e.exitCode || e.exitCode === 0)
          )
            return true;
          if (successFilters.includes("fail") && e.exitCode && e.exitCode !== 0)
            return true;
          if (successFilters.includes("all")) return true;
          return false;
        });
      } else {
        if (filters.success === "success") {
          filtered = filtered.filter((e) => !e.exitCode || e.exitCode === 0);
        } else if (filters.success === "fail") {
          filtered = filtered.filter((e) => e.exitCode && e.exitCode !== 0);
        }
      }
    }

    if (filters.window && filters.window !== "all") {
      if (
        filters.window === "custom" &&
        filters.customFrom &&
        filters.customTo
      ) {
        // Handle custom date range
        const fromDate = new Date(filters.customFrom);
        const toDate = new Date(filters.customTo);
        // Set time to start/end of day for better UX
        fromDate.setHours(0, 0, 0, 0);
        toDate.setHours(23, 59, 59, 999);

        const fromTimestamp = fromDate.getTime();
        const toTimestamp = toDate.getTime();

        filtered = filtered.filter(
          (e) => e.tsEnd >= fromTimestamp && e.tsEnd <= toTimestamp
        );
      } else {
        // Handle predefined time windows
        const now = Date.now();
        let cutoff: number;
        switch (filters.window) {
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
            cutoff = 0;
        }
        filtered = filtered.filter((e) => e.tsEnd >= cutoff);
      }
    }

    if (filters.deviceInstance) {
      if (Array.isArray(filters.deviceInstance)) {
        filtered = filtered.filter((e) =>
          (
            filters.deviceInstance as {
              deviceId: string;
              hardwareHash: string;
            }[]
          ).some(
            (device: { deviceId: string; hardwareHash: string }) =>
              e.deviceId === device.deviceId &&
              e.hardwareHash === device.hardwareHash
          )
        );
      } else {
        const { deviceId, hardwareHash } = filters.deviceInstance as {
          deviceId: string;
          hardwareHash: string;
        };
        filtered = filtered.filter(
          (e) => e.deviceId === deviceId && e.hardwareHash === hardwareHash
        );
      }
    }

    return filtered;
  }

  async clear(): Promise<void> {
    try {
      await fs.promises.unlink(this.filePath);
    } catch {
      // File doesn't exist, nothing to clear
    }
  }

  async deleteRun(tsStart: number, command: string): Promise<void> {
    try {
      const content = await fs.promises.readFile(this.filePath, "utf8");
      const lines = content.split(/\r?\n/).filter(Boolean);
      const events = lines.map((line) => JSON.parse(line) as EventRecord);

      // Filter out the specific run to delete
      const filteredEvents = events.filter(
        (event: EventRecord) =>
          !(event.tsStart === tsStart && event.command === command)
      );

      // Rewrite the file without the deleted run
      const jsonlContent = filteredEvents
        .map((event: EventRecord) => JSON.stringify(event))
        .join("\n");

      if (jsonlContent) {
        await fs.promises.writeFile(this.filePath, jsonlContent + "\n");
      } else {
        // If no events left, delete the file
        await fs.promises.unlink(this.filePath);
      }
    } catch (error) {
      console.error("Error deleting run:", error);
      throw error;
    }
  }

  async getRecentCommands(
    projectId?: string,
    limit: number = 10
  ): Promise<string[]> {
    const events = await this.recent(projectId ? { projectId } : {}, 1000);
    const commandCounts = new Map<string, number>();

    // Count command frequency, most recent first
    for (const event of events.reverse()) {
      const count = commandCounts.get(event.command) || 0;
      commandCounts.set(event.command, count + 1);
    }

    // Sort by frequency, then return unique commands
    return Array.from(commandCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([command]) => command);
  }

  async getProjectStats(): Promise<
    { projectId: string; projectName: string; runs: number }[]
  > {
    const events = await this.recent({}, 10000);
    const projectCounts = new Map<
      string,
      { projectName: string; runs: number }
    >();

    for (const event of events) {
      const existing = projectCounts.get(event.projectId) || {
        projectName: event.projectName,
        runs: 0,
      };
      existing.runs += 1;
      projectCounts.set(event.projectId, existing);
    }

    return Array.from(projectCounts.entries())
      .map(([projectId, stats]) => ({
        projectId,
        projectName: stats.projectName,
        runs: stats.runs,
      }))
      .sort((a, b) => b.runs - a.runs);
  }

  private async ensureStorageDir(): Promise<void> {
    await vscode.workspace.fs.createDirectory(this.context.globalStorageUri);
  }
}
