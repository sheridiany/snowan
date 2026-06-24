"""Browser captures: web page bodies, AI-chat transcripts, and selections sent by
the companion extension. Each capture is a portable Markdown file with YAML
frontmatter under ~/.snowan/captures/<id>.md (same vault philosophy as notes), and
is indexed into the shared knowledge index so it's searchable alongside notes. An
AI pass tags each capture with a short Chinese category + a few tags; that pass is
best-effort — a model failure degrades to 未分类 and never blocks the save."""
import asyncio
import hashlib
import json
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path

import yaml

from . import config, knowledge_index
from .agent.providers import build_model
from .config import load_settings

# kind -> source_type in the shared index. web pages and selections are 'web_page'
# (passively captured page text); transcripts are 'ai_chat'. Both weights already
# live in knowledge_search._SOURCE_WEIGHTS.
_SOURCE_TYPE = {"web": "web_page", "selection": "web_page", "ai_chat": "ai_chat"}
_KINDS = set(_SOURCE_TYPE)

_SYSTEM = """你是知识库归类助手。根据下面这段抓取的内容,给它判定一个类别和几个标签。
严格只输出 JSON,格式为 {"category": "…", "tags": ["…", "…"]}:
- category:一个简短的中文类别(2-6 字),例如「技术」「阅读」「工作」「生活」「资讯」。
- tags:3-6 个中文或英文标签,概括主题、领域、关键实体,不要重复 category。
不要输出 JSON 以外的任何内容。"""

_FENCE = re.compile(r"^```(?:json)?\s*\n(.*)\n```\s*$", re.S)
_TIMEOUT = 30.0


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _dir() -> Path:
    return config.SNOWAN_HOME / "captures"


def _path(capture_id: str) -> Path:
    return _dir() / f"{capture_id}.md"


def _content_hash(url: str, content: str) -> str:
    return hashlib.sha256(f"{url}\n\n{content}".encode()).hexdigest()[:16]


def _parse(path: Path) -> dict | None:
    try:
        raw = path.read_text(encoding="utf-8")
    except OSError:
        return None
    from . import vault

    fm, body = vault.split_frontmatter(raw)
    if not fm.get("id"):
        return None
    return {
        "id": str(fm["id"]),
        "kind": str(fm.get("kind") or "web"),
        "url": str(fm["url"]) if fm.get("url") else "",
        "title": str(fm["title"]) if fm.get("title") else "未命名抓取",
        "captured_at": str(fm["captured_at"]) if fm.get("captured_at") else _now(),
        "category": str(fm["category"]) if fm.get("category") else "未分类",
        "tags": [str(t) for t in fm["tags"]] if isinstance(fm.get("tags"), list) else [],
        "content_hash": str(fm["content_hash"]) if fm.get("content_hash") else "",
        "content": body,
        "_path": path,
    }


def _serialize(cap: dict) -> str:
    front = {
        "id": cap["id"],
        "kind": cap["kind"],
        "url": cap["url"],
        "title": cap["title"],
        "captured_at": cap["captured_at"],
        "category": cap["category"],
        "tags": cap["tags"],
        "content_hash": cap["content_hash"],
    }
    fm = yaml.safe_dump(front, allow_unicode=True, sort_keys=False).strip()
    return f"---\n{fm}\n---\n\n{cap['content']}\n"


def _public(cap: dict) -> dict:
    return {
        "id": cap["id"],
        "kind": cap["kind"],
        "url": cap["url"],
        "title": cap["title"],
        "captured_at": cap["captured_at"],
        "category": cap["category"],
        "tags": cap["tags"],
        "content": cap["content"],
    }


def _all() -> list[dict]:
    d = _dir()
    if not d.exists():
        return []
    caps = [c for p in d.glob("*.md") if (c := _parse(p))]
    caps.sort(key=lambda c: c["captured_at"], reverse=True)
    return caps


def _find_by_url(url: str) -> dict | None:
    if not url:
        return None
    return next((c for c in _all() if c["url"] == url), None)


def _content_changed_significantly(old: str, new: str) -> bool:
    """Whether the content shifted enough to warrant a fresh classify. Growing AI-chat
    transcripts and re-captured pages drift slightly on every report; we only re-run
    the model when the body grew/shrank by a meaningful fraction or a chunk of length."""
    a, b = len(old), len(new)
    if a == 0:
        return b > 0
    return abs(b - a) >= max(200, a * 0.25)


