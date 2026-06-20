"""Long-term memory store (Phase 3). Three tiers under ~/.snowan/memory/, all
portable Markdown so the user can read/edit/git them:

- L1 episodic : daily/YYYY-MM-DD.md   — append-only raw log of what happened
- L2 semantic : entries/*.md           — atomic distilled facts (one per file) with
                                          decay metadata; indexed as source_type='memory'
- L3 profile  : PROFILE.md             — stable identity/preferences, always injected

The vault is the source of truth; the SQLite index (knowledge_index) is derived.
Memory is the highest-weight source in the shared hybrid index. Forgetting is soft
(recall score decays with age, reinforced on recall) + hard (the manual consolidation
pass; see memory_consolidate). L3 is never written automatically — only on explicit
user request or an approved consolidation diff."""
import hashlib
import math
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path

import yaml

from . import knowledge_index, knowledge_search
from .config import SNOWAN_HOME

MEMORY_DIR = SNOWAN_HOME / "memory"
ENTRIES = MEMORY_DIR / "entries"   # L2 atomic semantic memories
DAILY = MEMORY_DIR / "daily"       # L1 episodic logs
PROFILE_PATH = MEMORY_DIR / "PROFILE.md"  # L3
BACKUP = MEMORY_DIR / "backup"

TYPES = ("fact", "preference", "decision", "project", "todo", "person")
_KNOWN_FM = {"id", "type", "importance", "strength", "confidence", "valid",
             "created", "updated", "last_recalled", "source"}
_DECAY_BASE_DAYS = 30.0  # R = exp(-age_days / (base * strength)); larger strength = slower forgetting
_ILLEGAL = re.compile(r'[\\/:*?"<>|\n\r\t]+')


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def _today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _age_days(iso: str) -> float:
    try:
        t = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        if t.tzinfo is None:  # a hand-typed bare date (2026-06-20) parses tz-naive
            t = t.replace(tzinfo=timezone.utc)
    except (ValueError, AttributeError, TypeError):
        return 0.0
    return max(0.0, (datetime.now(timezone.utc) - t).total_seconds() / 86400.0)


def _slug(text: str) -> str:
    s = re.sub(r"\s+", " ", _ILLEGAL.sub(" ", text)).strip()[:48].strip()
    return s or "memory"


# --- L2 atomic entries -----------------------------------------------------

