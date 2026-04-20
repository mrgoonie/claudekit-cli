#!/bin/bash
# Regenerate the full Tauri desktop icon bundle from the canonical CK logo.
# Run via: bun run icons:regen
#
# Tauri CLI generates: 32/64/128/128@2x PNGs, icon.icns, icon.ico, icon.png,
# plus Windows Store (Square*.png) and mobile (ios/, android/) assets.
# It does NOT emit 256x256.png or 512x512.png even though tauri.conf.json
# references them — produce those below (sips on macOS, ImageMagick elsewhere).
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

SRC="src/ui/public/images/logo-512.png"
OUT="src-tauri/icons"

if [ ! -f "$SRC" ]; then
  echo "[X] Source logo missing: $SRC"
  exit 1
fi

# Source must be exactly 512x512 — we copy it verbatim as 512x512.png below
# and the drift guard checks hash equality, not dimensions, so a mis-sized
# source would silently ship a wrong icon.
if command -v sips >/dev/null 2>&1; then
  src_w=$(sips -g pixelWidth "$SRC" | awk '/pixelWidth/{print $2}')
  src_h=$(sips -g pixelHeight "$SRC" | awk '/pixelHeight/{print $2}')
elif command -v identify >/dev/null 2>&1; then
  src_w=$(identify -format "%w" "$SRC")
  src_h=$(identify -format "%h" "$SRC")
else
  src_w=512; src_h=512  # Skip check when neither tool available
fi
if [ "$src_w" != "512" ] || [ "$src_h" != "512" ]; then
  echo "[X] Source logo must be 512x512, got ${src_w}x${src_h}: $SRC" >&2
  exit 1
fi

echo "[i] Regenerating desktop icon bundle from $SRC"
bun x @tauri-apps/cli icon "$SRC" --output "$OUT"

echo "[i] Producing 256x256.png and 512x512.png (not emitted by Tauri CLI)"
cp "$SRC" "$OUT/512x512.png"
if command -v sips >/dev/null 2>&1; then
  sips -z 256 256 "$SRC" --out "$OUT/256x256.png" >/dev/null
elif command -v magick >/dev/null 2>&1; then
  magick "$SRC" -resize 256x256 "$OUT/256x256.png"
elif command -v convert >/dev/null 2>&1; then
  convert "$SRC" -resize 256x256 "$OUT/256x256.png"
else
  echo "[X] Need sips (macOS) or ImageMagick to produce 256x256.png" >&2
  exit 1
fi

echo "[OK] Icon bundle regenerated in $OUT"
