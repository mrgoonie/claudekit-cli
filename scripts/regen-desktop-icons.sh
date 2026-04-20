#!/bin/bash
# Regenerate the full Tauri desktop icon bundle from the canonical CK logo.
# Run via: bun run icons:regen
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

SRC="src/ui/public/images/logo-512.png"
OUT="src-tauri/icons"

if [ ! -f "$SRC" ]; then
  echo "[X] Source logo missing: $SRC"
  exit 1
fi

echo "[i] Regenerating desktop icon bundle from $SRC"
bun x @tauri-apps/cli icon "$SRC" --output "$OUT"
echo "[OK] Icon bundle regenerated in $OUT"
