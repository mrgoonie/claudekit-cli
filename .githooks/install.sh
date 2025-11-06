#!/bin/bash

# Install git hooks from .githooks directory

echo "Installing git hooks..."

# Copy pre-push hook
cp .githooks/pre-push .git/hooks/pre-push
chmod +x .git/hooks/pre-push

echo "✅ Git hooks installed successfully!"
echo ""
echo "Installed hooks:"
echo "  - pre-push: Runs biome check and auto-fix before pushing"
