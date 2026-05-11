#!/bin/bash
# scripts/ci-local.sh — Local CI parity runner
#
# Mirrors the `Test` job in .github/workflows/ci.yml exactly. Run this before
# pushing to be sure CI will pass. This file is the SINGLE SOURCE OF TRUTH for
# what "passing CI" means; both `bun run ci:local` and the pre-push hook call
# into here so hook ↔ CI parity can never silently drift.
#
# If you ever add a step to ci.yml's Test job, add it here too. If you ever
# remove a step here, audit ci.yml first.
#
# Self-heal: the manifest/docs drift step regenerates artifacts but does NOT
# auto-commit. If it reports drift, run the suggested one-liner and commit.

set -euo pipefail

cd "$(git rev-parse --show-toplevel)" || exit 1

# Match ci.yml env so test behavior is identical (non-interactive, CI-safe).
export NON_INTERACTIVE=true
export CI_SAFE_MODE=true

step() { echo ""; echo "  [$1] $2..."; }
fail() { echo ""; echo "  [X] $1"; exit 1; }
ok()   { echo "  [OK] $1"; }

step "1/7" "Typecheck (tsc --noEmit)"
bun run typecheck || fail "Typecheck failed."

step "2/7" "Lint (biome check)"
bun run lint || fail "Lint failed. Run 'bun run lint:fix' to auto-fix, then re-stage."

step "3/7" "Build CLI bundle"
bun run build || fail "Build failed."

step "4/7" "Tests (bun test)"
# CI uses `timeout 300 bun test --verbose`; locally we trust dev to ctrl-c.
bun test || fail "Tests failed."

step "5/7" "Help parity + manifest/docs drift check"
# Mirrors ci.yml "Verify help parity and regenerated docs" step verbatim.
# This is the class of failure that most often surprises AI sessions: a
# release commit on main bumps package.json but skips regenerating
# cli-manifest.json / docs/cli-reference.md, so every branch off main fails
# this step until the artifacts are refreshed.
bun run help:check-parity || fail "Help parity check failed."
bun run manifest:generate
bun run docs:generate
DIFF=$(git diff -- cli-manifest.json docs/cli-reference.md)
if [ -n "$DIFF" ]; then
  MEANINGFUL=$(echo "$DIFF" | grep -E '^[+-][^+-]' | grep -v '"generatedAt"' | grep -v '<!-- generated:' || true)
  if [ -n "$MEANINGFUL" ]; then
    echo ""
    echo "  [X] cli-manifest.json or docs/cli-reference.md is stale."
    echo "      Self-heal:"
    echo "        bun run manifest:generate && bun run docs:generate"
    echo "        git add cli-manifest.json docs/cli-reference.md"
    echo "        git commit -m 'chore: regenerate cli-manifest and docs'"
    echo ""
    echo "  Meaningful diff:"
    echo "$MEANINGFUL" | sed 's/^/    /'
    exit 1
  fi
fi
ok "no meaningful drift in cli-manifest.json / docs/cli-reference.md"

step "6/7" "UI build (tsc -b + vite, stricter than tsc --noEmit)"
bun run ui:build || fail "UI build failed. tsc -b catches errors tsc --noEmit misses (unused vars, missing ES lib methods)."

step "7/7" "Verify packaged CLI"
node scripts/prepublish-check.js || fail "Prepublish check failed."

# Note: ui:test runs in a separate vitest config and is invoked by `bun run
# validate`. CI's Test job does NOT run ui:test directly — it's covered by
# ui:build (tsc -b) plus the vitest suite that runs inside `bun test` via
# bun's test runner. Keep this in mind when comparing local vs CI.

echo ""
echo "  [OK] Local CI parity passed. Safe to push."
echo ""
