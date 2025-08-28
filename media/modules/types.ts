// TypeScript interfaces and types for ProcessLens Dashboard

// VS Code API types
export interface VsCodeApi {
  postMessage(message: any): void;
  setState(state: any): void;
  getState(): any;
}

// Chart.js types (basic interface for the bundled version)
declare var Chart: any;

export interface EventRecord {
  tsStart: number;
  tsEnd: number;
  durationMs: number;
  exitCode?: number;
  command: string;
  cwd: string;
  projectId: string;
  projectName: string;
  deviceId: string;
  hardwareHash: string;
  success?: boolean;

  // Hardware snapshot (for labels)
  device?: {
    os: string;
    arch: string;
    cpuModel?: string;
    cpus?: number;
    memGB?: number;
    node: string;
  };

  // Enhanced device info
  osVersion: string;
  cpuModel: string;
  cpuCores: number;
  totalMemoryGB: number;
  nodeVersion: string;
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
  totalTimeMs: number;
  impactScore: number;
  timePerDayMs: number;
  projectedSavingsMs: number;
  optimizationPotential: number;
  trend: string;
  sparkline: number[];
}

export interface Filters {
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

export interface LastData {
  runs: EventRecord[];
  perCommand: CommandSummary[];
  projects: string[];
  commands: string[];
  devices: string[];
}

export interface ColumnVisibility {
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

export interface CommandTableSort {
  column: string;
  direction: "asc" | "desc";
}

// DOM Extensions
export interface VsCodeApi {
  postMessage(message: any): void;
  setState(state: any): void;
  getState(): any;
}

export interface WindowExtensions {
  acquireVsCodeApi(): VsCodeApi;
}

export interface HTMLElementExtensions {
  closest(selector: string): HTMLElement | null;
}

export interface DocumentExtensions {
  getElementById(id: string): HTMLElement | null;
  querySelector(selector: string): HTMLElement | null;
  querySelectorAll(selector: string): NodeListOf<HTMLElement>;
}

declare global {
  interface Window extends WindowExtensions {}
  interface HTMLElement extends HTMLElementExtensions {}
  interface Document extends DocumentExtensions {}
}
