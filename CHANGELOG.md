# Changelog

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
