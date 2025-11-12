# Git Hooks

This directory contains git hooks for the project.

## Installation

Run the following command to install the git hooks:

```bash
bun run install:hooks
```

## Available Hooks

### pre-push

Runs before every `git push` to ensure code quality:

- Runs `biome check --fix` to auto-fix linting issues
- Blocks push if there are unfixable errors
- Warns if files were modified by auto-fix (requires commit first)

## Manual Installation

If you prefer to install manually:

```bash
cp .githooks/pre-push .git/hooks/pre-push
chmod +x .git/hooks/pre-push
```

## Bypassing Hooks

If you need to bypass the pre-push hook (use sparingly):

```bash
git push --no-verify
```
