"""On-demand local runtimes — keeps the base app small without going cloud.

The heavy ML runtimes are NOT bundled in the app:
  - embed : onnxruntime + fastembed (+ small unique deps) — local semantic search
  - voice : av + ctranslate2 + faster_whisper (+ ffmpeg dylibs) — local speech-to-text

They're downloaded on the user's explicit request (Settings) into
~/.snowan/runtimes/<feature>/ — a flat snapshot of the site-packages dirs taken from the
build venv, so it matches the frozen interpreter exactly (no pip / no dep resolution) —
and added to sys.path. Everything still runs ON-DEVICE; only the one-time fetch is online.

Shared deps (numpy, tokenizers, huggingface_hub, Pillow, tqdm) stay bundled, so a runtime
archive only carries what's unique to that feature."""
import os
import platform
import shutil
import sys
import tarfile
import tempfile
import threading
import urllib.request
from pathlib import Path

from .config import SNOWAN_HOME

RUNTIMES_DIR = SNOWAN_HOME / "runtimes"

# Where the per-platform runtime archives live. Overridable for local testing
# (e.g. SNOWAN_RUNTIME_BASE_URL=file:///path/to/dist).
BASE_URL = os.environ.get(
    "SNOWAN_RUNTIME_BASE_URL",
    "https://github.com/sheridiany/snowan/releases/download/runtimes-v1",
).rstrip("/")

FEATURES = {
    "embed": {"label": "语义检索运行时", "size_mb": 72},
    "voice": {"label": "语音转写运行时", "size_mb": 92},
}

_state: dict[str, str] = {}  # feature -> "downloading" | "error: ..."
_lock = threading.Lock()


def platform_tag() -> str:
    sysname = {"Darwin": "macos", "Windows": "windows", "Linux": "linux"}.get(platform.system(), "linux")
    arch = {"arm64": "arm64", "aarch64": "arm64", "x86_64": "x64", "AMD64": "x64"}.get(platform.machine(), "x64")
    return f"{sysname}-{arch}"


def _dir(feature: str) -> Path:
    return RUNTIMES_DIR / feature


def is_installed(feature: str) -> bool:
    return (_dir(feature) / ".ok").exists()


def add_to_path() -> None:
    """Put every installed runtime on sys.path. Call at startup and right after an
    install so the feature's packages become importable without a restart."""
    for feature in FEATURES:
        d = _dir(feature)
        if (d / ".ok").exists():
            p = str(d)
            if p not in sys.path:
                sys.path.insert(0, p)


def status(feature: str) -> dict:
    return {
        "feature": feature,
        "label": FEATURES.get(feature, {}).get("label", feature),
        "size_mb": FEATURES.get(feature, {}).get("size_mb"),
        "installed": is_installed(feature),
        "downloading": _state.get(feature) == "downloading",
        "error": _state[feature][7:] if _state.get(feature, "").startswith("error: ") else None,
    }


def install(feature: str) -> None:
    """Download + unpack a runtime archive (blocks). Best-effort; records errors in _state."""
    if feature not in FEATURES:
        return
    with _lock:
        if _state.get(feature) == "downloading":
            return
        _state[feature] = "downloading"
    try:
        url = f"{BASE_URL}/snowan-{feature}-{platform_tag()}.tar.gz"
        d = _dir(feature)
        if d.exists():
            shutil.rmtree(d, ignore_errors=True)
        d.mkdir(parents=True, exist_ok=True)
        fd, tmp = tempfile.mkstemp(suffix=".tar.gz")
        os.close(fd)
        try:
            with urllib.request.urlopen(url, timeout=120) as r, open(tmp, "wb") as f:
                shutil.copyfileobj(r, f)
            with tarfile.open(tmp) as tf:
                tf.extractall(d)
        finally:
            Path(tmp).unlink(missing_ok=True)
        (d / ".ok").write_text("1", encoding="utf-8")
        add_to_path()
        _state.pop(feature, None)
    except Exception as e:  # noqa: BLE001 — surfaced via status(), never crashes the app
        _state[feature] = f"error: {type(e).__name__}: {e}"


def uninstall(feature: str) -> bool:
    d = _dir(feature)
    if not d.exists():
        return False
    shutil.rmtree(d, ignore_errors=True)
    _state.pop(feature, None)
    return True
