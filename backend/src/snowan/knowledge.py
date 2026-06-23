"""Note vault: each note is a portable Markdown file with YAML frontmatter under
~/.snowan/knowledge/notes/, so the user can open / edit / sync / git the vault with
Obsidian or any editor. This vault IS the source of truth; the SQLite search index
(knowledge_index) is derived and rebuildable. Every write keeps the index in sync;
`sync_index()` reconciles edits made directly in the vault (e.g. via Obsidian)."""
import hashlib
import json
import re
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import yaml

from . import config, knowledge_index, knowledge_search
from .config import SNOWAN_HOME

KNOWLEDGE_DIR = SNOWAN_HOME / "knowledge"
VAULT = KNOWLEDGE_DIR / "notes"
_LEGACY_JSON = KNOWLEDGE_DIR / "notes.json"
_ILLEGAL = re.compile(r'[\\/:*?"<>|\n\r\t]+')

# Frontmatter keys the parser/serializer handle explicitly; everything else the
# user hand-wrote (tags/aliases/…) is captured in _extra and re-emitted untouched
# so the vault stays the source of truth (ported from memory.py).
_KNOWN_FM = {"id", "title", "type", "date", "created", "updated", "origin", "source"}
_DAILY_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _title_from_body(body: str) -> str:
    for line in body.splitlines():
        s = line.strip().lstrip("#").strip()
        if s:
            return s if len(s) <= 32 else s[:32] + "…"
    return "未命名笔记"


def _slug(title: str) -> str:
    s = re.sub(r"\s+", " ", _ILLEGAL.sub(" ", title)).strip()[:60].strip()
    return s or "未命名笔记"


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
    mtime = datetime.fromtimestamp(st.st_mtime, timezone.utc).isoformat(
        timespec="milliseconds"
    ).replace("+00:00", "Z")
    # Coerce to str: PyYAML may load an unquoted ISO timestamp written by hand in
    # the vault as a datetime, which would otherwise break JSON responses.
    return {
        "id": str(fm["id"]) if fm.get("id") else "note_" + hashlib.sha1(path.name.encode()).hexdigest()[:16],
        "title": str(fm["title"]) if fm.get("title") else path.stem,
        "body": body,
        # type/date are first-class so 'type: daily' survives an update round-trip
        # (a 日记 is just a typed note; date is hand-typed YYYY-MM-DD).
        "type": str(fm["type"]) if fm.get("type") else "note",
        "date": str(fm["date"]) if fm.get("date") else None,
        "created_at": str(fm["created"]) if fm.get("created") else mtime,
        "updated_at": str(fm["updated"]) if fm.get("updated") else mtime,
        # Provenance: "manual" or "chat" (a 生成笔记 distilled from a conversation).
        # `source` keeps the chat/message refs so the note can cite + jump back.
        "origin": str(fm["origin"]) if fm.get("origin") else "manual",
        "source": fm["source"] if isinstance(fm.get("source"), dict) else None,
        # Preserve any frontmatter the user added by hand so an update doesn't drop it.
        "_extra": {k: v for k, v in fm.items() if k not in _KNOWN_FM},
        "_path": path,
    }


def _serialize(note: dict) -> str:
    front: dict = {
        "id": note["id"],
        "title": note["title"],
    }
    if note.get("type") and note["type"] != "note":
        front["type"] = note["type"]
    if note.get("date"):
        front["date"] = note["date"]
    front["created"] = note["created_at"]
    front["updated"] = note["updated_at"]
    if note.get("origin") and note["origin"] != "manual":
        front["origin"] = note["origin"]
    if note.get("source"):
        front["source"] = note["source"]
    if note.get("_extra"):
        front.update(note["_extra"])  # keep user-added frontmatter fields
    fm = yaml.safe_dump(front, allow_unicode=True, sort_keys=False).strip()
    return f"---\n{fm}\n---\n\n{note['body']}\n"


def _public(note: dict) -> dict:
    out = {k: note[k] for k in ("id", "title", "body", "created_at", "updated_at")}
    out["origin"] = note.get("origin", "manual")
    if note.get("type") and note["type"] != "note":
        out["type"] = note["type"]
    if note.get("date"):
        out["date"] = note["date"]
    if note.get("source"):
        out["source"] = note["source"]
    return out


def _vault() -> Path:
    # Resolve from config on every call so tests can repoint SNOWAN_HOME.
    return config.SNOWAN_HOME / "knowledge" / "notes"


def _daily_dir() -> Path:
    return _vault() / "daily"


def _all() -> list[dict]:
    vault = _vault()
    if not vault.exists():
        return []
    # rglob so subfolders (notes/daily/) are indexed, not just the flat top level.
    notes = [n for p in vault.rglob("*.md") if (n := _parse(p))]
    notes.sort(key=lambda n: n["created_at"], reverse=True)
    return notes


def _find(note_id: str) -> dict | None:
    return next((n for n in _all() if n["id"] == note_id), None)


