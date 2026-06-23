"""Books (书架) DAO over ~/.snowan/books.db + cover blobs on disk.

WAL SQLite, a fresh _conn() per op closed in a finally. A book's metadata + chapter
bodies live here; its chapters are ALSO indexed into the shared knowledge_index
(source_type="book", uri=book_id) so 问答 reuses the same local-embedding RAG substrate
as notes instead of a private vector table. The index is derived and rebuildable —
books.db is the source of truth for chapter text.

One book id maps to N chapter documents in the index, keyed f"{book_id}:{num}"; the
uri column scopes retrieval to a single book. The DB path resolves via
config.SNOWAN_HOME on every connection so tests can monkeypatch it."""
import sqlite3
import uuid
from datetime import datetime, timezone

from . import config, embeddings, extract, knowledge_index

_SUPPORTED = {"epub"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


# --- DB --------------------------------------------------------------------

def _db_path():
    return config.SNOWAN_HOME / "books.db"


def _conn() -> sqlite3.Connection:
    path = _db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, timeout=15)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA busy_timeout=15000")
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS books(
          id TEXT PRIMARY KEY, title TEXT NOT NULL, author TEXT, language TEXT,
          format TEXT NOT NULL, has_cover INTEGER NOT NULL DEFAULT 0,
          added_at TEXT NOT NULL);

        CREATE TABLE IF NOT EXISTS chapters(
          book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
          num INTEGER NOT NULL, title TEXT, text TEXT, html TEXT,
          PRIMARY KEY(book_id, num));

        CREATE INDEX IF NOT EXISTS idx_chapters_book ON chapters(book_id);

        CREATE TABLE IF NOT EXISTS artifacts(
          book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
          kind TEXT NOT NULL, content TEXT, updated_at TEXT,
          PRIMARY KEY(book_id, kind));
        """
    )
    return conn


# --- covers (bytes on disk, not in the DB) ---------------------------------

def _covers_dir():
    return config.SNOWAN_HOME / "books" / "covers"


def _cover_path(book_id: str):
    return _covers_dir() / f"{book_id}.png"


def set_cover(book_id: str, png: bytes) -> None:
    _covers_dir().mkdir(parents=True, exist_ok=True)
    _cover_path(book_id).write_bytes(png)
    conn = _conn()
    try:
        conn.execute("UPDATE books SET has_cover=1 WHERE id=?", (book_id,))
        conn.commit()
    finally:
        conn.close()


def cover_bytes(book_id: str) -> bytes | None:
    p = _cover_path(book_id)
    if not p.exists():
        return None
    return p.read_bytes()


# --- index bridge ----------------------------------------------------------

def _index_chapter(book_id: str, book_title: str, ch: dict, ts: str) -> None:
    """Index one chapter into the shared knowledge_index as a "book" document."""
    knowledge_index.index_document({
        "id": f"{book_id}:{ch['num']}",
        "source_type": "book",
        "title": f"{book_title} · {ch['title']}",
        "uri": book_id,  # scope key for retrieve(); no .md suffix → chunk by 600-char cap
        "body": ch["text"],
        "created_at": ts,
        "updated_at": ts,
    })


# --- row -> dict helpers ---------------------------------------------------

def _cover_url(book_id: str) -> str:
    return f"/api/books/{book_id}/cover"


def _book_row(conn: sqlite3.Connection, row: sqlite3.Row) -> dict:
    n_chapters = conn.execute(
        "SELECT COUNT(*) FROM chapters WHERE book_id=?", (row["id"],)
    ).fetchone()[0]
    return {
        "id": row["id"],
        "title": row["title"],
        "author": row["author"],
        "format": row["format"],
        "cover_url": _cover_url(row["id"]) if row["has_cover"] else None,
        "n_chapters": n_chapters,
        "added_at": row["added_at"],
    }


# --- ingest ----------------------------------------------------------------

def add_book(filename: str, raw: bytes) -> dict:
    """Sniff format, parse, persist the book + chapters, save the cover, and index
    every chapter into the shared knowledge index. Returns the book dict. Raises
    ValueError on an empty/unparseable book and NotImplementedError on a format we
    don't handle yet (pdf/mobi/...)."""
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    if ext not in _SUPPORTED:
        raise NotImplementedError(f"暂不支持 .{ext or '未知'} 格式,目前仅支持 EPUB")

    parsed = extract.parse_epub(raw)
    chapters = parsed["chapters"]
    if not chapters:
        raise ValueError("无法从该文件解析出任何章节")

    book_id = "book_" + uuid.uuid4().hex
    ts = _now()
    cover = parsed.get("cover")

    # Build/write the DB rows first; index_document does its own embedding work
    # (which can be slow) outside this write transaction.
    conn = _conn()
    try:
        conn.execute(
            """INSERT INTO books(id, title, author, language, format, has_cover, added_at)
               VALUES(?,?,?,?,?,?,?)""",
            (book_id, parsed["title"], parsed["author"] or None,
             parsed["language"] or None, ext, 1 if cover else 0, ts),
        )
        conn.executemany(
            "INSERT INTO chapters(book_id, num, title, text, html) VALUES(?,?,?,?,?)",
            [(book_id, c["num"], c["title"], c["text"], c["html"]) for c in chapters],
        )
        conn.commit()
    finally:
        conn.close()

    if cover:
        set_cover(book_id, cover)

    for ch in chapters:
        # One bad chapter (e.g. an embed-time error) must not abort the whole import;
        # index_document already swallows model errors, this guards the unexpected.
        try:
            _index_chapter(book_id, parsed["title"], ch, ts)
        except Exception:  # noqa: BLE001 — keep importing the rest of the book
            pass

    return get_book(book_id)


