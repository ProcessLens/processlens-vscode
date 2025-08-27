# Commit Convention

This project uses [Commitizen](https://github.com/commitizen/cz-cli) with [Conventional Commits](https://www.conventionalcommits.org/) for consistent commit messages.

## Usage

### Interactive Commit (Recommended)

```bash
npm run commit
```

This will guide you through creating a properly formatted commit message.

### Manual Commit Format

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation only changes
- **style**: Changes that do not affect the meaning of the code
- **refactor**: A code change that neither fixes a bug nor adds a feature
- **perf**: A code change that improves performance
- **test**: Adding missing tests or correcting existing tests
- **build**: Changes that affect the build system or external dependencies
- **ci**: Changes to CI configuration files and scripts
- **chore**: Other changes that don't modify src or test files
- **revert**: Reverts a previous commit

### Scopes

- **dashboard**: Dashboard-related changes
- **extension**: VS Code extension changes
- **ci**: CI/CD pipeline changes
- **docs**: Documentation changes
- **build**: Build system changes
- **deps**: Dependency updates

### Examples

```
feat(dashboard): add interactive heatmap day filtering
fix(extension): resolve command registration issue
docs: update README with installation instructions
ci: update Node.js version to 20 for compatibility
```

## Pre-commit Hooks

The project automatically runs:

1. **Compilation check** - Ensures TypeScript compiles without errors
2. **Lint-staged** - Runs checks on staged files

This ensures code quality and consistency before commits are made.
