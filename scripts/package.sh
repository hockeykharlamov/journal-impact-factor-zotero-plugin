#!/usr/bin/env bash
# Build and package the Zotero plugin as a .xpi
# Usage: bash scripts/package.sh

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ADDON="$ROOT/addon"
BUILD="$ROOT/build"
XPI="$BUILD/journal-impact-factor.xpi"

# Regenerate encoded data blob
echo "==> Building data blob..."
python3 "$ROOT/scripts/build_lookup.py"

mkdir -p "$BUILD"

# Remove old xpi if present
rm -f "$XPI"

# Package everything inside addon/ as the xpi root
echo "==> Packaging .xpi..."
cd "$ADDON"
zip -r "$XPI" . -x "*.DS_Store" -x "__MACOSX/*"

echo "==> Done: $XPI"
ls -lh "$XPI"