def _free_path(title: str, note_id: str) -> Path:
    vault = _vault()
    base = _slug(title)
    p = vault / f"{base}.md"
    n = 2
    while p.exists():
        existing = _parse(p)
        if existing and existing["id"] == note_id:
            return p
        p = vault / f"{base}-{n}.md"
        n += 1
    return p


def _path_for(note: dict) -> Path:
    """Where a note's .md lives. A daily note's filename IS its date (it bypasses
    the slug path); everything else gets a deduped slug under the vault root."""
    if note.get("type") == "daily" and note.get("date"):
        return _daily_dir() / f"{note['date']}.md"
    return _free_path(note["title"], note["id"])


def _migrate_legacy() -> None:
    """One-time: convert an old single notes.json into per-note .md files."""
    vault = _vault()
    legacy = config.SNOWAN_HOME / "knowledge" / "notes.json"
    if vault.exists() or not legacy.exists():
        return
    vault.mkdir(parents=True, exist_ok=True)
    try:
        data = json.loads(legacy.read_text())
    except (json.JSONDecodeError, OSError):
        data = {}
    for note in data.get("notes", []):
        note.setdefault("id", f"note_{uuid.uuid4().hex}")
        note.setdefault("title", _title_from_body(note.get("body", "")))
        note.setdefault("created_at", _now())
        note.setdefault("updated_at", note["created_at"])
        _free_path(note["title"], note["id"]).write_text(_serialize(note), encoding="utf-8")
    legacy.rename(legacy.with_suffix(".json.migrated"))


def _ensure_vault() -> None:
    _migrate_legacy()
    _vault().mkdir(parents=True, exist_ok=True)


# --- public note API -------------------------------------------------------

def list_notes() -> list[dict]:
    _ensure_vault()
    return [_public(n) for n in _all()]


def get_note(note_id: str) -> dict | None:
    _ensure_vault()
    n = _find(note_id)
    return _public(n) if n else None


def create_note(body: str, title: str = "", origin: str = "manual", source: dict | None = None) -> dict:
    _ensure_vault()
    now = _now()
    note = {
        "id": f"note_{uuid.uuid4().hex}",
        "title": title.strip() or _title_from_body(body),
        "body": body,
        "created_at": now,
        "updated_at": now,
        "origin": origin,
        "source": source,
    }
    _free_path(note["title"], note["id"]).write_text(_serialize(note), encoding="utf-8")
    knowledge_index.index_document({**note, "source_type": "note"})
    return _public(note)


def update_note(note_id: str, *, title: str | None = None, body: str | None = None) -> dict | None:
    _ensure_vault()
    n = _find(note_id)
    if n is None:
        return None
    old_path: Path = n["_path"]
    if body is not None:
        n["body"] = body
    if title is not None:
        n["title"] = title.strip() or _title_from_body(n["body"])
    n["updated_at"] = _now()
    new_path = _path_for(n)
    new_path.write_text(_serialize(n), encoding="utf-8")
    if new_path != old_path:
        old_path.unlink(missing_ok=True)
    knowledge_index.index_document({**_public(n), "source_type": "note"})
    return _public(n)


def delete_note(note_id: str) -> bool:
    _ensure_vault()
    n = _find(note_id)
    if n is None:
        return False
    n["_path"].unlink(missing_ok=True)
    knowledge_index.remove_document(note_id)
    return True


def sync_index() -> None:
    """Reconcile the SQLite index with the vault — call on startup so notes edited
    directly in the vault (Obsidian/git) get (re)indexed and deletions pruned."""
    _ensure_vault()
    knowledge_index.reconcile("note", [{**_public(n), "source_type": "note"} for n in _all()])


def search_notes(query: str, limit: int = 8) -> list[dict]:
    """Hybrid (keyword + semantic) search over the indexed vault. Excludes private
    long-term memory — that surfaces only through the agent's recall, not note browse."""
    return knowledge_search.search(query, max(1, min(limit, 8)), exclude_sources={"memory"})


# --- 今天 (daily note) ------------------------------------------------------
# A daily note is a typed note living at notes/daily/YYYY-MM-DD.md. "today" is
# always the date string the client passes (its local date) — the backend never
# computes its own now() for it, to avoid timezone drift.

def _daily_path(date: str) -> Path:
    # The filename IS the date (§4). Validate at this single boundary so no daily
    # code path can be coaxed into "../.." and write a .md outside the vault — the
    # `date` param is client-supplied and reaches the filesystem from every endpoint.
    if not _DAILY_RE.match(date):
        raise ValueError(f"invalid daily date: {date!r}")
    return _daily_dir() / f"{date}.md"


def get_daily(date: str) -> dict | None:
    """The daily note for a date, or None if it doesn't exist yet (no create)."""
    _ensure_vault()
    p = _daily_path(date)
    n = _parse(p)
    return _public(n) if n else None


