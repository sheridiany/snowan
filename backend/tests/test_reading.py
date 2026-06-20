"""Reading pipeline + DAO behavior on a tmp SNOWAN_HOME, no network. feedparser is
fed a literal RSS document; httpx (reading._fetch) is stubbed so nothing dials out."""
import pytest

from snowan import config, reading

# A 2-entry RSS feed with full-text bodies (>600 chars) so the extract step never
# needs to fetch the article page — keeps the test fully offline.
_BODY = "段落内容。" * 200  # long enough that _extract uses it directly, no page fetch
RSS = f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <link>https://example.com</link>
    <description>A test feed</description>
    <item>
      <title>Python release notes</title>
      <link>https://example.com/python</link>
      <guid>https://example.com/python</guid>
      <pubDate>Wed, 02 Oct 2024 13:00:00 GMT</pubDate>
      <description><![CDATA[<p>Python 3.13 ships. {_BODY}</p>]]></description>
    </item>
    <item>
      <title>Rust async update</title>
      <link>https://example.com/rust</link>
      <guid>https://example.com/rust</guid>
      <pubDate>Tue, 01 Oct 2024 09:00:00 GMT</pubDate>
      <description><![CDATA[<p>Rust async story. {_BODY}</p>]]></description>
    </item>
  </channel>
</rss>"""


@pytest.fixture
def home(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "SNOWAN_HOME", tmp_path)
    # No network: any _fetch hit (e.g. a thin-body article page) returns nothing.
    monkeypatch.setattr(
        reading, "_fetch",
        lambda *a, **k: {"status": 0, "body": "", "etag": None, "last_modified": None, "error": "blocked"},
    )
    return tmp_path


def _seed_feed(conn_title="Test Feed"):
    """Insert a feed row + ingest the RSS fixture; return the feed id."""
    conn = reading._conn()
    try:
        cur = conn.execute(
            "INSERT INTO feeds(feed_url, title, created_at) VALUES(?,?,?)",
            ("https://example.com/feed.xml", conn_title, reading._now()),
        )
        feed_id = cur.lastrowid
        conn.commit()
    finally:
        conn.close()
    reading._ingest(feed_id, RSS)
    return feed_id


# --- parse -----------------------------------------------------------------

def test_parse_rss_fixture():
    parsed = reading.parse_feed(RSS)
    assert parsed.feed.get("title") == "Test Feed"
    assert len(parsed.entries) == 2
    assert parsed.entries[0].get("link") == "https://example.com/python"


def test_clamp_future_date():
    import time
    from datetime import datetime, timedelta, timezone

    far_future = (datetime.now(timezone.utc) + timedelta(days=365)).timetuple()
    clamped = reading._clamp_date(time.struct_time(far_future))
    parsed = datetime.fromisoformat(clamped.replace("Z", "+00:00"))
    # Clamped to now + ~24h, never a year out.
    assert parsed < datetime.now(timezone.utc) + timedelta(hours=25)


def test_ingest_stores_articles(home):
    feed_id = _seed_feed()
    arts = reading.list_articles(feed_id=feed_id)
    assert len(arts) == 2
    titles = {a["title"] for a in arts}
    assert titles == {"Python release notes", "Rust async update"}
    # Date sort DESC: Oct 02 before Oct 01.
    assert arts[0]["title"] == "Python release notes"


def test_ingest_dedups_on_guid(home):
    feed_id = _seed_feed()
    new = reading._ingest(feed_id, RSS)  # re-ingest same feed
    assert new == 0
    assert len(reading.list_articles(feed_id=feed_id)) == 2


# --- sanitize --------------------------------------------------------------

def test_sanitize_strips_script():
    hostile = '<p onclick="evil()">Hi</p><script>alert(1)</script><img src=x onerror=alert(1)>'
    clean = reading.sanitize_html(hostile)
    assert "<script>" not in clean
    assert "alert(1)" not in clean
    assert "onclick" not in clean
    assert "onerror" not in clean
    assert "Hi" in clean


def test_sanitize_hardens_links():
    clean = reading.sanitize_html('<a href="https://x.com">link</a>')
    assert "nofollow" in clean
    assert "noopener" in clean


def test_stored_html_is_sanitized(home):
    """A hostile entry body must be neutralized before it reaches the DB."""
    feed_id = _seed_feed()
    conn = reading._conn()
    try:
        conn.execute(
            """INSERT INTO articles(id, feed_id, guid, url, title, content_html,
                   extracted_html, body_text, fetched_at)
               VALUES(?,?,?,?,?,?,?,?,?)""",
            ("art_hostile", feed_id, "g-hostile", "https://example.com/x", "Hostile",
             reading.sanitize_html("<script>steal()</script><p>safe</p>"),
             reading.sanitize_html("<p>safe</p>"), "safe", reading._now()),
        )
        conn.commit()
    finally:
        conn.close()
    art = reading.get_article("art_hostile")
    assert "<script>" not in art["content_html"]
    assert "safe" in art["content_html"]


# --- FTS roundtrip ---------------------------------------------------------

def test_fts_search_roundtrip(home):
    feed_id = _seed_feed()
    py = reading.list_articles(feed_id=feed_id, q="python")
    assert len(py) == 1
    assert py[0]["title"] == "Python release notes"

    rust = reading.list_articles(feed_id=feed_id, q="rust")
    assert len(rust) == 1
    assert rust[0]["title"] == "Rust async update"

    none = reading.list_articles(feed_id=feed_id, q="kubernetes")
    assert none == []


def test_retrieve_keyword_leg(home):
    _seed_feed()
    hits = reading.retrieve("python release", k=6)
    assert hits, "keyword RAG leg should recall the python article"
    assert any(h["title"] == "Python release notes" for h in hits)


# --- smart views -----------------------------------------------------------

def test_smart_view_filtering(home):
    feed_id = _seed_feed()
    arts = reading.list_articles(feed_id=feed_id)
    py_id = next(a["id"] for a in arts if a["title"] == "Python release notes")
    rust_id = next(a["id"] for a in arts if a["title"] == "Rust async update")

    # Everything starts unread, unstarred, not-later.
    assert len(reading.list_articles(view="unread")) == 2
    assert reading.list_articles(view="starred") == []
    assert reading.list_articles(view="later") == []

    reading.update_article(py_id, is_read=True)
    reading.update_article(rust_id, is_starred=True, read_later=True)

    unread = reading.list_articles(view="unread")
    assert [a["id"] for a in unread] == [rust_id]

    starred = reading.list_articles(view="starred")
    assert [a["id"] for a in starred] == [rust_id]
    assert starred[0]["is_starred"] is True

    later = reading.list_articles(view="later")
    assert [a["id"] for a in later] == [rust_id]

    assert len(reading.list_articles(view="all")) == 2


def test_delete_feed_cascades(home):
    feed_id = _seed_feed()
    assert len(reading.list_articles()) == 2
    assert reading.delete_feed(feed_id) is True
    assert reading.list_articles() == []
    assert reading.list_feeds() == []


# A feed whose item has no <title>: the article row falls back to '(无标题)', and the
# FTS row must be indexed under that SAME value so a later contentless-fts5 'delete'
# replays the exact inserted columns. A '' vs '(无标题)' mismatch corrupts the index.
RSS_NO_TITLE = f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Titleless Feed</title>
    <link>https://example.com</link>
    <item>
      <link>https://example.com/untitled</link>
      <guid>https://example.com/untitled</guid>
      <pubDate>Wed, 02 Oct 2024 13:00:00 GMT</pubDate>
      <description><![CDATA[<p>No title here. {_BODY}</p>]]></description>
    </item>
  </channel>
</rss>"""


