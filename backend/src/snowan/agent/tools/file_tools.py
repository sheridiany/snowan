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
