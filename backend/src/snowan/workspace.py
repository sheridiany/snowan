import os
from pathlib import Path


def workspace_root() -> Path:
    root = Path(
        os.getenv("SNOWAN_WORKSPACE", Path.home() / ".snowan" / "workspace")
    ).expanduser()
    root.mkdir(parents=True, exist_ok=True)
    return root


def resolve_in_workspace(path: str) -> Path:
    """Resolve a (possibly relative) path under the workspace, refusing escapes."""
    root = workspace_root().resolve()
    p = Path(path)
    p = (p if p.is_absolute() else root / p).resolve()
    if p != root and root not in p.parents:
        raise ValueError(f"path is outside the workspace: {path}")
    return p
