# ProcessLens (VS Code) 🚧 **BETA**

🚀 **Developer productivity visibility.**
Track and analyze build, test, and other process times to gain insights, spot trends, and iterate faster.
Local-first — no data leaves your machine unless you opt in.

> **⚠️ Beta Release Notice**  
> ProcessLens is currently in **beta**. While core features are stable, you may encounter bugs or rough edges.
>
> **🙏 We need your feedback!** Please report issues, suggestions, or feature requests:
>
> - 🐛 [Report bugs](https://github.com/ProcessLens/processlens-vscode/issues/new?labels=bug&template=bug_report.md)
> - 💡 [Request features](https://github.com/ProcessLens/processlens-vscode/issues/new?labels=enhancement&template=feature_request.md)
> - 💬 [Join discussions](https://github.com/ProcessLens/processlens-vscode/discussions)
>
> Your input helps make ProcessLens better for everyone! 🚀

---

## Why ProcessLens?

Every developer waits for builds and tests. Even a few seconds repeated hundreds of times a day adds up.
Without measurement, teams only _feel_ slowdowns — ProcessLens makes them visible.

**Why it matters:**

- ⏱ Seconds add up into hours
- 📊 Evidence, not guesses — real data on your flow
- 📈 Trends over time — catch creeping slowdowns
- 👥 Team value — justify infra improvements with data
- 🔍 Personal utility — OSS maintainers & indie devs spot regressions

**What makes it different:**

- 🌍 General-purpose: measure _any_ process, not just JS builds
- 📉 Trend-focused: not just “this run took 9s” but “build times doubled this quarter”
- 💻 Developer-first: lives in VS Code, zero-config, instant insight

> Think of it as **time tracking for machines, not humans.**
> Humans log hours worked. ProcessLens logs seconds wasted waiting on computers.

---

## ✨ Features

### 📊 Comprehensive Dashboard

- Global stats: total runs, commands tracked, success rate, active projects
- Recent durations chart with interactive hover details
- Command summary table with customizable columns
- Recent runs list with trend indicators

### 📈 Advanced Analytics

- Average, Median, P95, Min/Max execution times
- 7-day trend analysis (↘ faster, ↗ slower, → stable)
- Success rate monitoring
- Hardware change detection

### 🔥 Impact Analysis (NEW!)

Identify your biggest time sinks with smart calculations:

- **Total Time** — cumulative consumption (duration × frequency)
- **Impact Score** — relative impact (0–100) compared to top offender
- **Time/Day** — average daily time wasted
- **Optimization Priority** — focus on high-impact commands first
- **Beautiful visualizations** — color-coded bars (green → red)

_Example:_ A command that runs 50× at 2s each (100s total) has higher impact than a command that runs 2× at 30s (60s total).

### 🔮 Performance Predictions (NEW!)

Estimate potential savings from command optimizations:

- **Projected Savings** — time saved if optimized
- **Optimization Priority** — HIGH/MEDIUM/LOW based on multiple factors
- **ROI Analysis** — prioritize where effort yields most benefit
- **Trend Velocity** — track if commands are improving or degrading

**Smart scoring factors:**

- Impact score
- Performance trends
- Variability (consistency)
- Frequency

**Conservative estimates:**

- HIGH: 30% potential savings
- MEDIUM: 15%
- LOW: 5%

_Example:_ A HIGH priority command running 100× at 10s average could save \~5 minutes total if improved by 30%.

### 🎛️ Interactive Features

- Customizable columns
- Trend sparklines (mini charts)
- Clickable stats to filter recent runs
- One-click re-run (▶)
- Smart filtering by project, command, time, status, device

### 🔧 Command Execution

- Shell history integration (bash/zsh/fish)
- Auto-discovery of `package.json` scripts (npm/yarn)
- Run any shell command with timing + status
- Multi-project support

---

## 🚀 Getting Started

### Installation

1. Install ProcessLens from the VS Code Marketplace
2. Open any workspace/project
3. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
4. Run **“ProcessLens: Run Command”**

---

### 🔤 Font Requirements (Optional)

For best visuals with OS icons, install a Nerd Font (MesloLGS NF, FiraCode NF, Hack NF, JetBrains Mono NF).

- **macOS**

```bash
brew tap homebrew/cask-fonts
brew install font-meslo-lg-nerd-font
```

- **Linux (Ubuntu/Debian)**

```bash
mkdir -p ~/.local/share/fonts
curl -fLo "MesloLGS NF Regular.ttf" https://github.com/ryanoasis/nerd-fonts/raw/master/patched-fonts/Meslo/S/Regular/MesloLGSNerdFont-Regular.ttf
curl -fLo "MesloLGS NF Bold.ttf" https://github.com/ryanoasis/nerd-fonts/raw/master/patched-fonts/Meslo/S/Bold/MesloLGSNerdFont-Bold.ttf
mv *.ttf ~/.local/share/fonts/
fc-cache -fv
```

- **Windows**
  Download from [Nerd Fonts](https://github.com/ryanoasis/nerd-fonts/releases), extract, right-click → _Install_.

_(Note: Works fine without Nerd Fonts — falls back to emoji icons 🍎 🐧 💻)_

---

## ⌨️ Commands

- **ProcessLens: Run Command** — Execute & time any command
- **ProcessLens: Open Dashboard** — View analytics dashboard

---

## 💡 Quick Tips

- 📜 **Browse Shell History** via command picker
- 📦 **package.json Scripts** auto-discovered
- ⋯ **Column Customization** in Command Summary
- 📈 **Trend Analysis** column shows 7-day performance
- 🖥 **Hardware Tracking** auto-annotates changes

---

## 📊 Dashboard Guide

**Global Stats (Top Bar)**

- Total Runs | Commands Tracked | Success Rate | Active Projects

**Chart**

- Color-coded dots: 🟢 success, 🔴 fail, 🟡 unknown
- Hardware annotations (vertical lines)
- Hover tooltips for command details

**Command Summary Table**

- Default: Command | Runs | Average | Success Rate
- Optional: Median | P95 | Min | Max | Trend | Sparkline
- Sortable + clickable
- Play ▶ buttons for quick re-run

**Statistical Columns Explained**

- **Average** — mean execution time
- **Median** — middle value, less skewed by outliers
- **P95** — 95th percentile (worst-case)
- **Min/Max** — fastest/slowest times
- **Trend** — 7-day comparison (↗ slower, ↘ faster, → stable)
- **Sparkline** — mini chart of recent times

---

## ⚙️ Settings

- `processlens.captureDeviceInfo` (default: true)
- `processlens.statusBar.enabled` (default: true)
- `processlens.statusBar.priority` (default: -10)
- `processlens.storage.backend` — `"jsonl"` (default), `"sqlite"` planned

---

## 🔒 Privacy & Data

ProcessLens is **100% local-first**.

- Stores timing data locally in VS Code global storage.
- Data collected: command execution times, exit codes, project info (hashed), device info, timestamps.
- No external servers.
- Cloud sync will always be **opt-in**.

---

## 🗺 Roadmap

- ⏱ Watch-mode rebuild timings (Vite, Webpack, Jest)
- 🗄 SQLite backend for faster querying
- ☁️ Cloud sync (opt-in) → team dashboards & history
- 📊 Advanced analytics: regressions, p50/p95 trends, team comparisons
- 🔔 Alerts & recommendations

---

## 👨‍💻 Development

```bash
npm i
npm run compile
# Press F5 in VS Code to launch Extension Development Host
```

---

## 📦 Packaging

```bash
npx vsce package
```

---

## 🤝 Contributing

Found a bug or have a feature request? Please [open an issue](https://github.com/ProcessLens/processlens-vscode/issues) or submit a pull request.

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.
