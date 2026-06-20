"""Reading (阅读) pipeline + SQLite DAO over ~/.snowan/reading.db.

Mirrors the knowledge_index conventions (WAL SQLite, derived/rebuildable, local
embeddings gated on is_ready). The pipeline is discover -> fetch (conditional GET)
-> parse (feedparser) -> extract (trafilatura) -> sanitize (nh3) -> store -> index.
One bad feed must never break a whole refresh, so per-feed fetch/parse errors are
captured on the feed row, not raised.

The DB path is resolved via config.SNOWAN_HOME on every connection so tests can
monkeypatch it."""
import hashlib
import sqlite3
import uuid
from datetime import datetime, timedelta, timezone

import nh3

from . import config, embeddings, knowledge_search

# nh3 chokepoint config — every body (feed HTML, extracted HTML, translated HTML)
# passes through clean() with link rel hardening before it is stored or rendered.
_ALLOWED_TAGS = nh3.ALLOWED_TAGS | {
    "figure", "figcaption", "h1", "h2", "h3", "h4", "h5", "h6", "pre", "hr", "span",
}
_LINK_REL = "noopener noreferrer nofollow"
_MAX_BODY_BYTES = 5 * 1024 * 1024  # cap a fetched feed/article body
_MAX_ENTRIES = 50  # ingest only the most-recent N per feed (some feeds ship 1000+)
_FUTURE_SLACK = timedelta(hours=24)  # clamp absurd future dates to now+24h
_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def sanitize_html(html: str | None) -> str:
    """The single sanitize chokepoint. Strips script/style/event handlers and adds
    rel="noopener noreferrer nofollow" to every link."""
    if not html:
        return ""
    return nh3.clean(html, tags=_ALLOWED_TAGS, link_rel=_LINK_REL)


# --- DB --------------------------------------------------------------------

