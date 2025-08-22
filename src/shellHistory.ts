import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export interface HistoryEntry {
  command: string;
  timestamp?: number;
  frequency: number;
}

function getShellHistoryFiles(): string[] {
  const homeDir = os.homedir();
  const possibleFiles = [
    path.join(homeDir, ".bash_history"),
    path.join(homeDir, ".zsh_history"),
    path.join(homeDir, ".fish_history"),
    path.join(homeDir, ".history"),
  ];

  return possibleFiles.filter((file) => {
    try {
      return fs.existsSync(file) && fs.statSync(file).isFile();
    } catch {
      return false;
    }
  });
}

function parseZshHistory(content: string): HistoryEntry[] {
  const entries: HistoryEntry[] = [];
  const lines = content.split("\n").filter(Boolean);

  for (const line of lines) {
    // Zsh history format: : <timestamp>:<elapsed>;<command>
    const match = line.match(/^:\s*(\d+):\d+;(.+)$/);
    if (match) {
      const [, timestamp, command] = match;
      entries.push({
        command: command.trim(),
        timestamp: parseInt(timestamp) * 1000, // Convert to milliseconds
        frequency: 1,
      });
    } else if (line.trim() && !line.startsWith("#")) {
      // Fallback for simple format
      entries.push({
        command: line.trim(),
        frequency: 1,
      });
    }
  }

  return entries;
}

function parseBashHistory(content: string): HistoryEntry[] {
  const entries: HistoryEntry[] = [];
  const lines = content.split("\n").filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Check if line starts with timestamp (bash HISTTIMEFORMAT)
    if (line.startsWith("#") && /^\#\d+$/.test(line)) {
      // Next line should be the command
      if (i + 1 < lines.length) {
        const command = lines[i + 1].trim();
        if (command) {
          entries.push({
            command,
            timestamp: parseInt(line.substring(1)) * 1000,
            frequency: 1,
          });
        }
        i++; // Skip the command line in next iteration
      }
    } else if (!line.startsWith("#")) {
      // Simple command without timestamp
      entries.push({
        command: line,
        frequency: 1,
      });
    }
  }

  return entries;
}

function parseFishHistory(content: string): HistoryEntry[] {
  const entries: HistoryEntry[] = [];
  const lines = content.split("\n").filter(Boolean);

  let currentEntry: Partial<HistoryEntry> = {};

  for (const line of lines) {
    if (line.startsWith("- cmd: ")) {
      if (currentEntry.command) {
        entries.push({
          command: currentEntry.command,
          timestamp: currentEntry.timestamp,
          frequency: 1,
        });
      }
      currentEntry = { command: line.substring(7).trim() };
    } else if (line.startsWith("  when: ") && currentEntry.command) {
      currentEntry.timestamp = parseInt(line.substring(8).trim()) * 1000;
    }
  }

  // Add the last entry
  if (currentEntry.command) {
    entries.push({
      command: currentEntry.command,
      timestamp: currentEntry.timestamp,
      frequency: 1,
    });
  }

  return entries;
}

export async function getShellHistory(
  limit: number = 1000
): Promise<HistoryEntry[]> {
  const historyFiles = getShellHistoryFiles();
  let allEntries: HistoryEntry[] = [];

  for (const file of historyFiles) {
    try {
      const content = await fs.promises.readFile(file, "utf8");
      let entries: HistoryEntry[] = [];

      const filename = path.basename(file);
      if (filename.includes("zsh")) {
        entries = parseZshHistory(content);
      } else if (filename.includes("fish")) {
        entries = parseFishHistory(content);
      } else {
        entries = parseBashHistory(content);
      }

      allEntries.push(...entries);
    } catch (error) {
      console.warn(`Failed to read shell history file ${file}:`, error);
    }
  }

  // Deduplicate and aggregate by command
  const commandMap = new Map<string, HistoryEntry>();

  for (const entry of allEntries) {
    // Filter out obviously bad commands
    if (
      !entry.command ||
      entry.command.length < 2 ||
      entry.command.startsWith("#") ||
      /^[\s\t]*$/.test(entry.command)
    ) {
      continue;
    }

    const existing = commandMap.get(entry.command);
    if (existing) {
      existing.frequency += 1;
      // Keep the most recent timestamp
      if (
        entry.timestamp &&
        (!existing.timestamp || entry.timestamp > existing.timestamp)
      ) {
        existing.timestamp = entry.timestamp;
      }
    } else {
      commandMap.set(entry.command, { ...entry });
    }
  }

  // Sort by frequency and recency
  const sortedEntries = Array.from(commandMap.values())
    .sort((a, b) => {
      // First by frequency
      if (a.frequency !== b.frequency) {
        return b.frequency - a.frequency;
      }
      // Then by timestamp (most recent first)
      const aTime = a.timestamp || 0;
      const bTime = b.timestamp || 0;
      return bTime - aTime;
    })
    .slice(0, limit);

  return sortedEntries;
}

export function filterHistoryEntries(
  entries: HistoryEntry[],
  filter: string
): HistoryEntry[] {
  if (!filter.trim()) return entries;

  const filterLower = filter.toLowerCase();
  return entries.filter((entry) =>
    entry.command.toLowerCase().includes(filterLower)
  );
}
