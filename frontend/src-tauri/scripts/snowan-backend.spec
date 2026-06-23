# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec file for Snowan (Tauri backend resource).

Builds an onedir backend bundle so the desktop startup can load Python
directly without onefile extraction. The embedding model is NEVER bundled;
it is downloaded at runtime to ~/.snowan/models.
"""

import os
import sys
from pathlib import Path

from PyInstaller.utils.hooks import (
    collect_all,
    collect_data_files,
    collect_submodules,
    copy_metadata,
)

# scripts/ -> src-tauri -> frontend -> repo root
REPO_ROOT = Path(SPECPATH).parent.parent.parent
BACKEND_SRC = REPO_ROOT / "backend" / "src"
ENTRY = BACKEND_SRC / "snowan" / "_sidecar.py"

if sys.platform == "darwin":
    codesign_identity = os.environ.get(
        "PYINSTALLER_CODESIGN_IDENTITY"
    ) or os.environ.get("APPLE_SIGNING_IDENTITY")
    if not codesign_identity:
        codesign_identity = None
else:
    codesign_identity = None

datas = []
binaries = []
hiddenimports = [
    # uvicorn internals (not auto-discovered by PyInstaller)
    "uvicorn.logging",
    "uvicorn.loops",
    "uvicorn.loops.auto",
    "uvicorn.protocols",
    "uvicorn.protocols.http",
    "uvicorn.protocols.http.auto",
    "uvicorn.protocols.websockets",
    "uvicorn.protocols.websockets.auto",
    "uvicorn.lifespan",
    "uvicorn.lifespan.on",
]

# Packages that load native libs, data files, or submodules by name at runtime.
# collect_all pulls binaries + datas + hidden submodules + metadata in one shot.
for _pkg in ("onnxruntime", "fastembed", "tokenizers", "huggingface_hub", "tqdm", "ebooklib"):
    _d, _b, _h = collect_all(_pkg)
    datas += _d
    binaries += _b
    hiddenimports += _h

# The snowan package itself: routers / channel adapters are imported on demand,
# so PyInstaller cannot discover them from the static entry import graph.
hiddenimports += collect_submodules("snowan")
# trafilatura dynamically imports its extraction/format submodules.
hiddenimports += collect_submodules("trafilatura")

# Snowan ships built-in skills as SKILL.md data files under skills_builtin/. collect_submodules
# only grabs .py modules, so bundle the skill data explicitly — keeping the package-relative path
# so _BUILTIN (resolved relative to skills.py) finds them in the frozen app.
datas += collect_data_files("snowan", includes=["skills_builtin/**"])

# Collect package metadata for packages that query importlib.metadata at runtime.
_metadata_pkgs = [
    "snowan",
    "pydantic-ai-slim",
    "genai-prices",
    "fastapi",
    "starlette",
    "uvicorn",
    "pydantic",
    "pydantic-core",
    "httpx",
    "httpcore",
    "anyio",
    "sniffio",
]
# pydantic-ai-slim queries importlib.metadata for itself AND transitive deps
# (genai_prices, etc.) at runtime — recursive pulls every dependency's metadata so none
# is missing. We depend on -slim, not the pydantic-ai meta-package, so the walk must
# start there (else genai_prices metadata is dropped and the frozen app crashes on boot).
try:
    datas += copy_metadata("pydantic-ai-slim", recursive=True)
except Exception:
    pass
for _pkg in _metadata_pkgs:
    try:
        datas += copy_metadata(_pkg)
    except Exception:
        pass

analysis = Analysis(
    [str(ENTRY)],
    pathex=[str(REPO_ROOT), str(BACKEND_SRC)],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    # Heavy deps of WIP features are imported LAZILY (inside the function that uses
    # them), so dropping them here keeps the app booting — the feature only errors if
    # actually invoked. Re-enable a feature by deleting its line and rebuilding.
    excludes=[
        "playwright",  # browse 工具 (agent/tools/browse_tools.py) — needs runtime browsers anyway
        "faster_whisper", "av", "ctranslate2",  # 录音转写 (transcribe.py)
        "pandas", "matplotlib",  # analyze-data 技能跑 shell python;冻结副本从未被 import
        # GUI / dev-only stdlib the backend never touches.
        "tkinter", "_tkinter", "turtle", "turtledemo", "idlelib", "lib2to3", "pydoc_data",
    ],
    noarchive=False,
)

pyz = PYZ(analysis.pure)

exe = EXE(
    pyz,
    analysis.scripts,
    [],
    name="snowan-backend",
    debug=False,
    bootloader_ignore_signals=False,
    strip=True,
    # UPX triggers antivirus false positives and can corrupt binaries.
    upx=False,
    console=False,
    disable_windowed_traceback=True,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=codesign_identity,
    exclude_binaries=True,
)

coll = COLLECT(
    exe,
    analysis.binaries,
    analysis.datas,
    strip=True,
    upx=False,
    name="snowan-backend",
)