def _db_path():
    return config.SNOWAN_HOME / "reading.db"


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
        CREATE TABLE IF NOT EXISTS feeds(
          id INTEGER PRIMARY KEY, feed_url TEXT UNIQUE NOT NULL, site_url TEXT,
          title TEXT, description TEXT, favicon_url TEXT, etag TEXT, last_modified TEXT,
          last_fetched_at TEXT, fetch_error TEXT, created_at TEXT NOT NULL);

        CREATE TABLE IF NOT EXISTS articles(
          id TEXT PRIMARY KEY,
          feed_id INTEGER REFERENCES feeds(id) ON DELETE CASCADE,
          guid TEXT, url TEXT, title TEXT, author TEXT, summary TEXT,
          content_html TEXT, extracted_html TEXT, body_text TEXT, image_url TEXT,
          ai_summary TEXT, translated_html TEXT, translated_lang TEXT,
          published_at TEXT, fetched_at TEXT NOT NULL,
          is_read INTEGER NOT NULL DEFAULT 0, is_starred INTEGER NOT NULL DEFAULT 0,
          read_later INTEGER NOT NULL DEFAULT 0,
          note_id TEXT,
          UNIQUE(feed_id, guid));

        CREATE VIRTUAL TABLE IF NOT EXISTS articles_fts USING fts5(
          title, body, content='', tokenize='porter unicode61');

        CREATE TABLE IF NOT EXISTS article_embeddings(
          article_id TEXT PRIMARY KEY REFERENCES articles(id) ON DELETE CASCADE,
          vector BLOB NOT NULL);

        CREATE INDEX IF NOT EXISTS idx_articles_feed ON articles(feed_id);
        CREATE INDEX IF NOT EXISTS idx_articles_unread ON articles(id) WHERE is_read=0;
        CREATE INDEX IF NOT EXISTS idx_articles_starred ON articles(id) WHERE is_starred=1;
        CREATE INDEX IF NOT EXISTS idx_articles_later ON articles(id) WHERE read_later=1;
        CREATE INDEX IF NOT EXISTS idx_articles_sort
          ON articles(datetime(COALESCE(published_at, fetched_at)));
        """
    )
    return conn


# --- fetch -----------------------------------------------------------------

def _fetch(url: str, *, etag: str | None = None, last_modified: str | None = None) -> dict:
    """Conditional GET. Returns {status, body, etag, last_modified, error}. Never
    raises — a transport error is reported as error so the caller can record it on
    the feed and move on."""
    import httpx

    headers = {"User-Agent": _UA}
    if etag:
        headers["If-None-Match"] = etag
    if last_modified:
        headers["If-Modified-Since"] = last_modified
    try:
        with httpx.Client(follow_redirects=True, timeout=20) as client:
            resp = client.get(url, headers=headers)
    except Exception as e:  # noqa: BLE001 — network boundary; one bad feed must not raise
        return {"status": 0, "body": "", "etag": None, "last_modified": None, "error": str(e)[:300]}
    if resp.status_code == 304:
        return {"status": 304, "body": "", "etag": etag, "last_modified": last_modified, "error": None}
    if resp.status_code >= 400:
        return {"status": resp.status_code, "body": "", "etag": None, "last_modified": None,
                "error": f"HTTP {resp.status_code}"}
    body = resp.text[:_MAX_BODY_BYTES]
    return {
        "status": resp.status_code,
        "body": body,
        "etag": resp.headers.get("ETag"),
        "last_modified": resp.headers.get("Last-Modified"),
        "error": None,
    }


# --- parse -----------------------------------------------------------------

def _clamp_date(dt_struct) -> str | None:
    """feedparser time.struct_time (UTC) -> ISO string, future dates clamped to now+24h."""
    if not dt_struct:
        return None
    try:
        dt = datetime(*dt_struct[:6], tzinfo=timezone.utc)
    except (ValueError, TypeError):
        return None
    ceiling = datetime.now(timezone.utc) + _FUTURE_SLACK
    if dt > ceiling:
        dt = ceiling
    return dt.isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _entry_content_html(entry) -> str:
    """Best feed-supplied HTML body: full content, else summary."""
    contents = entry.get("content") or []
    if contents and contents[0].get("value"):
        return contents[0]["value"]
    return entry.get("summary", "") or ""


def _entry_image(entry, content_html: str) -> str | None:
    """media thumbnail -> media content -> first <img> in the body."""
    for thumb in entry.get("media_thumbnail") or []:
        if thumb.get("url"):
            return thumb["url"]
    for media in entry.get("media_content") or []:
        if media.get("url") and (media.get("medium") in (None, "image") or "image" in (media.get("type") or "")):
            return media["url"]
    import re

    m = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', content_html)
    return m.group(1) if m else None


def _cap_feed_body(raw: str, n: int = _MAX_ENTRIES + 10) -> str:
    """Truncate the feed XML after the n-th item/entry so feedparser doesn't chew
    through pathological feeds (e.g. OpenAI ships 1000+ entries / 600KB). Caps by
    ENTRY COUNT, not bytes, so full-content feeds with large entries are unaffected.
    Returns raw unchanged when the feed has <= n entries."""
    lower = raw.lower()
    close = "</item>" if lower.count("</item>") >= lower.count("</entry>") else "</entry>"
    idx = 0
    for _ in range(n):
        j = lower.find(close, idx)
        if j == -1:
            return raw  # fewer than n entries — nothing to cap
        idx = j + len(close)
    truncated = raw[:idx]
    return truncated + ("</channel></rss>" if close == "</item>" else "</feed>")


def parse_feed(raw: str):
    """feedparser over a literal feed document (capped to recent entries). No network."""
    import feedparser

    return feedparser.parse(_cap_feed_body(raw))


# --- extract ---------------------------------------------------------------

def _extract(content_html: str, url: str | None, *, allow_fetch: bool = True) -> tuple[str, str]:
    """(extracted_html, body_text) via trafilatura. If the feed body is thin and a
    url is known, fetch the article page and extract from that (only when
    allow_fetch — bulk ingest skips it to stay fast). Falls back to the feed body's
    text when extraction yields nothing."""
    import trafilatura

    source_html = content_html
    # A summary-only feed: the body is too short to be the real article, so go fetch it.
    if allow_fetch and url and len(_text_of(content_html)) < 600:
        fetched = _fetch(url)
        if fetched["status"] == 200 and fetched["body"]:
            source_html = fetched["body"]

    extracted_html = ""
    body_text = ""
    if source_html:
        try:
            extracted_html = trafilatura.extract(
                source_html, url=url, output_format="html",
                include_comments=False, include_tables=True, favor_recall=True,
            ) or ""
            body_text = trafilatura.extract(
                source_html, url=url, output_format="txt",
                include_comments=False, include_tables=True, favor_recall=True,
            ) or ""
        except Exception:  # noqa: BLE001 — malformed HTML: fall back to the feed text
            extracted_html, body_text = "", ""

    if not body_text:
        body_text = _text_of(content_html)
    if not extracted_html:
        extracted_html = content_html
    return extracted_html, body_text


def _text_of(html: str) -> str:
    """Plain text of an HTML fragment — nh3 strips tags, then collapse whitespace."""
    import re

    if not html:
        return ""
    stripped = nh3.clean(html, tags=set())
    return re.sub(r"\s+", " ", stripped).strip()


# --- index -----------------------------------------------------------------

def _fts_rowid(conn: sqlite3.Connection, article_id: str) -> int:
    """Stable positive rowid for an article in the contentless FTS table, derived
    from its id so delete-then-reinsert hits the same row."""
    return int(hashlib.sha1(article_id.encode()).hexdigest()[:15], 16)


def _index_article(conn: sqlite3.Connection, article_id: str, title: str, body_text: str) -> None:
    """Index a NEWLY ingested article. Articles are immutable after ingest (body never
    changes), so this only ever inserts — the contentless FTS row is removed by
    delete_feed using the stored values, the only place a row needs un-indexing."""
    conn.execute(
        "INSERT INTO articles_fts(rowid, title, body) VALUES(?, ?, ?)",
        (_fts_rowid(conn, article_id), title, body_text),
    )
    if embeddings.is_ready() and body_text.strip():
        try:
            vector = embeddings.embed_passages([f"{title}\n{body_text[:2000]}"])[0]
            conn.execute(
                "INSERT INTO article_embeddings(article_id, vector) VALUES(?, ?) "
                "ON CONFLICT(article_id) DO UPDATE SET vector=excluded.vector",
                (article_id, vector),
            )
        except Exception:  # noqa: BLE001 — model files raced a download: keyword-only
            pass


def _fts_match(terms: list[str], join: str) -> str:
    """Build an FTS5 MATCH expression from keyword terms (quoted, OR/AND joined)."""
    quoted = [f'"{t}"' for t in terms]
    return f" {join} ".join(quoted)


# --- feed DAO --------------------------------------------------------------

def _feed_row(conn: sqlite3.Connection, row: sqlite3.Row) -> dict:
    unread = conn.execute(
        "SELECT COUNT(*) FROM articles WHERE feed_id=? AND is_read=0", (row["id"],)
    ).fetchone()[0]
    return {
        "id": row["id"],
        "feed_url": row["feed_url"],
        "site_url": row["site_url"],
        "title": row["title"] or row["feed_url"],
        "description": row["description"],
        "favicon_url": row["favicon_url"],
        "last_fetched_at": row["last_fetched_at"],
        "fetch_error": row["fetch_error"],
        "unread_count": unread,
    }


def list_feeds() -> list[dict]:
    conn = _conn()
    try:
        rows = conn.execute("SELECT * FROM feeds ORDER BY created_at").fetchall()
        return [_feed_row(conn, r) for r in rows]
    finally:
        conn.close()


def _discover_feed_url(url: str) -> tuple[str, str]:
    """Given any URL, return (feed_url, body). If the page is HTML with a
    <link rel=alternate type=...rss/atom...>, follow it; otherwise treat url as the feed."""
    import re

    fetched = _fetch(url)
    body = fetched["body"]
    if not body:
        return url, ""
    # Already a feed document?
    head = body[:1000].lower()
    if "<rss" in head or "<feed" in head or "<rdf" in head:
        return url, body
    # HTML page: look for an alternate feed link.
    m = re.search(
        r'<link[^>]+rel=["\']alternate["\'][^>]*type=["\']application/(?:rss|atom)\+xml["\'][^>]*>',
        body, re.IGNORECASE,
    ) or re.search(
        r'<link[^>]+type=["\']application/(?:rss|atom)\+xml["\'][^>]*rel=["\']alternate["\'][^>]*>',
        body, re.IGNORECASE,
    )
    if m:
        href = re.search(r'href=["\']([^"\']+)["\']', m.group(0))
        if href:
            from urllib.parse import urljoin

            feed_url = urljoin(url, href.group(1))
            f2 = _fetch(feed_url)
            return feed_url, f2["body"]
    return url, body


def add_feed(url: str) -> dict:
    """Discover, subscribe, and do an initial fetch+ingest. Raises ValueError on a
    URL that yields no parseable feed (so the router can 400)."""
    feed_url, body = _discover_feed_url(url)
    conn = _conn()
    try:
        existing = conn.execute("SELECT * FROM feeds WHERE feed_url=?", (feed_url,)).fetchone()
        if existing:
            return _feed_row(conn, existing)
        if not body:
            raise ValueError("无法抓取该地址")
        parsed = parse_feed(body)
        if parsed.bozo and not parsed.entries and not parsed.feed.get("title"):
            raise ValueError("该地址不是有效的 RSS/Atom 源")
        meta = parsed.feed
        cur = conn.execute(
            """INSERT INTO feeds(feed_url, site_url, title, description, created_at)
               VALUES(?,?,?,?,?)""",
            (feed_url, meta.get("link"), meta.get("title") or feed_url,
             meta.get("subtitle") or meta.get("description"), _now()),
        )
        feed_id = cur.lastrowid
        conn.commit()
    finally:
        conn.close()
    _ingest(feed_id, body)
    conn = _conn()
    try:
        row = conn.execute("SELECT * FROM feeds WHERE id=?", (feed_id,)).fetchone()
        return _feed_row(conn, row)
    finally:
        conn.close()


def rename_feed(feed_id: int, title: str) -> dict | None:
    conn = _conn()
    try:
        cur = conn.execute("UPDATE feeds SET title=? WHERE id=?", (title.strip() or None, feed_id))
        conn.commit()
        if cur.rowcount == 0:
            return None
        row = conn.execute("SELECT * FROM feeds WHERE id=?", (feed_id,)).fetchone()
        return _feed_row(conn, row)
    finally:
        conn.close()


def delete_feed(feed_id: int) -> bool:
    conn = _conn()
    try:
        rows = conn.execute(
            "SELECT id, title, body_text FROM articles WHERE feed_id=?", (feed_id,)
        ).fetchall()
        for r in rows:
            conn.execute(
                "INSERT INTO articles_fts(articles_fts, rowid, title, body) VALUES('delete', ?, ?, ?)",
                (_fts_rowid(conn, r["id"]), r["title"] or "", r["body_text"] or ""),
            )
        cur = conn.execute("DELETE FROM feeds WHERE id=?", (feed_id,))
        conn.commit()
        return cur.rowcount > 0
    finally:
        conn.close()


# --- ingest / refresh ------------------------------------------------------

def _ingest(feed_id: int, body: str) -> int:
    """Parse a feed body and upsert its entries. Returns the count of NEW articles."""
    parsed = parse_feed(body)

    # Which guids are already stored (a cheap read on its own connection).
    conn = _conn()
    try:
        existing = {
            r["guid"]
            for r in conn.execute(
                "SELECT guid FROM articles WHERE feed_id=?", (feed_id,)
            ).fetchall()
        }
    finally:
        conn.close()

    # Build the new rows BEFORE opening a write transaction: _extract may fetch the
    # article page over the network, which must not hold a DB write lock open.
    # One `title` value feeds both the articles row and the FTS row — a contentless
    # fts5 'delete' must replay the exact inserted columns, so they stay identical.
    pending: list[tuple] = []
    for entry in parsed.entries[:_MAX_ENTRIES]:
        guid = entry.get("id") or entry.get("link")
        if not guid or guid in existing:
            continue
        existing.add(guid)  # de-dup within this batch too
        content_html = _entry_content_html(entry)
        url = entry.get("link")
        # Bulk ingest is shallow: never fetch the article page here (a 1000-entry,
        # summary-only feed would mean 1000 blocking page fetches). Feeds that ship
        # full content still render fully; summary feeds show the summary + 原文 link.
        extracted_html, body_text = _extract(content_html, url, allow_fetch=False)
        pending.append((
            "art_" + uuid.uuid4().hex, feed_id, guid, url,
            entry.get("title") or "(无标题)",
            entry.get("author"), _text_of(content_html)[:500],
            sanitize_html(content_html), sanitize_html(extracted_html), body_text,
            _entry_image(entry, content_html),
            _clamp_date(entry.get("published_parsed") or entry.get("updated_parsed")),
        ))
    if not pending:
        return 0

    conn = _conn()
    try:
        for row in pending:
            conn.execute(
                """INSERT INTO articles(id, feed_id, guid, url, title, author, summary,
                       content_html, extracted_html, body_text, image_url,
                       published_at, fetched_at)
                   VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (*row, _now()),
            )
            _index_article(conn, row[0], row[4], row[9])  # id, title, body_text
        conn.commit()
        return len(pending)
    finally:
        conn.close()


