"""Knowledge base: a flat note store under ~/.snowan/knowledge/notes.json plus
keyword+recency search over it. Single-user, so plain sync I/O with an atomic
write — no locks. The search layer is a notes-only port of QwenPaw's keyword
scoring (CJK n-grams, stopword filtering, recency tiebreak)."""
import json
import os
import re
import uuid
from datetime import datetime, timezone

from .config import SNOWAN_HOME

KNOWLEDGE_DIR = SNOWAN_HOME / "knowledge"
NOTES_PATH = KNOWLEDGE_DIR / "notes.json"


# --- store -----------------------------------------------------------------

def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _load() -> dict:
    if not NOTES_PATH.exists():
        return {"version": 1, "notes": []}
    try:
        data = json.loads(NOTES_PATH.read_text())
    except (json.JSONDecodeError, OSError):
        return {"version": 1, "notes": []}
    data.setdefault("version", 1)
    data.setdefault("notes", [])
    return data


def _save(data: dict) -> None:
    KNOWLEDGE_DIR.mkdir(parents=True, exist_ok=True)
    tmp = NOTES_PATH.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2))
    os.replace(tmp, NOTES_PATH)


def _title_from_body(body: str) -> str:
    """The note title when none is given: first non-empty line, trimmed to 32."""
    for line in body.splitlines():
        s = line.strip().lstrip("#").strip()
        if s:
            return s if len(s) <= 32 else s[:32] + "…"
    return "未命名笔记"


def list_notes() -> list[dict]:
    return sorted(_load()["notes"], key=lambda n: n.get("created_at", ""), reverse=True)


def get_note(note_id: str) -> dict | None:
    return next((n for n in _load()["notes"] if n["id"] == note_id), None)


def create_note(body: str, title: str = "") -> dict:
    now = _now()
    note = {
        "id": f"note_{uuid.uuid4().hex}",
        "title": title.strip() or _title_from_body(body),
        "body": body,
        "created_at": now,
        "updated_at": now,
    }
    data = _load()
    data["notes"].insert(0, note)
    _save(data)
    return note


def update_note(note_id: str, *, title: str | None = None, body: str | None = None) -> dict | None:
    data = _load()
    for n in data["notes"]:
        if n["id"] == note_id:
            if body is not None:
                n["body"] = body
            if title is not None:
                n["title"] = title.strip() or _title_from_body(n["body"])
            n["updated_at"] = _now()
            _save(data)
            return n
    return None


def delete_note(note_id: str) -> bool:
    data = _load()
    kept = [n for n in data["notes"] if n["id"] != note_id]
    if len(kept) == len(data["notes"]):
        return False
    data["notes"] = kept
    _save(data)
    return True


# --- search ----------------------------------------------------------------

# Frequent words that carry no search signal on their own.
_STOPWORDS = {
    "一下", "什么", "怎么", "如何", "我的", "这个", "那个", "可以", "需要", "没有",
    "知道", "告诉", "帮我", "看看", "关于", "记得", "之前", "现在", "哪些", "一些",
    "the", "and", "for", "with", "what", "how", "about", "show", "list", "note", "notes",
}
_STOP_CHARS = set("的了吗呢吧啊呀和与或在是有我你他她它们这那")
_TOKEN_RE = re.compile(r"[a-z0-9]+|[一-鿿]+", re.IGNORECASE)


def _normalize(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip().lower()


def _keywords(query: str) -> list[str]:
    """Tokenize a query into search terms. CJK runs longer than 3 chars expand
    into 2- and 3-grams so partial Chinese phrases still match."""
    terms: set[str] = set()
    for tok in _TOKEN_RE.findall(_normalize(query)):
        if tok.isascii():
            if len(tok) >= 2 and tok not in _STOPWORDS:
                terms.add(tok)
        elif len(tok) <= 3:
            if len(tok) >= 2 and tok not in _STOPWORDS and tok not in _STOP_CHARS:
                terms.add(tok)
        else:
            for n in (2, 3):
                for i in range(len(tok) - n + 1):
                    g = tok[i : i + n]
                    if g not in _STOPWORDS:
                        terms.add(g)
    return sorted(terms, key=len, reverse=True)


def _hit_count(text: str, terms: list[str]) -> int:
    t = text.lower()
    return sum(t.count(term) for term in terms)


def _recency_score(iso: str) -> float:
    """A small recency tiebreak in [0, 1.5] — never outweighs a keyword hit."""
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return 0.0
    return max(0.0, min(1.5, dt.timestamp() / 8.64e10))


def _excerpt(body: str, terms: list[str], max_chars: int = 720) -> str:
    """A snippet centered on the line with the most keyword hits."""
    lines = body.splitlines()
    if not lines:
        return body[:max_chars]
    best_i = max(range(len(lines)), key=lambda i: _hit_count(lines[i], terms))
    text = "\n".join(lines[max(0, best_i - 1) : best_i + 5]).strip()
    return text if len(text) <= max_chars else text[: max_chars - 1].rstrip() + "…"


def search_notes(query: str, limit: int = 8) -> list[dict]:
    """Rank notes by keyword hits (title x10, body x3) plus a recency tiebreak."""
    limit = max(1, min(limit, 8))
    terms = _keywords(query)
    if not terms:
        return []
    scored: list[tuple[float, dict]] = []
    for note in _load()["notes"]:
        score = (
            _hit_count(note.get("title", ""), terms) * 10
            + _hit_count(note.get("body", ""), terms) * 3
            + _recency_score(note.get("updated_at") or note.get("created_at", ""))
        )
        if score >= 3:
            scored.append((score, note))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [
        {
            "id": n["id"],
            "title": n["title"],
            "snippet": _excerpt(n.get("body", ""), terms),
            "score": round(s, 3),
        }
        for s, n in scored[:limit]
    ]
