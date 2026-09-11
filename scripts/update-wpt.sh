#!/usr/bin/env bash
# Bump the WPT submodule to upstream tip, re-apply sparse checkout, refresh manifest.
# After this, run `npm run test:wpt` and commit both the submodule SHA and expectation.json.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WPT_DIR="$ROOT/test/web-platform-tests/wpt"
SPARSE_FILE="$ROOT/test/web-platform-tests/sparse-paths.txt"

cd "$ROOT"

echo "Updating WPT submodule from upstream..."
git submodule update --init --remote --depth 1 -- test/web-platform-tests/wpt

echo "Applying sparse checkout..."
mapfile -t PATHS < <(grep -vE '^\s*(#|$)' "$SPARSE_FILE")
git -C "$WPT_DIR" sparse-checkout init --cone
git -C "$WPT_DIR" sparse-checkout set "${PATHS[@]}"

echo "Refreshing MANIFEST.json..."
if command -v python3 >/dev/null; then
  (cd "$WPT_DIR" && python3 wpt manifest)
else
  echo "python3 not found; skip manifest (CI/setup will generate it)"
fi

SHA="$(git -C "$WPT_DIR" rev-parse --short HEAD)"
echo ""
echo "WPT is now at $SHA (sparse)."
echo "Next:"
echo "  1. npm run test:wpt          # refresh expectation.json"
echo "  2. git add test/web-platform-tests/wpt test/web-platform-tests/expectation.json"
echo "  3. commit the bump"
