"""今天 (daily note) backend on a tmp SNOWAN_HOME, no network. The embedding model
is never downloaded in tests, so index_document stays keyword-only (no model dial-out)
and knowledge_search runs the keyword leg alone."""
import pytest

from snowan import calendar, config, knowledge


@pytest.fixture
def home(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "SNOWAN_HOME", tmp_path)
    return tmp_path


def test_extra_frontmatter_survives_update(home):
    """The _extra pass-through + first-class type keep hand-written frontmatter from
    being dropped on the first update_note (the bug the port fixes)."""
    note = knowledge.create_note("身体\n\n正文", title="带标签的笔记")
    path = next((home / "knowledge" / "notes").glob("*.md"))
    raw = path.read_text(encoding="utf-8")
    # Hand-edit the vault file to add frontmatter the app doesn't model.
    path.write_text(raw.replace("title:", "type: special\ntags:\n  - 重要\ntitle:", 1), encoding="utf-8")

    updated = knowledge.update_note(note["id"], body="改过的正文")
    assert updated is not None
    after = path.read_text(encoding="utf-8")
    assert "type: special" in after
    assert "tags:" in after and "重要" in after
    assert "改过的正文" in after


def test_get_or_create_daily_applies_template_and_bypasses_slug(home):
    note = knowledge.get_or_create_daily("2026-06-21")
    assert note["date"] == "2026-06-21"
    assert note["type"] == "daily"
    assert "今日 Highlight" in note["body"]
    assert "今日重点" in note["body"]

    # Filename IS the date (slug path bypassed), under notes/daily/.
    p = home / "knowledge" / "notes" / "daily" / "2026-06-21.md"
    assert p.exists()
    assert "type: daily" in p.read_text(encoding="utf-8")

    # Find-or-create: a second call returns the same note, doesn't re-template.
    again = knowledge.get_or_create_daily("2026-06-21")
    assert again["id"] == note["id"]


def test_daily_type_survives_save_round_trip(home):
    created = knowledge.get_or_create_daily("2026-06-21")
    knowledge.save_daily("2026-06-21", "## 🎯 今日 Highlight\n写完日记后端\n", created["updated_at"])
    reloaded = knowledge.get_daily("2026-06-21")
    assert reloaded["type"] == "daily"
    assert reloaded["date"] == "2026-06-21"
    assert "写完日记后端" in reloaded["body"]


def test_save_daily_conflict_when_disk_changed(home):
    created = knowledge.get_or_create_daily("2026-06-21")
    knowledge.save_daily("2026-06-21", "first", created["updated_at"])  # bumps updated_at
    with pytest.raises(knowledge.DailyConflict):
        knowledge.save_daily("2026-06-21", "second", created["updated_at"])  # stale base


def test_daily_carryover_extracts_only_unchecked(home):
    knowledge.get_or_create_daily("2026-06-19")
    knowledge.save_daily(
        "2026-06-19",
        "- [ ] 没做完的事\n- [x] 做完的事\n- 一条普通笔记\n- [ ] 还有一件\n",
    )
    items = knowledge.daily_carryover("2026-06-21")
    lines = [i["line"] for i in items]
    assert "- [ ] 没做完的事" in lines
    assert "- [ ] 还有一件" in lines
    assert all("[x]" not in line for line in lines)
    assert all("普通笔记" not in line for line in lines)
    assert all(i["fromDate"] == "2026-06-19" for i in items)


def test_daily_carryover_ignores_today_and_future(home):
    knowledge.get_or_create_daily("2026-06-21")
    knowledge.save_daily("2026-06-21", "- [ ] 今天的待办\n")
    knowledge.get_or_create_daily("2026-06-22")
    knowledge.save_daily("2026-06-22", "- [ ] 明天的待办\n")
    items = knowledge.daily_carryover("2026-06-21")
    assert items == []


def test_list_daily_dates(home):
    knowledge.get_or_create_daily("2026-06-19")
    knowledge.get_or_create_daily("2026-06-21")
    assert knowledge.list_daily_dates() == ["2026-06-21", "2026-06-19"]


def test_daily_assembly_degrades_when_calendar_empty(home, monkeypatch):
    monkeypatch.setattr(calendar, "events_on", lambda date: [])
    out = knowledge.daily_assembly("2026-06-21")
    assert out["events"] == []
    assert out["reading"] == []
    assert out["memory"] == []


def test_daily_assembly_adapts_events(home, monkeypatch):
    monkeypatch.setattr(calendar, "events_on", lambda date: [
        {"id": "e1", "title": "站会", "startsAt": "2026-06-21T01:00:00Z",
         "endsAt": "2026-06-21T01:30:00Z", "location": "线上", "notes": "扔掉"},
        {"title": "没有 id 的坏事件"},  # missing id -> adapter drops it
    ])
    out = knowledge.daily_assembly("2026-06-21")
    assert len(out["events"]) == 1
    e = out["events"][0]
    assert e["id"] == "e1" and e["title"] == "站会" and e["location"] == "线上"
    assert "notes" not in e  # adapter only keeps the band's fields


# A traversal date must never resolve to a .md outside notes/daily/. The filename
# IS the date (§4), so a non-YYYY-MM-DD date is rejected, not sanitized.
_BAD_DATES = ["../../../../tmp/pwn", "2026-06-21/../../../pwn", "2026_06_21", "notadate", ""]


@pytest.mark.parametrize("bad", _BAD_DATES)
def test_daily_path_rejects_traversal(home, bad):
    with pytest.raises(ValueError):
        knowledge._daily_path(bad)


def test_daily_endpoints_reject_traversal_and_write_nothing_outside_vault(home, tmp_path):
    # The arbitrary-file-write primitive: every entry point taking a client date
    # must refuse to touch a path outside the vault.
    for bad in _BAD_DATES:
        with pytest.raises(ValueError):
            knowledge.get_daily(bad)
        with pytest.raises(ValueError):
            knowledge.get_or_create_daily(bad)
        with pytest.raises(ValueError):
            knowledge.save_daily(bad, "pwned body")
        with pytest.raises(ValueError):
            knowledge.daily_assembly(bad)
        with pytest.raises(ValueError):
            knowledge.daily_carryover(bad)

    # Nothing leaked outside notes/daily/: the only .md anywhere is none, and the
    # daily dir holds no rogue file.
    assert list(tmp_path.rglob("*pwn*")) == []
    daily_dir = home / "knowledge" / "notes" / "daily"
    if daily_dir.exists():
        assert all(knowledge._DAILY_RE.match(p.stem) for p in daily_dir.glob("*.md"))


def test_router_returns_422_for_malformed_date(home):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from snowan.server.knowledge import router

    app = FastAPI()
    app.include_router(router)
    client = TestClient(app)

    # Path-encoded traversal is rejected by the route pattern before any handler runs.
    assert client.get("/api/knowledge/daily/2026_06_21").status_code == 422
    assert client.put("/api/knowledge/daily/notadate", json={"body": "x"}).status_code == 422
    assert client.get("/api/knowledge/daily/notadate/assembly").status_code == 422
    assert client.get("/api/knowledge/daily/notadate/carryover").status_code == 422

    # A well-formed date still works end-to-end (find-or-create).
    ok = client.get("/api/knowledge/daily/2026-06-21")
    assert ok.status_code == 200
    assert ok.json()["date"] == "2026-06-21"