# --- queries ---------------------------------------------------------------

def list_books() -> list[dict]:
    conn = _conn()
    try:
        rows = conn.execute("SELECT * FROM books ORDER BY added_at DESC").fetchall()
        return [_book_row(conn, r) for r in rows]
    finally:
        conn.close()


def get_book(book_id: str) -> dict | None:
    """Book metadata + a chapter table of contents (num + title, no bodies)."""
    conn = _conn()
    try:
        row = conn.execute("SELECT * FROM books WHERE id=?", (book_id,)).fetchone()
        if row is None:
            return None
        book = _book_row(conn, row)
        book["language"] = row["language"]
        book["chapters"] = [
            {"num": c["num"], "title": c["title"]}
            for c in conn.execute(
                "SELECT num, title FROM chapters WHERE book_id=? ORDER BY num", (book_id,)
            ).fetchall()
        ]
        return book
    finally:
        conn.close()


def get_chapter(book_id: str, num: int) -> dict | None:
    """A single chapter's rendered HTML (sanitized at parse time)."""
    conn = _conn()
    try:
        row = conn.execute(
            "SELECT num, title, html FROM chapters WHERE book_id=? AND num=?",
            (book_id, num),
        ).fetchone()
        if row is None:
            return None
        return {"num": row["num"], "title": row["title"], "html": row["html"]}
    finally:
        conn.close()


def delete_book(book_id: str) -> bool:
    """Remove the book, its chapters (FK cascade), its indexed documents, and the
    cover file. Returns False if the book didn't exist."""
    conn = _conn()
    try:
        n_chapters = conn.execute(
            "SELECT COUNT(*) FROM chapters WHERE book_id=?", (book_id,)
        ).fetchone()[0]
        cur = conn.execute("DELETE FROM books WHERE id=?", (book_id,))
        conn.commit()
        if cur.rowcount == 0:
            return False
    finally:
        conn.close()
    for num in range(n_chapters):
        knowledge_index.remove_document(f"{book_id}:{num}")
    _cover_path(book_id).unlink(missing_ok=True)
    return True


# --- 学习物料: artifacts (glossary|mindmap|summary) ------------------------

def set_artifact(book_id: str, kind: str, content: str) -> None:
    """Upsert a cached generated artifact for (book, kind)."""
    conn = _conn()
    try:
        conn.execute(
            """INSERT INTO artifacts(book_id, kind, content, updated_at)
               VALUES(?,?,?,?)
               ON CONFLICT(book_id, kind)
               DO UPDATE SET content=excluded.content, updated_at=excluded.updated_at""",
            (book_id, kind, content, _now()),
        )
        conn.commit()
    finally:
        conn.close()


def list_artifacts(book_id: str) -> dict:
    """{kind: content} for every cached artifact of this book."""
    conn = _conn()
    try:
        rows = conn.execute(
            "SELECT kind, content FROM artifacts WHERE book_id=?", (book_id,)
        ).fetchall()
        return {r["kind"]: r["content"] for r in rows}
    finally:
        conn.close()


def all_chapter_text(book_id: str, cap_per: int = 1500, cap_total: int = 16000) -> str:
    """Concat of every chapter's text (capped per chapter AND in total), for AI
    generators. The total cap keeps a fat book from ballooning the prompt into a
    multi-minute generation."""
    conn = _conn()
    try:
        rows = conn.execute(
            "SELECT title, text FROM chapters WHERE book_id=? ORDER BY num", (book_id,)
        ).fetchall()
    finally:
        conn.close()
    parts = []
    for r in rows:
        body = (r["text"] or "").strip()[:cap_per]
        parts.append(f"## {r['title']}\n{body}" if r["title"] else body)
    return "\n\n".join(parts)[:cap_total]


# --- retrieval (scoped to ONE book or across all books) --------------------

