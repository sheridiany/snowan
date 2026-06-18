import subprocess

from ...workspace import workspace_root

_MAX_OUTPUT = 20_000


def execute_shell_command(command: str, timeout: int = 60) -> str:
    """Run a shell command in the workspace directory. Returns combined stdout+stderr (truncated)."""
    try:
        proc = subprocess.run(
            command,
            shell=True,
            cwd=workspace_root(),
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired:
        return f"error: command timed out after {timeout}s"

    out = (proc.stdout or "") + (proc.stderr or "")
    if len(out) > _MAX_OUTPUT:
        out = out[:_MAX_OUTPUT] + f"\n… (truncated, {len(out)} bytes total)"
    return f"[exit {proc.returncode}]\n{out}".rstrip()