def _parse(path: Path) -> dict | None:
    try:
        raw = path.read_text(encoding="utf-8")
    except OSError:
        return None
    fm: dict = {}
    body = raw
    if raw.startswith("---"):
        end = raw.find("\n---", 3)
        if end != -1:
            try:
                fm = yaml.safe_load(raw[3:end]) or {}
            except yaml.YAMLError:
                fm = {}
            body = raw[end + 4 :].lstrip("\n")
    if not isinstance(fm, dict):
        fm = {}
    st = path.stat()
    mtime = datetime.fromtimestamp(st.st_mtime, timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    content = body.strip()
    imp = fm.get("importance")
    imp = max(1, min(int(imp), 5)) if isinstance(imp, int) and not isinstance(imp, bool) else 3
    return {
        "id": str(fm["id"]) if fm.get("id") else "mem_" + hashlib.sha1(path.name.encode()).hexdigest()[:16],
        "content": content,
        "type": str(fm["type"]) if fm.get("type") in TYPES else "fact",
        "importance": imp,
        "strength": float(fm["strength"]) if isinstance(fm.get("strength"), (int, float)) else 1.0,
        "confidence": float(fm["confidence"]) if isinstance(fm.get("confidence"), (int, float)) else None,
        "valid": fm.get("valid", True) is not False,
        "created_at": str(fm["created"]) if fm.get("created") else mtime,
        "updated_at": str(fm["updated"]) if fm.get("updated") else mtime,
        "last_recalled": str(fm["last_recalled"]) if fm.get("last_recalled") else None,
        "source": fm["source"] if isinstance(fm.get("source"), (dict, list, str)) else None,
        # Preserve any frontmatter the user added by hand (tags/aliases/…) so a recall
        # rewrite doesn't silently drop it — the vault is the source of truth.
        "_extra": {k: v for k, v in fm.items() if k not in _KNOWN_FM},
        "_path": path,
    }


def _serialize(m: dict) -> str:
    front: dict = {
        "id": m["id"],
        "type": m.get("type", "fact"),
        "importance": int(m.get("importance", 3)),
        "strength": round(float(m.get("strength", 1.0)), 3),
        "valid": bool(m.get("valid", True)),
        "created": m["created_at"],
        "updated": m["updated_at"],
    }
    if m.get("last_recalled"):
        front["last_recalled"] = m["last_recalled"]
    if m.get("confidence") is not None:
        front["confidence"] = round(float(m["confidence"]), 2)
    if m.get("source"):
        front["source"] = m["source"]
    if m.get("_extra"):
        front.update(m["_extra"])  # keep user-added frontmatter fields
    fm = yaml.safe_dump(front, allow_unicode=True, sort_keys=False).strip()
    return f"---\n{fm}\n---\n\n{m['content'].strip()}\n"


def _public(m: dict) -> dict:
    return {k: m[k] for k in (
        "id", "content", "type", "importance", "strength", "confidence",
        "valid", "created_at", "updated_at", "last_recalled", "source",
    )}


def _ensure() -> None:
    for d in (MEMORY_DIR, ENTRIES, DAILY):
        d.mkdir(parents=True, exist_ok=True)
        try:
            d.chmod(0o700)  # personal memory stays private, like config.json
        except OSError:
            pass


def _all_entries() -> list[dict]:
    if not ENTRIES.exists():
        return []
    out = [m for p in ENTRIES.glob("*.md") if (m := _parse(p))]
    out.sort(key=lambda m: m["updated_at"], reverse=True)
    return out


def _find(mem_id: str) -> dict | None:
    return next((m for m in _all_entries() if m["id"] == mem_id), None)


def _free_path(content: str, mem_id: str) -> Path:
    base = _slug(content)
    p = ENTRIES / f"{base}.md"
    n = 2
    while p.exists():
        ex = _parse(p)
        if ex and ex["id"] == mem_id:
            return p
        p = ENTRIES / f"{base}-{n}.md"
        n += 1
    return p


def _index(m: dict) -> None:
    knowledge_index.index_document({
        "id": m["id"],
        "title": m["content"][:60],
        "body": m["content"],
        "created_at": m["created_at"],
        "updated_at": m["updated_at"],
        "source_type": "memory",
    })


def list_entries(include_invalid: bool = False) -> list[dict]:
    _ensure()
    return [_public(m) for m in _all_entries() if include_invalid or m["valid"]]


def get_entry(mem_id: str) -> dict | None:
    _ensure()
    m = _find(mem_id)
    return _public(m) if m else None


def create_entry(content: str, *, type: str = "fact", importance: int = 3,
                 confidence: float | None = None, source=None) -> dict:
    _ensure()
    now = _now()
    m = {
        "id": f"mem_{uuid.uuid4().hex}",
        "content": content.strip(),
        "type": type if type in TYPES else "fact",
        "importance": max(1, min(int(importance), 5)),
        "strength": 1.0,
        "confidence": confidence,
        "valid": True,
        "created_at": now,
        "updated_at": now,
        "last_recalled": None,
        "source": source,
    }
    _free_path(m["content"], m["id"]).write_text(_serialize(m), encoding="utf-8")
    _index(m)
    return _public(m)


def update_entry(mem_id: str, **fields) -> dict | None:
    _ensure()
    m = _find(mem_id)
    if m is None:
        return None
    old_path: Path = m["_path"]
    for k in ("content", "type", "importance", "confidence", "valid", "source"):
        if k in fields and fields[k] is not None:
            m[k] = fields[k]
    m["importance"] = max(1, min(int(m["importance"]), 5))
    m["updated_at"] = _now()
    new_path = _free_path(m["content"], m["id"])
    new_path.write_text(_serialize(m), encoding="utf-8")
    if new_path != old_path:
        old_path.unlink(missing_ok=True)
    if m["valid"]:
        _index(m)
    else:
        knowledge_index.remove_document(m["id"])  # deprecated memories drop out of recall
    return _public(m)


def delete_entry(mem_id: str) -> bool:
    _ensure()
    m = _find(mem_id)
    if m is None:
        return False
    m["_path"].unlink(missing_ok=True)
    knowledge_index.remove_document(mem_id)
    return True


# --- soft forgetting: decay + reinforcement (called by knowledge_search) ----

def recency_factors(doc_ids: list[str]) -> dict[str, float]:
    """Decay multiplier per memory doc for recall ranking:
    R = exp(-age / (base * strength)) * (importance/3). Age is days since last touch
    (write or reinforcement). Untouched, low-importance memories sink; never deleted."""
    if not doc_ids:
        return {}
    wanted = set(doc_ids)
    out: dict[str, float] = {}
    for m in _all_entries():
        if m["id"] in wanted:
            ref = m["last_recalled"] or m["updated_at"]
            recency = math.exp(-_age_days(ref) / (_DECAY_BASE_DAYS * max(m["strength"], 0.25)))
            out[m["id"]] = recency * (m["importance"] / 3.0)
    return out


def reinforce(doc_ids: list[str]) -> None:
    """Recalling a memory strengthens it (Ebbinghaus reinforcement): bump strength,
    refresh last_recalled. Called when a memory actually surfaces in a recall."""
    if not doc_ids:
        return
    wanted = set(doc_ids)
    now = _now()
    for m in _all_entries():
        if m["id"] in wanted and m["valid"]:
            m["strength"] = min(m["strength"] + 1.0, 10.0)
            m["last_recalled"] = now  # drives recency; updated_at stays the real edit time
            m["_path"].write_text(_serialize(m), encoding="utf-8")


# --- L1 episodic daily log -------------------------------------------------

def append_daily(text: str, date: str | None = None) -> None:
    _ensure()
    date = date or _today()
    path = DAILY / f"{date}.md"
    stamp = datetime.now(timezone.utc).strftime("%H:%M")
    header = "" if path.exists() else f"# {date}\n\n"
    with path.open("a", encoding="utf-8") as f:
        f.write(f"{header}- [{stamp}] {text.strip()}\n")


def read_daily(date: str | None = None) -> str:
    date = date or _today()
    path = DAILY / f"{date}.md"
    try:
        return path.read_text(encoding="utf-8")
    except OSError:
        return ""


def list_daily_dates() -> list[str]:
    if not DAILY.exists():
        return []
    return sorted((p.stem for p in DAILY.glob("*.md")), reverse=True)


# --- L3 profile ------------------------------------------------------------

def get_profile() -> str:
    try:
        return PROFILE_PATH.read_text(encoding="utf-8")
    except OSError:
        return ""


def set_profile(text: str) -> None:
    _ensure()
    if PROFILE_PATH.exists():
        _backup(PROFILE_PATH, "profile")
    PROFILE_PATH.write_text(text.rstrip() + "\n", encoding="utf-8")


def profile_text() -> str:
    """Trimmed profile for injecting into the agent instructions each turn."""
    return get_profile().strip()


def _backup(path: Path, tag: str) -> None:
    BACKUP.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    try:
        (BACKUP / f"{tag}_{stamp}.md").write_text(path.read_text(encoding="utf-8"), encoding="utf-8")
    except OSError:
        pass


# --- maintenance -----------------------------------------------------------

def sync_index() -> None:
    """Reconcile the index with the memory vault on startup (entries edited directly
    in the vault get re-indexed; deletions/invalidations pruned)."""
    _ensure()
    docs = [{
        "id": m["id"], "title": m["content"][:60], "body": m["content"],
        "created_at": m["created_at"], "updated_at": m["updated_at"], "source_type": "memory",
    } for m in _all_entries() if m["valid"]]
    knowledge_index.reconcile("memory", docs)


def clear_all() -> dict:
    """Erase all long-term memory — entries (+ their index rows), profile, and daily
    logs. The profile is backed up first. Returns counts of what was removed."""
    _ensure()
    n = 0
    for m in _all_entries():
        m["_path"].unlink(missing_ok=True)
        knowledge_index.remove_document(m["id"])
        n += 1
    if PROFILE_PATH.exists():
        _backup(PROFILE_PATH, "profile")
        PROFILE_PATH.unlink(missing_ok=True)
    days = 0
    if DAILY.exists():
        for p in DAILY.glob("*.md"):
            p.unlink(missing_ok=True)
            days += 1
    return {"entries": n, "daily": days}


def recall(query: str, limit: int = 5, reinforce: bool = False) -> list[dict]:
    """Memory-only recall (decay-aware). reinforce=True only for genuine agent use
    (the recall_memory tool); the panel preview passes False so browsing doesn't bump
    strength. Returns entries best-first."""
    hits = knowledge_search.search(query, limit * 2, reinforce=reinforce)
    rank = {h["document_id"]: i for i, h in enumerate(hits)}
    found = [m for m in _all_entries() if m["id"] in rank]
    found.sort(key=lambda m: rank[m["id"]])
    return [_public(m) for m in found][:limit]
