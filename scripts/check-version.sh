#!/usr/bin/env bash
#
# check-version.sh
#
# Verifies that manifest.json and CHANGELOG.md agree on the current version.
# Run from CI on every push/PR; can also be run locally before bumping a version
# or before tagging a release.
#
# Exit status:
#   0  versions match
#   1  versions disagree, or one of them could not be parsed
#
# Conventions assumed:
#   - manifest.json has a top-level "version" field, no "v" prefix
#     (e.g. "version": "2.3.7")
#   - CHANGELOG.md's most recent entry header is of the form "## vX.Y[.Z]..."
#     (e.g. "## v2.3.7 - 2026-05-07")

set -euo pipefail

# Anchor paths to the repo root so the script works from any cwd.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

MANIFEST_FILE="$REPO_ROOT/manifest.json"
CHANGELOG_FILE="$REPO_ROOT/CHANGELOG.md"

if [ ! -f "$MANIFEST_FILE" ]; then
  echo "ERROR: $MANIFEST_FILE not found"
  exit 1
fi
if [ ! -f "$CHANGELOG_FILE" ]; then
  echo "ERROR: $CHANGELOG_FILE not found"
  exit 1
fi

# Manifest version (no "v" prefix).
if command -v jq >/dev/null 2>&1; then
  MANIFEST_VERSION=$(jq -r '.version' "$MANIFEST_FILE")
else
  # Fallback parser if jq is unavailable.
  MANIFEST_VERSION=$(grep -oE '"version"[[:space:]]*:[[:space:]]*"[^"]+"' "$MANIFEST_FILE" \
    | head -1 \
    | sed -E 's/.*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/')
fi

# Top-most "## vX.Y[.Z][...]" header in the changelog, with the "v" stripped.
CHANGELOG_VERSION=$(grep -oE '^## v[0-9]+(\.[0-9]+)+' "$CHANGELOG_FILE" \
  | head -1 \
  | sed -E 's/^## v//')

if [ -z "${MANIFEST_VERSION:-}" ] || [ "$MANIFEST_VERSION" = "null" ]; then
  echo "ERROR: could not extract version from manifest.json"
  exit 1
fi
if [ -z "${CHANGELOG_VERSION:-}" ]; then
  echo "ERROR: could not extract a top-level version from CHANGELOG.md"
  echo "       expected a line like '## v2.3.7 - 2026-05-07' near the top"
  exit 1
fi

if [ "$MANIFEST_VERSION" != "$CHANGELOG_VERSION" ]; then
  echo "ERROR: version drift detected"
  echo "       manifest.json:  $MANIFEST_VERSION"
  echo "       CHANGELOG.md:   v$CHANGELOG_VERSION"
  echo
  echo "Either:"
  echo "  - add a new '## v$MANIFEST_VERSION - YYYY-MM-DD' section at the top of CHANGELOG.md, or"
  echo "  - correct the version in manifest.json to match CHANGELOG.md"
  exit 1
fi

echo "OK: manifest.json and CHANGELOG.md both at v$MANIFEST_VERSION"
