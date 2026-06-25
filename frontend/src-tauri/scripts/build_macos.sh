#!/usr/bin/env bash
# Build Snowan with Tauri for macOS (PyInstaller backend)
# Creates a self-contained desktop app with a bundled Python backend.
#
# End-to-end:
#   1. Freeze the backend with PyInstaller -> binaries/snowan-backend
#   2. Build the Tauri app (npm run tauri:build) -> Snowan.app
#   3. Re-sign the .app so every bundled Mach-O is in one signature state
#
# Usage:
#   ./frontend/src-tauri/scripts/build_macos.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC_TAURI_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
FRONTEND_DIR="$(cd "${SRC_TAURI_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${FRONTEND_DIR}/.." && pwd)"

VERSION=$(sed -n 's/^version[[:space:]]*=[[:space:]]*"\([^"]*\)".*/\1/p' "${REPO_ROOT}/backend/pyproject.toml" | head -1)

echo "========================================="
echo "Snowan Tauri Build - macOS (PyInstaller)"
echo "========================================="
echo "Version: ${VERSION}"
echo ""

SIGN_MACOS_BUNDLE="${SCRIPT_DIR}/sign_macos_bundle.sh"
BUILD_PYINSTALLER="${SCRIPT_DIR}/build_pyinstaller.sh"

# Step 0: Prerequisites
echo "== Step 0: Checking Prerequisites =="
missing=()

if command -v npm &>/dev/null; then
    echo "  [OK] npm ($(npm --version))"
else
    echo "  [MISSING] npm"
    echo "    Install Node.js: https://nodejs.org/"
    missing+=("npm")
fi

if command -v rustc &>/dev/null; then
    echo "  [OK] rustc ($(rustc --version))"
else
    echo "  [MISSING] rustc (Rust)"
    echo "    Install: https://rustup.rs"
    missing+=("rustc")
fi

if command -v uv &>/dev/null; then
    echo "  [OK] uv ($(uv --version))"
else
    echo "  [MISSING] uv"
    echo "    Install: https://docs.astral.sh/uv/getting-started/installation/"
    missing+=("uv")
fi

if [ ${#missing[@]} -gt 0 ]; then
    echo ""
    echo "Missing prerequisites: ${missing[*]}"
    echo "Install the missing tools and re-run this script."
    exit 1
fi
echo ""

if [ ! -f "${BUILD_PYINSTALLER}" ]; then
    echo "ERROR: PyInstaller build helper not found at ${BUILD_PYINSTALLER}"
    exit 1
fi
if [ ! -f "${SIGN_MACOS_BUNDLE}" ]; then
    echo "ERROR: macOS signing helper not found at ${SIGN_MACOS_BUNDLE}"
    exit 1
fi

if [ -z "${APPLE_SIGNING_IDENTITY:-}" ] && [ -z "${APPLE_CERTIFICATE:-}" ]; then
    # macOS 15+ (and especially macOS 26) kills ad-hoc-signed apps with SIGKILL on a
    # fresh Finder double-click ("icon bounces then quits"); launching via `open` from a
    # trusted terminal sidesteps it. A real signature (Developer ID or Apple Development)
    # from the login keychain is trusted by AMFI, so the app launches normally. Auto-pick
    # one if present; fall back to ad-hoc on machines without a cert (CI, a friend's box).
    _found_id=$(security find-identity -v -p codesigning 2>/dev/null \
        | awk -F'"' '/Developer ID Application|Apple Development/ {print $2; exit}')
    if [ -n "${_found_id}" ]; then
        export APPLE_SIGNING_IDENTITY="${_found_id}"
        echo "Using local code-signing identity: ${_found_id}"
    else
        export APPLE_SIGNING_IDENTITY="-"
        echo "Using ad-hoc macOS code signing"
    fi
fi
if [ -z "${PYINSTALLER_CODESIGN_IDENTITY:-}" ]; then
    # PyInstaller uses the same identity as the final app for bundled Mach-O
    # files; "-" means ad-hoc signing on macOS.
    export PYINSTALLER_CODESIGN_IDENTITY="${APPLE_SIGNING_IDENTITY:-}"
fi
echo ""

# Step 1: Build PyInstaller backend
echo "== Step 1: Building PyInstaller Backend =="
bash "${BUILD_PYINSTALLER}"
echo "PyInstaller backend built"
echo ""

echo "== Step 1b: Signing PyInstaller Backend =="
bash "${SIGN_MACOS_BUNDLE}" \
    "${SRC_TAURI_DIR}/binaries/snowan-backend" \
    "${APPLE_SIGNING_IDENTITY}"
echo "PyInstaller backend signed"
echo ""

# Step 2: Build Tauri app
echo "== Step 2: Building Tauri App =="
BUNDLE_DIR="${SRC_TAURI_DIR}/target/release/bundle"
rm -rf "${BUNDLE_DIR}/dmg" "${BUNDLE_DIR}/macos"
cd "${FRONTEND_DIR}"
echo "Building for macOS..."
npm run tauri:build
echo "Tauri app built"
echo ""

APP_PATH="${BUNDLE_DIR}/macos/Snowan.app"
if [ ! -d "${APP_PATH}" ]; then
    echo "ERROR: No Tauri macOS app found at ${APP_PATH}"
    exit 1
fi

echo "== Step 3: Signing Final macOS App =="
bash "${SIGN_MACOS_BUNDLE}" \
    "${APP_PATH}" \
    "${APPLE_SIGNING_IDENTITY}"
echo "Final macOS app signed and verified"
echo ""

echo "========================================="
echo "Build Complete!"
echo "========================================="
echo "App: ${APP_PATH}"
echo ""
echo "Test: open \"${APP_PATH}\""
echo ""
