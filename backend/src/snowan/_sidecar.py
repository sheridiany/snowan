# -*- coding: utf-8 -*-
"""Frozen-app entrypoint for the Snowan backend (PyInstaller onedir sidecar).

Tauri spawns this as a sidecar and waits for the ``SNOWAN_READY`` line on
stdout before navigating the webview. The ASGI app is passed to uvicorn as an
import string so PyInstaller never imports it during static analysis.
"""
from __future__ import annotations

import argparse
import multiprocessing
import os
import sys

# logfire's pydantic plugin calls inspect.getsource() at import, which fails in a
# frozen app (no .py source) — disable pydantic plugins before any model loads.
os.environ.setdefault("PYDANTIC_DISABLE_PLUGINS", "1")


def main() -> None:
    parser = argparse.ArgumentParser(prog="snowan-backend")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8787)
    args = parser.parse_args()

    import uvicorn

    # uvicorn's own startup log is not a reliable ready signal across versions,
    # so emit our own sentinel on stdout before the server starts.
    print("SNOWAN_READY", flush=True)
    sys.stdout.flush()

    uvicorn.run(
        "snowan.server.app:app",
        host=args.host,
        port=args.port,
        log_level="info",
    )


if __name__ == "__main__":
    multiprocessing.freeze_support()
    main()
