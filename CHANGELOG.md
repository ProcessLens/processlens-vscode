# Changelog

## 0.1.2

### 🚀 Major Features

- **Smart Chart Type Switching**: Automatic chart optimization based on dataset size
  - **Line charts** (≤100 points) - Detailed view with gradient lines and smooth animations
  - **Scatter plots** (101-200 points) - Pattern view without connecting lines to reduce visual noise
  - **Bar charts** (200+ points) - Daily aggregation showing average duration, run count, and success rate
- **Intelligent Data Aggregation**: Large datasets automatically grouped by day for better readability
- **Performance Optimized Animation**: Constant animation time regardless of dataset size (no more 30+ second delays)

### 🔧 Technical Improvements

- **Enhanced Chart Tooltips**: Context-aware tooltips adapted for each chart type
  - Individual run details for line/scatter charts
  - Daily statistics for aggregated bar charts
- **Improved Chart Performance**: Smart stagger animation with performance thresholds
  - Smooth staggered animation for datasets ≤500 points
  - Instant loading for datasets >500 points
- **Better Data Visualization**: Automatic chart type selection prevents cluttered, unreadable charts

### 🐛 Bug Fixes

- Fixed `point.x.getTime is not a function` error in bar chart rendering
- Fixed Date object handling in aggregated chart data
- Improved chart animation performance for large datasets (500+ points)
- Enhanced chart readability with automatic type switching

## 0.1.1

### 🚀 Major Features

- **TypeScript Migration**: Converted dashboard from JavaScript to TypeScript with full type safety
- **Interactive Activity Heatmap**: GitHub-style visualization with clickable day filtering and year navigation
- **Enhanced Performance Matrix**: Adaptive thresholds, smart command truncation, and CSP compliance
- **Advanced Time Range Highlighting**: Visual feedback on heatmap for selected time periods

### 🔧 Technical Improvements

- **Unified Build System**: Single `npm run compile` command for both dashboard and extension
- **Browser-Compatible Dashboard**: Proper TypeScript compilation for webview environment
- **Improved Chart Data Handling**: Fixed timestamp property mapping and success/failure detection
- **Better Device Detection**: Enhanced hardware fingerprinting and Nerd Font support detection

### 🐛 Bug Fixes

- Fixed heatmap Y-axis alignment (Monday-first layout)
- Fixed heatmap day click behavior (maintains full year view while filtering)
- Fixed "Invalid Date" issues in Recent Duration chart
- Fixed chart dot colors (proper success/failure status detection)
- Fixed NaN values in heatmap year navigation
- Resolved TypeScript compilation errors with proper null safety

### 📦 Package Improvements

- Updated dependencies and build configuration
- Optimized package size and file structure
- Added proper .gitignore for generated files
- Enhanced VS Code marketplace compatibility

## 0.1.0

- Initial MVP: timed scripts & commands, local JSONL storage, basic dashboard.
