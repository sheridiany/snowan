#!/usr/bin/env bash
# Package the on-demand ML runtimes (semantic search, voice) as per-platform tarballs.
#
# These are NOT bundled in the app (see snowan-backend.spec excludes). The app downloads
# the matching tarball from a GitHub release on the user's request (runtimes.py) and puts
# it on sys.path. We install each feature's packages into a clean dir with the SAME venv
# Python the backend was frozen from, so the native wheels match the frozen interpreter.
#
# Output: backend/dist/runtimes/snowan-<feature>-<os>-<arch>.tar.gz
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/../../../backend" && pwd)"
VENV_PY="${BACKEND_DIR}/.venv/bin/python"
OUT="${BACKEND_DIR}/dist/runtimes"

case "$(uname -s)" in Darwin) OS=macos ;; Linux) OS=linux ;; *) OS=windows ;; esac
case "$(uname -m)" in arm64 | aarch64) ARCH=arm64 ;; *) ARCH=x64 ;; esac
TAG="${OS}-${ARCH}"

# feature -> top-level pip packages (uv resolves the full closure; shared deps like numpy
# get included so the runtime is self-contained on sys.path).
pack() {
    local feat="$1"; shift
    local tmp; tmp="$(mktemp -d)"
    echo "== runtime: ${feat} ($*) =="
    uv pip install --python "${VENV_PY}" --target "${tmp}" "$@" >/dev/null
    # Keep .dist-info — packages like fastembed query importlib.metadata at import time.
    find "${tmp}" -name '__pycache__' -type d -prune -exec rm -rf {} + 2>/dev/null || true
    mkdir -p "${OUT}"
    tar -czf "${OUT}/snowan-${feat}-${TAG}.tar.gz" -C "${tmp}" .
    rm -rf "${tmp}"
    echo "  -> snowan-${feat}-${TAG}.tar.gz ($(du -h "${OUT}/snowan-${feat}-${TAG}.tar.gz" | cut -f1))"
}

rm -rf "${OUT}"
pack embed onnxruntime fastembed
pack voice faster-whisper
echo "Runtime archives in ${OUT}"
