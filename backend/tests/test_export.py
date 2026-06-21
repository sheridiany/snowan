"""HTTP-layer export tests for notes (md/html/docx) and reading articles (html).
A tmp SNOWAN_HOME isolates the vault + reading.db; no network. The knowledge/
reading modules bind their paths at import, so patch those module globals too."""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from snowan import config, knowledge, reading
from snowan.server.knowledge import router as knowledge_router
from snowan.server.reading import router as reading_router


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "SNOWAN_HOME", tmp_path)
    monkeypatch.setattr(knowledge, "KNOWLEDGE_DIR", tmp_path / "knowledge")
    monkeypatch.setattr(knowledge, "VAULT", tmp_path / "knowledge" / "notes")
    monkeypatch.setattr(knowledge, "_LEGACY_JSON", tmp_path / "knowledge" / "notes.json")
    app = FastAPI()
    app.include_router(knowledge_router)
    app.include_router(reading_router)
    return TestClient(app)


_NOTE_MD = "# 标题\n\n这是 **粗体** 和 *斜体*。\n\n- 项一\n- 项二\n\n```py\nprint(1)\n```"


def _make_note(client) -> str:
    r = client.post("/api/knowledge/notes", json={"body": _NOTE_MD, "title": "我的笔记"})
    assert r.status_code == 200
    return r.json()["id"]


def test_export_note_markdown(client):
    nid = _make_note(client)
    r = client.get(f"/api/knowledge/notes/{nid}/export", params={"format": "md"})
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/markdown")
    assert "attachment" in r.headers["content-disposition"]
    # Raw body, no YAML frontmatter.
    assert r.text.strip() == _NOTE_MD
    assert not r.text.startswith("---")


def test_export_note_html(client):
    nid = _make_note(client)
    r = client.get(f"/api/knowledge/notes/{nid}/export", params={"format": "html"})
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/html")
    assert "我的笔记" in r.text  # note title in <title>/<h1>
    assert "<strong>" in r.text and "<li>" in r.text


def test_export_note_docx(client):
    nid = _make_note(client)
    r = client.get(f"/api/knowledge/notes/{nid}/export", params={"format": "docx"})
    assert r.status_code == 200
    assert "wordprocessingml" in r.headers["content-type"]
    assert r.content[:2] == b"PK"  # docx is a zip
    assert len(r.content) > 0


def test_export_note_bad_format(client):
    nid = _make_note(client)
    assert client.get(f"/api/knowledge/notes/{nid}/export", params={"format": "pdf"}).status_code == 422


def test_export_note_missing(client):
    assert client.get("/api/knowledge/notes/nope/export", params={"format": "md"}).status_code == 404


def test_export_article_html(client, tmp_path):
    conn = reading._conn()
    try:
        conn.execute(
            """INSERT INTO articles(id, feed_id, guid, url, title, content_html,
                   extracted_html, body_text, fetched_at)
               VALUES(?,?,?,?,?,?,?,?,?)""",
            ("art1", None, "g1", "https://x/a", "文章标题",
             reading.sanitize_html("<p>正文</p>"),
             reading.sanitize_html("<p>正文 <strong>粗</strong></p>"),
             "正文", reading._now()),
        )
        conn.commit()
    finally:
        conn.close()
    r = client.get("/api/reading/articles/art1/export")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/html")
    assert "文章标题" in r.text and "<strong>" in r.text
