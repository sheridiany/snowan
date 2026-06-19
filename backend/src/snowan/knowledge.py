"""Note vault: each note is a portable Markdown file with YAML frontmatter under
~/.snowan/knowledge/notes/, so the user can open / edit / sync / git the vault with
Obsidian or any editor. This vault IS the source of truth; the SQLite search index
(knowledge_index) is derived and rebuildable. Every write keeps the index in sync;
`sync_index()` reconciles edits made directly in the vault (e.g. via Obsidian)."""
import hashlib
import json
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path

import yaml

from . import knowledge_index, knowledge_search
from .config import SNOWAN_HOME

KNOWLEDGE_DIR = SNOWAN_HOME / "knowledge"
VAULT = KNOWLEDGE_DIR / "notes"
_LEGACY_JSON = KNOWLEDGE_DIR / "notes.json"
_ILLEGAL = re.compile(r'[\\/:*?"<>|\n\r\t]+')


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
        "created_at": str(fm["created"]) if fm.get("created") else mtime,
        "updated_at": str(fm["updated"]) if fm.get("updated") else mtime,
        # Provenance: "manual" or "chat" (a 生成笔记 distilled from a conversation).
        # `source` keeps the chat/message refs so the note can cite + jump back.
        "origin": str(fm["origin"]) if fm.get("origin") else "manual",
        "source": fm["source"] if isinstance(fm.get("source"), dict) else None,
        "_path": path,
    }


def _serialize(note: dict) -> str:
    front = {
        "id": note["id"],
        "title": note["title"],
        "created": note["created_at"],
        "updated": note["updated_at"],
    }
    if note.get("origin") and note["origin"] != "manual":
        front["origin"] = note["origin"]
    if note.get("source"):
        front["source"] = note["source"]
    fm = yaml.safe_dump(front, allow_unicode=True, sort_keys=False).strip()
    return f"---\n{fm}\n---\n\n{note['body']}\n"


def _public(note: dict) -> dict:
    out = {k: note[k] for k in ("id", "title", "body", "created_at", "updated_at")}
    out["origin"] = note.get("origin", "manual")
    if note.get("source"):
        out["source"] = note["source"]
    return out


def _all() -> list[dict]:
    if not VAULT.exists():
        return []
    notes = [n for p in VAULT.glob("*.md") if (n := _parse(p))]
    notes.sort(key=lambda n: n["created_at"], reverse=True)
    return notes


def _find(note_id: str) -> dict | None:
    return next((n for n in _all() if n["id"] == note_id), None)


def _free_path(title: str, note_id: str) -> Path:
    base = _slug(title)
    p = VAULT / f"{base}.md"
    n = 2
    while p.exists():
        existing = _parse(p)
        if existing and existing["id"] == note_id:
            return p
        p = VAULT / f"{base}-{n}.md"
        n += 1
    return p


def _migrate_legacy() -> None:
    """One-time: convert an old single notes.json into per-note .md files."""
    if VAULT.exists() or not _LEGACY_JSON.exists():
        return
    VAULT.mkdir(parents=True, exist_ok=True)
    try:
        data = json.loads(_LEGACY_JSON.read_text())
    except (json.JSONDecodeError, OSError):
        data = {}
    for note in data.get("notes", []):
        note.setdefault("id", f"note_{uuid.uuid4().hex}")
        note.setdefault("title", _title_from_body(note.get("body", "")))
        note.setdefault("created_at", _now())
        note.setdefault("updated_at", note["created_at"])
        _free_path(note["title"], note["id"]).write_text(_serialize(note), encoding="utf-8")
    _LEGACY_JSON.rename(_LEGACY_JSON.with_suffix(".json.migrated"))


def _ensure_vault() -> None:
    _migrate_legacy()
    VAULT.mkdir(parents=True, exist_ok=True)


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
    new_path = _free_path(n["title"], n["id"])
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
    """Hybrid (keyword + semantic) search over the indexed vault."""
    return knowledge_search.search(query, max(1, min(limit, 8)))