def _index(cap: dict) -> None:
    # category + tags ride into the index title/body so a search over the vault can
    # surface them; metadata search reuses the same chunk text.
    meta_line = f"[{cap['category']}] " + " ".join(f"#{t}" for t in cap["tags"])
    body = f"{meta_line}\n\n{cap['content']}" if cap["tags"] or cap["category"] != "未分类" else cap["content"]
    knowledge_index.index_document(
        {
            "id": cap["id"],
            "source_type": _SOURCE_TYPE.get(cap["kind"], "web_page"),
            "title": cap["title"],
            "uri": cap["url"],
            "created_at": cap["captured_at"],
            "updated_at": cap["captured_at"],
            "body": body,
        }
    )


def _fallback_classify() -> tuple[str, list[str]]:
    return "未分类", []


async def _classify(title: str, content: str) -> tuple[str, list[str]]:
    """Best-effort AI category + tags. Never raises — any failure degrades to 未分类."""
    text = f"{title}\n\n{content}".strip()
    if not text:
        return _fallback_classify()
    s = load_settings()
    if s.provider == "test" or not s.api_key:
        return _fallback_classify()
    try:
        from pydantic_ai import Agent

        agent = Agent(build_model(s), instructions=_SYSTEM)
        res = await asyncio.wait_for(agent.run(text[:6000]), timeout=_TIMEOUT)
        out = res.output if isinstance(res.output, str) else str(res.output)
        m = _FENCE.match(out.strip())
        data = json.loads((m.group(1) if m else out).strip())
        category = str(data.get("category", "")).strip() or "未分类"
        raw_tags = data.get("tags", [])
        tags = [str(t).strip() for t in raw_tags if str(t).strip()][:6] if isinstance(raw_tags, list) else []
        return category, tags
    except Exception:  # noqa: BLE001 — never lose the capture over a model failure
        return _fallback_classify()


def _run_classify(title: str, content: str) -> tuple[str, list[str]]:
    """Run the async classifier from sync code, even if a loop is already running."""
    try:
        return asyncio.run(_classify(title, content))
    except RuntimeError:
        # Already inside an event loop (e.g. called from an async request worker that
        # didn't offload): run in a fresh loop on a side thread so we don't block it.
        import concurrent.futures

        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as ex:
            return ex.submit(lambda: asyncio.run(_classify(title, content))).result()


# --- public API ------------------------------------------------------------

def create_capture(
    kind: str,
    url: str,
    title: str,
    content: str,
    html: str | None = None,
    captured_at: str | None = None,
) -> dict:
    """Save a capture as Markdown, classify it, and index it. Upserts by url: if the
    same url is already stored, the existing capture is updated in place (same id) —
    identical content (hash) is a no-op, otherwise content/title/captured_at are
    overwritten and the hash + index recomputed; classification only re-runs when the
    content changed significantly, else the original category/tags are kept to save a
    model call. Selections and url-less captures always create a new record."""
    if kind not in _KINDS:
        kind = "web"
    content = (content or "").strip()
    title = (title or "").strip() or "未命名抓取"
    url = (url or "").strip()
    _dir().mkdir(parents=True, exist_ok=True)

    h = _content_hash(url, content)
    existing = None if kind == "selection" else _find_by_url(url)
    if existing is not None:
        if existing["content_hash"] == h:
            return _public(existing)  # unchanged — skip the reclassify + rewrite
        cap = {
            **existing,
            "kind": kind,
            "title": title,
            "content": content,
            "captured_at": captured_at or _now(),
            "content_hash": h,
        }
        if _content_changed_significantly(existing["content"], content):
            cap["category"], cap["tags"] = _run_classify(title, content)
        cap["_path"].write_text(_serialize(cap), encoding="utf-8")
        _index(cap)
        return _public(cap)

    category, tags = _run_classify(title, content)
    cap = {
        "id": f"cap_{uuid.uuid4().hex}",
        "kind": kind,
        "url": url,
        "title": title,
        "captured_at": captured_at or _now(),
        "category": category,
        "tags": tags,
        "content_hash": h,
        "content": content,
    }
    _path(cap["id"]).write_text(_serialize(cap), encoding="utf-8")
    _index(cap)
    return _public(cap)


def list_captures() -> list[dict]:
    return [_public(c) for c in _all()]


def get_capture(capture_id: str) -> dict | None:
    c = _parse(_path(capture_id))
    return _public(c) if c else None


def delete_capture(capture_id: str) -> bool:
    p = _path(capture_id)
    if not p.exists():
        return False
    p.unlink(missing_ok=True)
    knowledge_index.remove_document(capture_id)
    return True
