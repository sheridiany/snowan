"""Append-only tool-call audit at ~/.snowan/audit.jsonl — one line per tool call
(timestamp, tool, a short arg summary, status), so the user can see what the agent
actually did. The trust backbone for letting tools run; surfaced in 权限."""
import json
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlsplit

from .config import SNOWAN_HOME

AUDIT_PATH = SNOWAN_HOME / "audit.jsonl"
_MAX_SUMMARY = 200
_SUMMARY_KEYS = ("command", "path", "file_path", "pattern", "query", "url", "name", "timezone")


def summarize(args: Any) -> str:
    """A short, SAFE summary from a tool call's args — only the known scalar keys of
    our own tools, never an arbitrary value (an MCP tool's `token`/`api_key` arg must
    not land in the on-disk audit log). URL query/fragment is dropped (often a token)."""
    if not isinstance(args, dict):
        return ""
    for k in _SUMMARY_KEYS:
        v = args.get(k)
        if isinstance(v, str) and v.strip():
            v = v.split("\n")[0].strip()
            if k == "url":
                sp = urlsplit(v)
                if sp.scheme and sp.netloc:
                    v = f"{sp.scheme}://{sp.netloc}{sp.path}"
            return v[:_MAX_SUMMARY]
    return ""


def log(tool: str, summary: str = "", status: str = "ok") -> None:
    try:
        SNOWAN_HOME.mkdir(parents=True, exist_ok=True)
        entry = {
            "ts": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
            "tool": tool,
            "summary": summary[:_MAX_SUMMARY],
            "status": status,
        }
        with AUDIT_PATH.open("a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    except OSError:
        pass  # auditing must never break a turn


def recent(limit: int = 100) -> list[dict]:
    if not AUDIT_PATH.exists():
        return []
    try:
        lines = AUDIT_PATH.read_text(encoding="utf-8").splitlines()[-limit:]
    except OSError:
        return []
    out = []
    for ln in reversed(lines):  # newest first
        try:
            out.append(json.loads(ln))
        except json.JSONDecodeError:
            pass
    return out
