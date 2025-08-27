# Contributing to ProcessLens

Thank you for your interest in contributing to ProcessLens! This document provides guidelines and information for contributors.

## 🐛 Reporting Issues

### Before Reporting

1. **Search existing issues** to avoid duplicates
2. **Check the documentation** in the README.md
3. **Try the latest version** to see if the issue is already fixed

### How to Report a Bug

1. Go to [GitHub Issues](https://github.com/ProcessLens/processlens-vscode/issues)
2. Click "New Issue" and select "🐛 Bug Report"
3. Fill out the template completely with:
   - Clear description of the problem
   - Steps to reproduce
   - Expected vs actual behavior
   - ProcessLens and VS Code versions
   - Operating system
   - Console logs (if applicable)

### How to Request a Feature

1. Go to [GitHub Issues](https://github.com/ProcessLens/processlens-vscode/issues)
2. Click "New Issue" and select "✨ Feature Request"
3. Provide:
   - Problem statement
   - Proposed solution
   - Use case description
   - Priority level

## 🔧 Development Setup

### Prerequisites

- Node.js 18+
- VS Code
- Git

### Getting Started

```bash
# Clone the repository
git clone https://github.com/ProcessLens/processlens-vscode.git
cd processlens-vscode

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Open in VS Code
code .
```

### Development Workflow

1. **Compile**: `npm run compile` - Compiles both extension and dashboard
2. **Watch mode**: `npm run watch` - Auto-compiles on file changes
3. **Test**: Press `F5` in VS Code to launch Extension Development Host
4. **Package**: `npm run package` - Creates `.vsix` file for testing

### Project Structure

```
src/
├── extension.ts          # Main extension entry point
├── storage.ts           # Data storage layer
├── shellHistory.ts      # Shell history integration
├── hardware.ts          # Hardware detection
├── project.ts           # Project/workspace utilities
└── dummyDataGenerator.ts # Testing utilities

media/
├── dashboard.ts         # Dashboard TypeScript source
├── dashboard.js         # Compiled dashboard (auto-generated)
├── style.css           # Dashboard styles
└── chart.umd.js        # Chart.js library

.github/
├── workflows/          # CI/CD pipelines
└── ISSUE_TEMPLATE/     # Issue templates
```

## 🎯 Development Guidelines

### Code Style

- Use TypeScript with strict mode
- Follow existing code patterns
- Add type annotations for public APIs
- Use meaningful variable and function names

### Dashboard Development

- Edit `media/dashboard.ts` (not the compiled `.js` file)
- Run `npm run compile:dashboard` to compile changes
- Test in the Extension Development Host

### Extension Development

- Edit files in `src/` directory
- Run `npm run compile:extension` to compile changes
- Use VS Code's debugging tools (`F5`)

### Testing

- Test on multiple operating systems (Windows, macOS, Linux)
- Test with different VS Code versions
- Verify dashboard functionality in webview
- Test command execution and timing accuracy

## 📋 Pull Request Process

### Before Submitting

1. **Create an issue** first to discuss the change
2. **Fork the repository** and create a feature branch
3. **Test thoroughly** on your local setup
4. **Update documentation** if needed
5. **Add/update tests** if applicable

### PR Requirements

- [ ] Code compiles without errors (`npm run compile`)
- [ ] Extension packages successfully (`npm run package`)
- [ ] Manual testing completed
- [ ] Documentation updated (if applicable)
- [ ] CHANGELOG.md updated (for significant changes)

### PR Template

```markdown
## Description

Brief description of changes

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing

- [ ] Tested on Windows/macOS/Linux
- [ ] Extension Development Host testing
- [ ] Dashboard functionality verified

## Screenshots (if applicable)

Add screenshots for UI changes
```

## 🚀 Release Process

### Versioning

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Release Workflow

1. **Update version** in `package.json`
2. **Update CHANGELOG.md** with changes
3. **Create PR** to `main` branch
4. **Merge to main** after review
5. **Push to release branch** to trigger automated release

### Automated Release

- Push to `release` branch triggers GitHub Actions
- Automatically creates GitHub release
- Publishes to VS Code Marketplace (if `VSCE_PAT` secret is configured)
- Publishes to Open VSX Registry (if `OVSX_PAT` secret is configured)

## 🤝 Community

### Getting Help

- **GitHub Discussions**: Ask questions and share ideas
- **Issues**: Report bugs and request features
- **Documentation**: Check README.md for usage info

### Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help others learn and grow
- Follow GitHub's community guidelines

## 📝 License

By contributing to ProcessLens, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to ProcessLens! 🎉
