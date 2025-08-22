import * as os from "os";
import * as crypto from "crypto";

export interface HardwareInfo {
  os: string;
  arch: string;
  cpuModel?: string;
  cpus?: number;
  memGB?: number;
  node: string;
}

export function getHardwareInfo(): HardwareInfo {
  const cpuInfo = os.cpus();
  return {
    os: os.platform(),
    arch: os.arch(),
    cpuModel: cpuInfo[0]?.model,
    cpus: cpuInfo.length,
    memGB: Math.round(os.totalmem() / (1024 * 1024 * 1024)),
    node: process.version,
  };
}

export function computeHardwareHash(info: HardwareInfo): string {
  // Use deterministic fields for hardware identity
  const hashInput = [
    info.os,
    info.arch,
    info.cpuModel || "unknown",
    info.cpus || 0,
    info.memGB || 0,
  ].join("|");

  // Simple FNV-1a hash implementation
  let hash = 2166136261; // FNV offset basis
  for (let i = 0; i < hashInput.length; i++) {
    hash ^= hashInput.charCodeAt(i);
    hash *= 16777619; // FNV prime
  }
  return (hash >>> 0).toString(16); // Convert to unsigned 32-bit hex
}

export function getHardwareLabel(info: HardwareInfo): string {
  const os = info.os === "darwin" ? "macOS" : info.os;
  const arch = info.arch;
  const cpu = info.cpuModel ? info.cpuModel.split(" ")[0] : "CPU";
  const cores = info.cpus ? `${info.cpus}-core` : "";
  const mem = info.memGB ? `${info.memGB}GB` : "";

  return [os, arch, cpu, cores, mem].filter(Boolean).join(" • ");
}
