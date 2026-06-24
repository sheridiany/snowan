#!/usr/bin/env bash
# Package the extension into dist/snowan-extension.zip for store upload.
# Excludes scripts/, dist/, *.md docs, and the .svg source — only runtime files ship.
set -euo pipefail

EXT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$EXT_DIR/dist"
OUT_ZIP="$OUT_DIR/snowan-extension.zip"

mkdir -p "$OUT_DIR"
rm -f "$OUT_ZIP"

cd "$EXT_DIR"
zip -r -q "$OUT_ZIP" . \
  -x "scripts/*" \
  -x "dist/*" \
  -x "*.md" \
  -x "icons/icon.svg" \
  -x ".*" \
  -x "*/.*"

echo "Packed -> $OUT_ZIP"
unzip -l "$OUT_ZIP"
