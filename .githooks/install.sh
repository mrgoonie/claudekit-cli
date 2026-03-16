#!/bin/bash
# Configure git to use .githooks/ directory for hooks.
# Uses relative path — resolves from working tree root, works for all worktrees.

# Skip if not in a git repo (e.g. installed from npm registry)
git rev-parse --git-dir > /dev/null 2>&1 || exit 0

REPO_ROOT="$(git rev-parse --show-toplevel)"

# Relative path: git resolves from working tree root when running hooks
git config core.hooksPath .githooks

# Ensure hooks are executable
chmod +x "$REPO_ROOT/.githooks/pre-commit" "$REPO_ROOT/.githooks/pre-push" 2>/dev/null

echo "[OK] Git hooks installed (core.hooksPath -> .githooks/)"
echo "     pre-commit: typecheck + lint + build"
echo "     pre-push:   typecheck + lint + build + test"
