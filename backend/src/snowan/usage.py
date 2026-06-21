"""Per-turn token + cache telemetry at ~/.snowan/usage.jsonl. Lets the user see
whether prompt caching is actually landing (cache_read vs fresh input) — the
verification that the stable-prefix discipline works. Like audit.py: append-only,
best-effort, never breaks a turn. Surfaced in 关于."""
import json
from datetime import datetime, timezone
from typing import Any

from .config import SNOWAN_HOME, load_settings

USAGE_PATH = SNOWAN_HOME / "usage.jsonl"


def record(result: Any) -> None:
    """Append one turn's usage (input/output/cache tokens) from a run result."""
    try:
        u = result.usage  # RunUsage (property in pydantic-ai 1.107+)
    except Exception:  # noqa: BLE001 — no usage on this result; nothing to record
        return
    try:
        SNOWAN_HOME.mkdir(parents=True, exist_ok=True)
        entry = {
            "ts": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
            "model": load_settings().model,
            "input": getattr(u, "input_tokens", 0) or 0,
            "output": getattr(u, "output_tokens", 0) or 0,
            "cache_read": getattr(u, "cache_read_tokens", 0) or 0,
            "cache_write": getattr(u, "cache_write_tokens", 0) or 0,
        }
        with USAGE_PATH.open("a", encoding="utf-8") as f:
            f.write(json.dumps(entry) + "\n")
    except OSError:
        pass  # telemetry must never break a turn


def summary(limit: int = 200) -> dict:
    """Totals + cache hit-rate over the most recent `limit` turns.
    hit_rate = cached input / total input read = cache_read / (cache_read + fresh input);
    the one-time cache_write cost is reported separately, not counted as a miss."""
    rows = _recent(limit)
    inp = sum(r.get("input", 0) for r in rows)
    out = sum(r.get("output", 0) for r in rows)
    cr = sum(r.get("cache_read", 0) for r in rows)
    cw = sum(r.get("cache_write", 0) for r in rows)
    denom = cr + inp
    return {
        "turns": len(rows),
        "input": inp,
        "output": out,
        "cache_read": cr,
        "cache_write": cw,
        "hit_rate": round(cr / denom, 3) if denom else 0.0,
    }


def _recent(limit: int) -> list[dict]:
    if not USAGE_PATH.exists():
        return []
    try:
        lines = USAGE_PATH.read_text(encoding="utf-8").splitlines()[-limit:]
    except OSError:
        return []
    out = []
    for ln in lines:
        try:
            out.append(json.loads(ln))
        except json.JSONDecodeError:
            pass
    return out
