# ProcessLens (VS Code)

🚀 **Track and analyze build, test, and other process times to gain insights and iterate faster.** **Local-first** — no data leaves your machine.

ProcessLens helps you identify performance bottlenecks, track trends over time, and optimize your development workflow by providing detailed analytics on command execution times.

## ✨ Features

### 📊 **Comprehensive Dashboard**

- **Global Stats**: Total runs, commands tracked, success rate, and active projects
- **Recent Durations Chart**: Visual timeline of command execution times with hover details
- **Command Summary Table**: Detailed statistics with customizable columns
- **Recent Runs**: Last 10 command executions with trend indicators

### 📈 **Advanced Analytics**

- **Statistical Insights**: Average, Median, P95, Min/Max execution times
- **7-Day Trend Analysis**: Track if commands are getting faster (↘), slower (↗), or stable (→)
- **Success Rate Monitoring**: Track command reliability over time
- **Hardware Change Detection**: Automatic annotations when your hardware configuration changes

### 🎛️ **Interactive Features**

- **Customizable Columns**: Show/hide statistics columns via 3-dot menu (⋯)
- **Trend Sparklines**: Mini charts showing recent performance trends
- **Clickable Analysis**: Click runs/success columns to filter recent runs
- **One-Click Re-run**: Play buttons (▶) to instantly re-execute any command
- **Smart Filtering**: Filter by project, command, time window, success status, and device

### 🔧 **Command Execution**

- **Shell History Integration**: Browse and execute commands from bash/zsh/fish history
- **Package.json Scripts**: Automatic discovery and execution of npm/yarn scripts
- **Custom Commands**: Run any shell command with full timing and status tracking
- **Multi-Project Support**: Track commands across different workspaces

## 🚀 Getting Started

### Installation

1. Install ProcessLens from the VS Code Extensions marketplace
2. Open any workspace/project
3. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
4. Type "ProcessLens: Run Command" and select it
5. Choose a command to run and start tracking!

### Commands

- **ProcessLens: Run Command** — Execute and time any command (package.json scripts, shell history, or custom)
- **ProcessLens: Open Dashboard** — View your comprehensive performance analytics

### Quick Tips

💡 **Browse Shell History**: Select "📜 Browse Shell History" in the command picker to access your recent terminal commands

💡 **Package.json Scripts**: Your project's npm/yarn scripts are automatically discovered and available in the command picker

💡 **Column Customization**: Click the ⋯ button in Command Summary to show/hide statistical columns

💡 **Trend Analysis**: Enable the "Trend" column to see 7-day performance trends at a glance

💡 **Hardware Tracking**: ProcessLens automatically detects hardware changes and marks them on your charts

## 📊 Dashboard Guide

### Global Stats (Top Bar)

- **Total Runs**: Number of commands executed
- **Commands Tracked**: Unique commands monitored
- **Success Rate**: Percentage of successful executions
- **Active Projects**: Number of different projects/workspaces

### Chart Features

- **Color-coded dots**: Green (success), Red (failure), Yellow (unknown)
- **Hardware annotations**: Vertical lines marking hardware changes
- **Interactive tooltips**: Hover for command details and execution info
- **Hover legend**: Detailed command information appears below chart

### Command Summary Table

- **Default columns**: Command, Runs, Average, Success Rate
- **Optional columns**: Median, P95, Min, Max, Trend, Sparkline
- **Sortable**: Click any column header to sort
- **Clickable**: Click run counts to filter, click success rates to show failures
- **Play buttons**: Re-run any command instantly

### Statistical Columns Explained

- **Average**: Mean execution time (can be skewed by outliers)
- **Median**: Middle value (more reliable than average)
- **P95**: 95th percentile (worst-case performance indicator)
- **Min/Max**: Fastest and slowest recorded times
- **Trend**: 7-day performance comparison (↗ slower, ↘ faster, → stable)
- **Sparkline**: Mini chart of recent execution times

## ⚙️ Settings

- `processlens.captureDeviceInfo`: Include OS/CPU/RAM/Node version in events (default: true)
- `processlens.statusBar.enabled`: Show status bar item (default: true)
- `processlens.statusBar.priority`: Status bar item priority (default: -10)
- `processlens.storage.backend`: Storage backend - "jsonl" for MVP, "sqlite" planned (default: "jsonl")

## 🔒 Privacy & Data

**100% Local-First**: All data stays on your machine. ProcessLens stores timing data locally in your VS Code global storage directory. No data is ever sent to external servers.

**Data Collected**:

- Command execution times and exit codes
- Project/workspace information (hashed)
- Device hardware fingerprint (for trend analysis)
- Timestamps and command names

**Data Storage**: JSON Lines format in your VS Code extension storage folder

## Development

- `npm i`
- `npm run compile`
- Press **F5** to launch the Extension Development Host.

## Packaging

- `npx vsce package`
