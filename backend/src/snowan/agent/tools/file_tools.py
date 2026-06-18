from ...workspace import resolve_in_workspace


def read_file(path: str, max_bytes: int = 100_000) -> str:
    """Read a UTF-8 text file from the workspace. `path` may be relative to the workspace root."""
    try:
        p = resolve_in_workspace(path)
    except ValueError as e:
        return f"error: {e}"
    if not p.is_file():
        return f"error: not a file: {path}"
    data = p.read_text(encoding="utf-8", errors="replace")
    if len(data) > max_bytes:
        return data[:max_bytes] + f"\n… (truncated, {len(data)} bytes total)"
    return data


def write_file(path: str, content: str) -> str:
    """Create or overwrite a UTF-8 text file in the workspace. `path` may be relative to the root."""
    try:
        p = resolve_in_workspace(path)
    except ValueError as e:
        return f"error: {e}"
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding="utf-8")
    return f"wrote {len(content)} bytes to {path}"


def edit_file(path: str, old: str, new: str) -> str:
    """Replace the first occurrence of `old` with `new` in a workspace text file."""
    try:
        p = resolve_in_workspace(path)
    except ValueError as e:
        return f"error: {e}"
    if not p.is_file():
        return f"error: not a file: {path}"
    data = p.read_text(encoding="utf-8")
    if old not in data:
        return f"error: `old` text not found in {path}"
    p.write_text(data.replace(old, new, 1), encoding="utf-8")
    return f"edited {path}"


def append_file(path: str, content: str) -> str:
    """Append text to a workspace file, creating it if it does not exist."""
    try:
        p = resolve_in_workspace(path)
    except ValueError as e:
        return f"error: {e}"
    p.parent.mkdir(parents=True, exist_ok=True)
    with p.open("a", encoding="utf-8") as f:
        f.write(content)
    return f"appended {len(content)} bytes to {path}"
