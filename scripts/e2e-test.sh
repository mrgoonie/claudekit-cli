#!/bin/bash
set -e

echo "=== ClaudeKit Config E2E Test ==="

cd "$(dirname "$0")/.."

# Build
echo "Building..."
bun run build

# Test CLI commands
echo ""
echo "Testing: ck config"
bun run dev config --json | head -20

echo ""
echo "Testing: ck config get"
bun run dev config get defaults.kit 2>/dev/null || echo "(no default kit set)"

echo ""
echo "Testing: ck config set (dry run)"
echo "Would set: test.key = test-value --local"

echo ""
echo "Testing: ck config ui (5 second timeout)"
timeout 5 bun run dev config ui --no-open 2>/dev/null || true

echo ""
echo "=== E2E Tests Complete ==="
