#!/usr/bin/env bash
# Build the Snowan backend with PyInstaller for the Tauri resource bundle.
# Creates an onedir backend bundle with an embedded Python runtime.
#
# Usage:
#   ./frontend/src-tauri/scripts/build_pyinstaller.sh
#
# Prerequisites:
#   - uv (https://docs.astral.sh/uv/)
#
# The embedding model is NEVER bundled; it downloads at runtime to ~/.snowan/models.

set -e

# scripts/ -> src-tauri -> frontend -> repo root
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
BACKEND_DIR="${REPO_ROOT}/backend"
SPEC_FILE="${SCRIPT_DIR}/snowan-backend.spec"

DIST="${DIST:-${REPO_ROOT}/dist}"

echo "========================================="
echo "Snowan PyInstaller Build"
echo "========================================="
echo "Repository: ${REPO_ROOT}"
echo "Backend:    ${BACKEND_DIR}"
echo ""

if ! command -v uv &>/dev/null; then
    echo "ERROR: uv not found. Install it: https://docs.astral.sh/uv/"
    exit 1
fi

if [ ! -f "$SPEC_FILE" ]; then
    echo "ERROR: Spec file not found at ${SPEC_FILE}"
    exit 1
fi

# Sync the backend venv with all runtime deps, then add the build-only tools.
echo "== Syncing backend environment =="
cd "$BACKEND_DIR"
uv sync
uv pip install "pyinstaller>=6.0.0" "pyinstaller-hooks-contrib>=2024.9"
echo "Backend environment ready"
echo ""

echo "== Running PyInstaller =="
echo "Building onedir backend bundle..."
uv run python -m PyInstaller "$SPEC_FILE" \
    --distpath "${DIST}/pyinstaller" \
    --workpath "${DIST}/pyinstaller-build" \
    --clean \
    --noconfirm
echo "PyInstaller build complete"
echo ""

# Verify output
BUNDLE_DIR="${DIST}/pyinstaller/snowan-backend"
BUNDLE_EXE="${BUNDLE_DIR}/snowan-backend"
if [ ! -d "${BUNDLE_DIR}" ]; then
    echo "ERROR: Backend bundle directory not found at ${BUNDLE_DIR}"
    exit 1
fi
if [ ! -f "${BUNDLE_EXE}" ]; then
    echo "ERROR: Backend executable not found at ${BUNDLE_EXE}"
    exit 1
fi

SIZE=$(du -sh "${BUNDLE_DIR}" | cut -f1)
echo "Backend bundle created: ${BUNDLE_DIR}"
echo "Bundle size: ${SIZE}"
echo ""

# Copy the whole onedir tree into the Tauri resources directory.
echo "== Copying to Tauri binaries directory =="
DEST="${REPO_ROOT}/frontend/src-tauri/binaries/snowan-backend"
rm -rf "${DEST}"
mkdir -p "${DEST}"
cp -R "${BUNDLE_DIR}/." "${DEST}/"
chmod +x "${DEST}/snowan-backend"
echo "Copied to: ${DEST}"
echo ""

echo "========================================="
echo "PyInstaller Build Complete!"
echo "========================================="
echo "Output:"
echo "  Bundle:        ${BUNDLE_DIR}"
echo "  Tauri resource: ${DEST}"
echo ""
