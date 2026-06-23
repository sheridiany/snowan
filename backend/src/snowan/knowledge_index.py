"""Derived search index over knowledge documents: a single SQLite file holding
`documents` + `chunks` (each chunk carrying a local embedding blob). It is fully
rebuildable from the note vault, so it is NEVER the source of truth. A document
is any source (`source_type`); notes are the first kind, files/web/chat can reuse
the same tables later. Hybrid retrieval lives in knowledge_search.

Storage is plain SQLite + brute-force scoring, which is correct and instant at
single-user scale; FTS5(BM25) / sqlite-vec are the drop-in scale-up path."""
import hashlib
import re
import sqlite3

from . import embeddings
from .config import SNOWAN_HOME

DB_PATH = SNOWAN_HOME / "knowledge" / "index.db"
_CHUNK_CHARS = 600  # notes are short, so this rarely splits a note

# Bumped on every write so knowledge_search can cache the stacked, unit-normalized
# embedding matrix across queries and invalidate it the instant chunks change.
_version = 0


def version() -> int:
    return _version


def _bump() -> None:
    global _version
    _version += 1


def _conn() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=15)
    conn.row_factory = sqlite3.Row
    # WAL so a background folder reindex doesn't block a concurrent search read, and a
    # busy_timeout so the startup sync / download re-embed retry instead of erroring.
    conn.execute("PRAGMA busy_timeout=15000")
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS documents(
            id TEXT PRIMARY KEY, source_type TEXT, title TEXT, uri TEXT,
            created_at TEXT, updated_at TEXT, content_hash TEXT, model TEXT
        );
        CREATE TABLE IF NOT EXISTS chunks(
            id INTEGER PRIMARY KEY,
            document_id TEXT NOT NULL, ordinal INTEGER, heading TEXT,
            text TEXT, embedding BLOB
        );
        CREATE INDEX IF NOT EXISTS idx_chunks_doc ON chunks(document_id);
        """
    )
    return conn


def _hash(title: str, body: str) -> str:
    return hashlib.sha256(f"{title}\n\n{body}".encode()).hexdigest()


def _split(title: str, body: str, markdown: bool = True) -> list[tuple[str, str]]:
    """(heading, text) chunks — markdown-heading-aware, size-capped. The heading
    defaults to the note title so every chunk can name its own source. Heading
    splitting is OFF for non-markdown sources, else every `#` comment line in an
    indexed source file would wrongly start a new chunk."""
    heading = title
    blocks: list[tuple[str, str]] = []
    buf: list[str] = []

    def flush() -> None:
        text = "\n".join(buf).strip()
        if text:
            blocks.append((heading, text))
        buf.clear()

    for line in body.splitlines():
        m = re.match(r"^#{1,6}\s+(.*)", line) if markdown else None
        if m:
            flush()
            heading = m.group(1).strip() or title
            continue
        buf.append(line)
        if sum(len(x) for x in buf) >= _CHUNK_CHARS:
            flush()
    flush()
    if not blocks and body.strip():
        blocks = [(title, body.strip())]
    return blocks


def index_document(doc: dict) -> None:
    """Insert/refresh one document's chunks. No-op when content + model unchanged.
    If the embedding model isn't downloaded yet, chunks are stored WITHOUT vectors
    (still keyword-searchable) and tagged model="" so they re-embed once it lands —
    indexing never triggers the model download."""
    ready = embeddings.is_ready()
    desired_model = embeddings.MODEL_ID if ready else ""
    h = _hash(doc["title"], doc.get("body", ""))
    conn = _conn()
    try:
        row = conn.execute(
            "SELECT content_hash, model FROM documents WHERE id=?", (doc["id"],)
        ).fetchone()
        if row and row["content_hash"] == h and row["model"] == desired_model:
            return
        uri = (doc.get("uri") or "").lower()
        is_md = doc.get("source_type", "note") == "note" or uri.endswith((".md", ".markdown"))
        chunks = _split(doc["title"], doc.get("body", ""), markdown=is_md)
        # Embed with title + heading as lightweight context for better recall.
        vectors: list[bytes | None] = [None] * len(chunks)
        if ready and chunks:
            try:
                vectors = embeddings.embed_passages(
                    [f"{doc['title']} / {hd}\n{tx}" for hd, tx in chunks]
                )
            except Exception:  # noqa: BLE001 — model files incomplete (is_ready raced a
                # download): keyword-index now with model="" so reconcile re-embeds later,
                # instead of 500-ing the create/update request.
                vectors = [None] * len(chunks)
                desired_model = ""
        conn.execute("DELETE FROM chunks WHERE document_id=?", (doc["id"],))
        conn.execute(
            """INSERT INTO documents(id, source_type, title, uri, created_at, updated_at, content_hash, model)
               VALUES(:id,:source_type,:title,:uri,:created_at,:updated_at,:hash,:model)
               ON CONFLICT(id) DO UPDATE SET
                 source_type=excluded.source_type, title=excluded.title, uri=excluded.uri,
                 created_at=excluded.created_at, updated_at=excluded.updated_at,
                 content_hash=excluded.content_hash, model=excluded.model""",
            {
                "id": doc["id"],
                "source_type": doc.get("source_type", "note"),
                "title": doc["title"],
                "uri": doc.get("uri"),
                "created_at": doc.get("created_at", ""),
                "updated_at": doc.get("updated_at", ""),
                "hash": h,
                "model": desired_model,
            },
        )
        conn.executemany(
            "INSERT INTO chunks(document_id, ordinal, heading, text, embedding) VALUES(?,?,?,?,?)",
            [(doc["id"], i, hd, tx, vectors[i]) for i, (hd, tx) in enumerate(chunks)],
        )
        conn.commit()
        _bump()
    finally:
        conn.close()


def remove_document(doc_id: str) -> None:
    conn = _conn()
    try:
        conn.execute("DELETE FROM chunks WHERE document_id=?", (doc_id,))
        conn.execute("DELETE FROM documents WHERE id=?", (doc_id,))
        conn.commit()
        _bump()
    finally:
        conn.close()


def reconcile(source_type: str, docs: list[dict]) -> None:
    """Reconcile ONE source type: (re)index its docs (hash-guarded) and drop any
    document of THAT type whose id is gone — so notes and files (and later web /
    chat sources) never prune each other from the shared index."""
    for d in docs:
        index_document(d)
    keep = {d["id"] for d in docs}
    conn = _conn()
    try:
        existing = [
            r["id"]
            for r in conn.execute(
                "SELECT id FROM documents WHERE source_type=?", (source_type,)
            )
        ]
    finally:
        conn.close()
    for did in existing:
        if did not in keep:
            remove_document(did)


def file_docs() -> list[sqlite3.Row]:
    """(id, uri) of indexed file documents — for per-folder counts."""
    conn = _conn()
    try:
        return conn.execute("SELECT id, uri FROM documents WHERE source_type='file'").fetchall()
    finally:
        conn.close()


def all_chunks() -> list[sqlite3.Row]:
    conn = _conn()
    try:
        # All chunks (embedding may be NULL until the model is downloaded); the
        # keyword leg works on every row, the vector leg only on embedded rows.
        return conn.execute(
            """SELECT c.id, c.document_id, c.heading, c.text, c.embedding,
                      d.title, d.updated_at, d.source_type
               FROM chunks c JOIN documents d ON d.id = c.document_id"""
        ).fetchall()
    finally:
        conn.close()