def get_or_create_daily(date: str) -> dict:
    """Find-or-create the daily note for `date` — starts empty; structure comes from
    the 早计划/晚复盘 drafts on demand, not a pre-filled template. The note bypasses the
    slug path — its filename is the date — and is tagged type:daily."""
    _ensure_vault()
    existing = get_daily(date)
    if existing is not None:
        return existing
    now = _now()
    note = {
        "id": f"note_{uuid.uuid4().hex}",
        "title": date,
        "body": "",
        "type": "daily",
        "date": date,
        "created_at": now,
        "updated_at": now,
        "origin": "manual",
        "source": None,
    }
    _daily_dir().mkdir(parents=True, exist_ok=True)
    _daily_path(date).write_text(_serialize(note), encoding="utf-8")
    knowledge_index.index_document({**_public(note), "source_type": "note"})
    return _public(note)


class DailyConflict(Exception):
    """The on-disk daily note changed since the client last loaded it (Obsidian/git
    edited it under the buffer). Carries the current note so the caller can 409."""

    def __init__(self, current: dict):
        self.current = current
        super().__init__("daily note changed on disk")


def save_daily(date: str, body: str, base_updated_at: str | None = None) -> dict:
    """Save the user's prose for a date (find-or-create first). If base_updated_at is
    given and the note on disk has a newer updated_at, raise DailyConflict instead of
    blindly overwriting — the editor must not stomp an out-of-band edit."""
    current = get_or_create_daily(date)
    if base_updated_at is not None and current["updated_at"] != base_updated_at:
        raise DailyConflict(current)
    return update_note(current["id"], body=body)


def list_daily_dates() -> list[str]:
    """Dates (YYYY-MM-DD) that have a daily note, newest first — for calendar dots."""
    d = _daily_dir()
    if not d.exists():
        return []
    return sorted((p.stem for p in d.glob("*.md") if _DAILY_RE.match(p.stem)), reverse=True)


def daily_carryover(before_date: str, days: int = 14, limit: int = 20) -> list[dict]:
    """Unchecked `- [ ]` items from recent daily notes strictly before `before_date`,
    newest day first. The user decides what rolls over — we never move them silently."""
    if not _DAILY_RE.match(before_date):
        raise ValueError(f"invalid daily date: {before_date!r}")
    out: list[dict] = []
    for date in list_daily_dates():
        if date >= before_date or date < _shift_date(before_date, -days):
            continue
        n = _parse(_daily_path(date))
        if n is None:
            continue
        for line in n["body"].splitlines():
            s = line.strip()
            if s.startswith("- [ ]") and s[5:].strip():
                out.append({"line": s, "fromDate": date})
                if len(out) >= limit:
                    return out
    return out


def _shift_date(date: str, days: int) -> str:
    try:
        d = datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        return date
    return (d + timedelta(days=days)).strftime("%Y-%m-%d")


# Fields the assembly band depends on from a calendar event. If the calendar side
# renames one, the adapter drops the event and the band degrades — the band never
# silently goes blank on the whole day, only on the malformed event.
_EVENT_FIELDS = ("id", "title", "startsAt", "endsAt", "location")


def _adapt_event(e: dict) -> dict | None:
    if not isinstance(e, dict) or "id" not in e or "title" not in e:
        return None
    return {k: e.get(k) for k in _EVENT_FIELDS}


def daily_assembly(date: str) -> dict:
    """The read-only assembly band for a date, queried LIVE (never written into the
    .md). events from the calendar (degrade to [] on empty/failure) and relevant
    long-term memory. Today's conversations/images are assembled on the frontend
    (it owns them), so they're not here."""
    from . import calendar  # lazy: avoid an import cycle at module load

    try:
        raw_events = calendar.events_on(date)
    except Exception:  # noqa: BLE001 — an empty/broken calendar must not break the band
        raw_events = []
    events = [a for e in raw_events if (a := _adapt_event(e))]

    # Relevance comes from what the user has written today, not the date string;
    # an unwritten note has nothing to relate to, so memory stays empty.
    note = get_daily(date)
    query = _carryover_free(note["body"]) if note else ""
    memory = []
    if query.strip():
        memory = [
            {"id": h["document_id"], "title": h["title"], "snippet": h["snippet"]}
            for h in knowledge_search.search(query, limit=4)
            if h["source_type"] == "memory"
        ]

    return {"events": events, "memory": memory}


def _carryover_free(body: str) -> str:
    """Body text minus the template scaffolding (headings, HTML comments, empty
    list bullets) — what's left is the user's own prose, the memory-recall signal."""
    keep: list[str] = []
    for line in body.splitlines():
        s = line.strip()
        if not s or s.startswith(("#", "<!--")):
            continue
        stripped = s.lstrip("-").strip()
        if stripped in ("", "[ ]", "[x]"):
            continue
        keep.append(stripped)
    return "\n".join(keep)
