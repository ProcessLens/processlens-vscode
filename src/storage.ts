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
  window?: "all" | "24h" | "7d" | "30d";
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
}

export interface EventStore {
  append(event: EventRecord): Promise<void>;
  recent(filters: Filters, limit: number): Promise<EventRecord[]>;
  aggregateByCommand(
    filters: Filters,
    trendPeriodDays?: number
  ): Promise<CommandSummary[]>;
  clear(): Promise<void>;
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
        };
      })
      .sort((a, b) => b.runs - a.runs);
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
      const now = Date.now();
      let cutoff: number;
      switch (filters.window) {
        case "24h":
          cutoff = now - 24 * 60 * 60 * 1000;
          break;
        case "7d":
          cutoff = now - 7 * 24 * 60 * 60 * 1000;
          break;
        case "30d":
          cutoff = now - 30 * 24 * 60 * 60 * 1000;
          break;
        default:
          cutoff = 0;
      }
      filtered = filtered.filter((e) => e.tsEnd >= cutoff);
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