def refresh_feed(feed_id: int) -> int:
    """Conditional-GET refresh of one feed. Records fetch_error on failure, never
    raises (so a batch refresh keeps going)."""
    conn = _conn()
    try:
        feed = conn.execute("SELECT * FROM feeds WHERE id=?", (feed_id,)).fetchone()
    finally:
        conn.close()
    if feed is None:
        return 0
    fetched = _fetch(feed["feed_url"], etag=feed["etag"], last_modified=feed["last_modified"])
    conn = _conn()
    try:
        if fetched["error"]:
            conn.execute(
                "UPDATE feeds SET fetch_error=?, last_fetched_at=? WHERE id=?",
                (fetched["error"], _now(), feed_id),
            )
            conn.commit()
            return 0
        conn.execute(
            "UPDATE feeds SET etag=?, last_modified=?, last_fetched_at=?, fetch_error=NULL WHERE id=?",
            (fetched["etag"], fetched["last_modified"], _now(), feed_id),
        )
        conn.commit()
    finally:
        conn.close()
    if fetched["status"] == 304 or not fetched["body"]:
        return 0
    return _ingest(feed_id, fetched["body"])


def refresh_all() -> int:
    """Refresh every feed; one bad feed is isolated (its error is recorded, the rest run)."""
    conn = _conn()
    try:
        ids = [r["id"] for r in conn.execute("SELECT id FROM feeds").fetchall()]
    finally:
        conn.close()
    total = 0
    for feed_id in ids:
        try:
            total += refresh_feed(feed_id)
        except Exception:  # noqa: BLE001 — defensive: an unexpected bug on one feed
            pass  # never aborts the whole batch
    return total