def test_delete_feed_with_titleless_entry_keeps_fts_intact(home):
    """Regression: a titleless entry stored as '(无标题)' but FTS-indexed as '' used to
    corrupt the contentless fts5 index on delete (the 'delete' command replays stored
    column values, so they must match what was inserted)."""
    conn = reading._conn()
    try:
        cur = conn.execute(
            "INSERT INTO feeds(feed_url, title, created_at) VALUES(?,?,?)",
            ("https://example.com/untitled.xml", "Titleless Feed", reading._now()),
        )
        feed_id = cur.lastrowid
        conn.commit()
    finally:
        conn.close()
    reading._ingest(feed_id, RSS_NO_TITLE)

    arts = reading.list_articles(feed_id=feed_id)
    assert len(arts) == 1
    assert arts[0]["title"] == "(无标题)"

    assert reading.delete_feed(feed_id) is True

    # The index must still be queryable and pass an integrity check after the delete.
    conn = reading._conn()
    try:
        conn.execute("SELECT rowid FROM articles_fts WHERE articles_fts MATCH ?", ('"title"',)).fetchall()
        conn.execute("INSERT INTO articles_fts(articles_fts) VALUES('integrity-check')")
    finally:
        conn.close()


def test_list_item_exposes_feed_title(home):
    """The middle-column source label needs feed_title from the list endpoint, not just
    from the full-article endpoint."""
    feed_id = _seed_feed(conn_title="Named Feed")
    arts = reading.list_articles(feed_id=feed_id)
    assert arts
    assert all(a["feed_title"] == "Named Feed" for a in arts)
    # A saved (feed_id NULL) row carries no feed name.
    conn = reading._conn()
    try:
        conn.execute(
            """INSERT INTO articles(id, feed_id, guid, url, title, body_text, fetched_at)
               VALUES(?,?,?,?,?,?,?)""",
            ("art_saved", None, "g-saved", "https://example.com/saved", "Saved", "x", reading._now()),
        )
        conn.commit()
    finally:
        conn.close()
    saved = next(a for a in reading.list_articles() if a["id"] == "art_saved")
    assert saved["feed_title"] is None


def test_list_feeds_unread_count(home):
    feed_id = _seed_feed()
    feeds = reading.list_feeds()
    assert len(feeds) == 1
    assert feeds[0]["unread_count"] == 2

    arts = reading.list_articles(feed_id=feed_id)
    reading.update_article(arts[0]["id"], is_read=True)
    assert reading.list_feeds()[0]["unread_count"] == 1
