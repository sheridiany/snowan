import re

from ...workspace import resolve_in_workspace, workspace_root

_SKIP_DIRS = {".git", "node_modules", "__pycache__", ".venv", "dist"}


def grep_search(pattern: str, path: str = ".", max_results: int = 50) -> str:
    """Search file contents under the workspace for a regex `pattern`. Returns `file:line: text` matches."""
    try:
        root = resolve_in_workspace(path)
    except ValueError as e:
        return f"error: {e}"
    try:
        rx = re.compile(pattern)
    except re.error as e:
        return f"error: bad pattern: {e}"

    base = workspace_root().resolve()
    files = [root] if root.is_file() else root.rglob("*")
    hits: list[str] = []
    for f in files:
        if not f.is_file() or any(part in _SKIP_DIRS for part in f.parts):
            continue
        try:
            for i, line in enumerate(f.read_text(encoding="utf-8", errors="replace").splitlines(), 1):
                if rx.search(line):
                    hits.append(f"{f.relative_to(base)}:{i}: {line.strip()[:200]}")
                    if len(hits) >= max_results:
                        return "\n".join(hits)
        except OSError:
            continue
    return "\n".join(hits) if hits else "(no matches)"


def glob_search(pattern: str = "**/*") -> str:
    """List files under the workspace matching a glob `pattern` (e.g. '**/*.md')."""
    base = workspace_root().resolve()
    matches = [
        str(p.relative_to(base))
        for p in sorted(base.glob(pattern))
        if p.is_file() and not any(part in _SKIP_DIRS for part in p.parts)
    ]
    return "\n".join(matches[:200]) if matches else "(no files)"