def retrieve(book_id: str | None, query: str, k: int = 6) -> list[dict]:
    """Top-k chunks for a query, scoped to source_type='book' (and uri=book_id when
    given; None = across the whole shelf). Returns [{chapter_title, snippet, ordinal}].

    knowledge_search.search() can't do this (no uri/source_type filter, 300-char
    snippet only, one chunk per document), so the chunks/documents tables are queried
    directly — the cosine/normalize math mirrors knowledge_search.search verbatim."""
    conn = knowledge_index._conn()
    try:
        if book_id:
            rows = conn.execute(
                """SELECT c.ordinal, c.text, c.embedding, d.title
                   FROM chunks c JOIN documents d ON d.id = c.document_id
                   WHERE d.source_type='book' AND d.uri=?""",
                (book_id,),
            ).fetchall()
        else:
            rows = conn.execute(
                """SELECT c.ordinal, c.text, c.embedding, d.title
                   FROM chunks c JOIN documents d ON d.id = c.document_id
                   WHERE d.source_type='book'""",
            ).fetchall()
    finally:
        conn.close()

    if not rows:
        return []

    def _out(r) -> dict:
        return {"chapter_title": r["title"], "snippet": _snippet(r["text"]), "ordinal": r["ordinal"]}

    want = embeddings.DIM * 4  # float32, mirrors knowledge_search
    embedded = [r for r in rows if r["embedding"] and len(r["embedding"]) == want]
    if not embedded or not embeddings.is_ready():
        # Model not downloaded (or no vectors yet): fall back to keyword recall so the
        # shelf is still searchable; degrade to the first k chunks if nothing matches.
        kw = _keyword_rank(query, rows, k)
        return [_out(r) for r in (kw or rows[:k])]

    import numpy as np

    mat = np.frombuffer(
        b"".join(r["embedding"] for r in embedded), dtype=np.float32
    ).reshape(len(embedded), embeddings.DIM)
    qv = embeddings.embed_query(query)
    qn = qv / (np.linalg.norm(qv) + 1e-9)
    sims = (mat / (np.linalg.norm(mat, axis=1, keepdims=True) + 1e-9)) @ qn
    order = np.argsort(-sims)[:k]
    return [_out(embedded[int(i)]) for i in order]


def retrieve_multi(book_ids: list[str] | None, query: str, k: int = 8) -> list[dict]:
    """retrieve() generalized to a SET of books for syntopical (跨书) reading. Same
    cosine/keyword math as retrieve(), but each hit is tagged with the book it came
    from. Returns [{book_id, book_title, chapter_title, snippet}].

    book_ids=[]/None scopes to the whole shelf; unknown ids simply yield no rows."""
    conn = knowledge_index._conn()
    try:
        if book_ids:
            placeholders = ",".join("?" * len(book_ids))
            rows = conn.execute(
                f"""SELECT c.ordinal, c.text, c.embedding, d.title, d.uri
                    FROM chunks c JOIN documents d ON d.id = c.document_id
                    WHERE d.source_type='book' AND d.uri IN ({placeholders})""",
                tuple(book_ids),
            ).fetchall()
        else:
            rows = conn.execute(
                """SELECT c.ordinal, c.text, c.embedding, d.title, d.uri
                   FROM chunks c JOIN documents d ON d.id = c.document_id
                   WHERE d.source_type='book'""",
            ).fetchall()
    finally:
        conn.close()

    if not rows:
        return []

    def _out(r) -> dict:
        # d.title is "book_title · chapter_title" (set by _index_chapter); split once.
        parts = (r["title"] or "").split(" · ", 1)
        return {
            "book_id": r["uri"],
            "book_title": parts[0],
            "chapter_title": parts[1] if len(parts) > 1 else "",
            "snippet": _snippet(r["text"]),
        }

    want = embeddings.DIM * 4  # float32, mirrors retrieve()
    embedded = [r for r in rows if r["embedding"] and len(r["embedding"]) == want]
    if not embedded or not embeddings.is_ready():
        kw = _keyword_rank(query, rows, k)
        return [_out(r) for r in (kw or rows[:k])]

    import numpy as np

    mat = np.frombuffer(
        b"".join(r["embedding"] for r in embedded), dtype=np.float32
    ).reshape(len(embedded), embeddings.DIM)
    qv = embeddings.embed_query(query)
    qn = qv / (np.linalg.norm(qv) + 1e-9)
    sims = (mat / (np.linalg.norm(mat, axis=1, keepdims=True) + 1e-9)) @ qn
    order = np.argsort(-sims)[:k]
    return [_out(embedded[int(i)]) for i in order]


def _snippet(text: str, max_chars: int = 300) -> str:
    t = (text or "").strip()
    return t if len(t) <= max_chars else t[: max_chars - 1].rstrip() + "…"


def _keyword_rank(query: str, rows: list[sqlite3.Row], k: int) -> list[sqlite3.Row]:
    """Keyword recall over chunk text using the shared CJK tokenizer; empty when
    nothing matches so the caller can decide on a fallback."""
    from . import knowledge_search

    terms = knowledge_search.keywords(query)
    if not terms:
        return []
    scored = [(r, knowledge_search._hit_count(f"{r['text']} {r['title']}", terms)) for r in rows]
    return [r for r, s in sorted(scored, key=lambda x: x[1], reverse=True) if s > 0][:k]