# --- saved (paste-URL) article ---------------------------------------------

def add_url_article(url: str) -> dict | None:
    """Fetch + extract + sanitize a single page, store as a saved article (feed_id NULL)."""
    fetched = _fetch(url)
    if fetched["status"] != 200 or not fetched["body"]:
        return None
    html = fetched["body"]
    extracted_html, body_text = _extract(html, url)
    title = _page_title(html) or url
    article_id = "art_" + uuid.uuid4().hex
    conn = _conn()
    try:
        conn.execute(
            """INSERT INTO articles(id, feed_id, guid, url, title, summary,
                   content_html, extracted_html, body_text, fetched_at)
               VALUES(?,?,?,?,?,?,?,?,?,?)""",
            (
                article_id, None, url, url, title, body_text[:500],
                "", sanitize_html(extracted_html), body_text, _now(),
            ),
        )
        _index_article(conn, article_id, title, body_text)
        conn.commit()
        return _article_full(conn, article_id)
    finally:
        conn.close()


def _page_title(html: str) -> str | None:
    import re

    m = re.search(r"<title[^>]*>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
    return re.sub(r"\s+", " ", m.group(1)).strip() if m else None


# --- article queries -------------------------------------------------------

_SORT = "datetime(COALESCE(published_at, fetched_at)) DESC"


def _list_item(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "feed_id": row["feed_id"],
        "feed_title": row["feed_title"],
        "title": row["title"],
        "author": row["author"],
        "summary": row["summary"],
        "image_url": row["image_url"],
        "url": row["url"],
        "published_at": row["published_at"],
        "fetched_at": row["fetched_at"],
        "is_read": bool(row["is_read"]),
        "is_starred": bool(row["is_starred"]),
        "read_later": bool(row["read_later"]),
    }


def list_articles(
    view: str = "all", feed_id: int | None = None, q: str = "",
    limit: int = 50, before: str | None = None,
) -> list[dict]:
    """Smart-view + optional feed filter + optional FTS keyword search, date-sorted.
    `before` paginates on datetime(COALESCE(published_at, fetched_at))."""
    conn = _conn()
    try:
        where = ["1=1"]
        params: list = []
        if view == "unread":
            where.append("a.is_read=0")
        elif view == "starred":
            where.append("a.is_starred=1")
        elif view == "later":
            where.append("a.read_later=1")
        if feed_id is not None:
            where.append("a.feed_id=?")
            params.append(feed_id)
        if before:
            where.append("datetime(COALESCE(a.published_at, a.fetched_at)) < datetime(?)")
            params.append(before)

        if q.strip():
            terms = knowledge_search.keywords(q)
            if not terms:
                return []
            match = _fts_match(terms, "AND")  # explicit search is AND-join
            # The FTS table is contentless, so resolve matched rowids back to articles
            # via the deterministic _fts_rowid mapping, then apply the view filter + sort.
            matched_rowids = {
                r["rowid"] for r in conn.execute(
                    "SELECT rowid FROM articles_fts WHERE articles_fts MATCH ?", (match,)
                ).fetchall()
            }
            all_rows = conn.execute(
                f"SELECT a.*, COALESCE(f.title, f.feed_url) AS feed_title FROM articles a "
                f"LEFT JOIN feeds f ON f.id = a.feed_id WHERE {' AND '.join(where)} "
                f"ORDER BY {_SORT}",
                params,
            ).fetchall()
            out = [
                _list_item(r) for r in all_rows
                if _fts_rowid(conn, r["id"]) in matched_rowids
            ]
            return out[:limit]

        rows = conn.execute(
            f"SELECT a.*, COALESCE(f.title, f.feed_url) AS feed_title FROM articles a "
            f"LEFT JOIN feeds f ON f.id = a.feed_id WHERE {' AND '.join(where)} "
            f"ORDER BY {_SORT} LIMIT ?",
            (*params, limit),
        ).fetchall()
        return [_list_item(r) for r in rows]
    finally:
        conn.close()


def _article_full(conn: sqlite3.Connection, article_id: str) -> dict | None:
    row = conn.execute("SELECT * FROM articles WHERE id=?", (article_id,)).fetchone()
    if row is None:
        return None
    feed_title = None
    if row["feed_id"] is not None:
        fr = conn.execute("SELECT title, feed_url FROM feeds WHERE id=?", (row["feed_id"],)).fetchone()
        if fr:
            feed_title = fr["title"] or fr["feed_url"]
    return {
        "id": row["id"],
        "feed_id": row["feed_id"],
        "feed_title": feed_title,
        "guid": row["guid"],
        "url": row["url"],
        "title": row["title"],
        "author": row["author"],
        "summary": row["summary"],
        "content_html": row["content_html"],
        "extracted_html": row["extracted_html"],
        "image_url": row["image_url"],
        "ai_summary": row["ai_summary"],
        "translated_html": row["translated_html"],
        "translated_lang": row["translated_lang"],
        "published_at": row["published_at"],
        "fetched_at": row["fetched_at"],
        "is_read": bool(row["is_read"]),
        "is_starred": bool(row["is_starred"]),
        "read_later": bool(row["read_later"]),
        "note_id": row["note_id"],
    }


def get_article(article_id: str) -> dict | None:
    conn = _conn()
    try:
        return _article_full(conn, article_id)
    finally:
        conn.close()


def update_article(
    article_id: str, *, is_read: bool | None = None,
    is_starred: bool | None = None, read_later: bool | None = None,
) -> dict | None:
    sets, params = [], []
    if is_read is not None:
        sets.append("is_read=?")
        params.append(int(is_read))
    if is_starred is not None:
        sets.append("is_starred=?")
        params.append(int(is_starred))
    if read_later is not None:
        sets.append("read_later=?")
        params.append(int(read_later))
    conn = _conn()
    try:
        if sets:
            params.append(article_id)
            conn.execute(f"UPDATE articles SET {', '.join(sets)} WHERE id=?", params)
            conn.commit()
        return _article_full(conn, article_id)
    finally:
        conn.close()


def set_article_summary(article_id: str, summary: str) -> None:
    conn = _conn()
    try:
        conn.execute("UPDATE articles SET ai_summary=? WHERE id=?", (summary, article_id))
        conn.commit()
    finally:
        conn.close()


def set_article_translation(article_id: str, html: str, lang: str) -> None:
    conn = _conn()
    try:
        conn.execute(
            "UPDATE articles SET translated_html=?, translated_lang=? WHERE id=?",
            (html, lang, article_id),
        )
        conn.commit()
    finally:
        conn.close()


def set_article_note(article_id: str, note_id: str) -> None:
    conn = _conn()
    try:
        conn.execute("UPDATE articles SET note_id=? WHERE id=?", (note_id, article_id))
        conn.commit()
    finally:
        conn.close()


# --- hybrid RAG retrieval ---------------------------------------------------

def retrieve(question: str, k: int = 6) -> list[dict]:
    """Hybrid recall for ask-your-reading: FTS OR-join keyword leg fused with an
    embedding cosine leg (when the model is ready), top-k articles. Returns
    [{id, title, body_text}]."""
    conn = _conn()
    try:
        terms = knowledge_search.keywords(question)
        kw_ids: list[str] = []
        if terms:
            match = _fts_match(terms, "OR")  # RAG recall is OR-join
            rowids = [
                r["rowid"] for r in conn.execute(
                    "SELECT rowid FROM articles_fts WHERE articles_fts MATCH ? "
                    "ORDER BY rank LIMIT 50",
                    (match,),
                ).fetchall()
            ]
            rows = conn.execute("SELECT id FROM articles").fetchall()
            id_by_rowid = {_fts_rowid(conn, r["id"]): r["id"] for r in rows}
            kw_ids = [id_by_rowid[rid] for rid in rowids if rid in id_by_rowid]

        vec_ids: list[str] = []
        emb_rows = conn.execute(
            "SELECT article_id, vector FROM article_embeddings"
        ).fetchall()
        want = embeddings.DIM * 4
        emb_rows = [r for r in emb_rows if r["vector"] and len(r["vector"]) == want]
        if emb_rows and embeddings.is_ready():
            import numpy as np

            mat = np.frombuffer(
                b"".join(r["vector"] for r in emb_rows), dtype=np.float32
            ).reshape(len(emb_rows), embeddings.DIM)
            qv = embeddings.embed_query(question)
            qn = qv / (np.linalg.norm(qv) + 1e-9)
            sims = (mat / (np.linalg.norm(mat, axis=1, keepdims=True) + 1e-9)) @ qn
            order = np.argsort(-sims)[:50]
            vec_ids = [emb_rows[int(i)]["article_id"] for i in order]

        # Reciprocal Rank Fusion of the two legs.
        fused: dict[str, float] = {}
        for rank, aid in enumerate(kw_ids):
            fused[aid] = fused.get(aid, 0.0) + 1.0 / (60 + rank + 1)
        for rank, aid in enumerate(vec_ids):
            fused[aid] = fused.get(aid, 0.0) + 1.0 / (60 + rank + 1)
        top = sorted(fused, key=fused.get, reverse=True)[:k]
        if not top:
            return []
        placeholders = ",".join("?" * len(top))
        rows = conn.execute(
            f"SELECT id, title, body_text FROM articles WHERE id IN ({placeholders})", top
        ).fetchall()
        by_id = {r["id"]: r for r in rows}
        return [
            {"id": aid, "title": by_id[aid]["title"], "body_text": by_id[aid]["body_text"] or ""}
            for aid in top if aid in by_id
        ]
    finally:
        conn.close()
