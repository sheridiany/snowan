"""Reading (阅读) API: feed CRUD + refresh, article list/detail/flags, paste-URL,
and the AI layer (summarize / ask-your-reading RAG / translate) over the active
provider model. save-note bridges an article into the knowledge vault."""
from urllib.parse import quote

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

from .. import export, knowledge, reading
from ..agent.providers import build_model
from ..config import load_settings
from ..reading import sanitize_html

router = APIRouter(prefix="/api/reading")


# --- request models --------------------------------------------------------

class FeedAdd(BaseModel):
    url: str


class FeedRename(BaseModel):
    title: str | None = None


class ArticleFlags(BaseModel):
    is_read: bool | None = None
    is_starred: bool | None = None
    read_later: bool | None = None


class UrlBody(BaseModel):
    url: str


class TranslateBody(BaseModel):
    lang: str = "中文"


class AskBody(BaseModel):
    question: str


# --- feeds -----------------------------------------------------------------

@router.post("/feeds")
def add_feed(req: FeedAdd) -> dict:
    if not req.url.strip():
        raise HTTPException(422, "url is required")
    try:
        return reading.add_feed(req.url.strip())
    except ValueError as e:
        raise HTTPException(400, str(e)) from e


@router.get("/feeds")
def list_feeds() -> list[dict]:
    return reading.list_feeds()


@router.patch("/feeds/{feed_id}")
def rename_feed(feed_id: int, req: FeedRename) -> dict:
    feed = reading.rename_feed(feed_id, req.title or "")
    if feed is None:
        raise HTTPException(404, "feed not found")
    return feed


@router.delete("/feeds/{feed_id}")
def delete_feed(feed_id: int) -> Response:
    if not reading.delete_feed(feed_id):
        raise HTTPException(404, "feed not found")
    return Response(status_code=204)


@router.post("/refresh")
def refresh_all() -> dict:
    return {"new": reading.refresh_all()}


@router.post("/feeds/{feed_id}/refresh")
def refresh_feed(feed_id: int) -> dict:
    return {"new": reading.refresh_feed(feed_id)}


# --- articles --------------------------------------------------------------

@router.get("/articles")
def list_articles(
    view: str = "all", feed_id: int | None = None, q: str = "",
    limit: int = 50, before: str | None = None,
) -> list[dict]:
    return reading.list_articles(
        view=view, feed_id=feed_id, q=q, limit=max(1, min(limit, 200)), before=before
    )


@router.get("/articles/{article_id}")
def get_article(article_id: str) -> dict:
    art = reading.get_article(article_id)
    if art is None:
        raise HTTPException(404, "article not found")
    return art


# Articles are stored as sanitized HTML (not Markdown), so only HTML export is
# cheap here — md/docx would need an HTML→token walker, skipped on purpose.
@router.get("/articles/{article_id}/export")
def export_article(article_id: str) -> Response:
    art = reading.get_article(article_id)
    if art is None:
        raise HTTPException(404, "article not found")
    body = art["extracted_html"] or art["content_html"]
    if not body:
        raise HTTPException(400, "该文章没有可导出的正文")
    title = art["title"] or "文章"
    html = export.html_to_html_doc(title, body)
    return Response(
        html.encode("utf-8"),
        media_type="text/html; charset=utf-8",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{quote(export._filename(title, 'html'))}"
        },
    )


@router.patch("/articles/{article_id}")
def update_article(article_id: str, req: ArticleFlags) -> dict:
    art = reading.update_article(
        article_id, is_read=req.is_read, is_starred=req.is_starred, read_later=req.read_later
    )
    if art is None:
        raise HTTPException(404, "article not found")
    return art


@router.post("/articles/url")
def add_url_article(req: UrlBody) -> dict:
    if not req.url.strip():
        raise HTTPException(422, "url is required")
    art = reading.add_url_article(req.url.strip())
    if art is None:
        raise HTTPException(400, "无法抓取或解析该网页")
    return art


# --- AI --------------------------------------------------------------------

def _model_or_400():
    s = load_settings()
    if s.provider == "test" or not s.api_key:
        raise HTTPException(400, "未配置 AI 模型,请先在设置中选择")
    return build_model(s)


@router.post("/articles/{article_id}/summarize")
async def summarize(article_id: str) -> dict:
    art = reading.get_article(article_id)
    if art is None:
        raise HTTPException(404, "article not found")
    if art["ai_summary"]:
        return {"summary": art["ai_summary"]}
    body = (art["extracted_html"] or art["content_html"] or "")
    text = reading._text_of(body)[:8000]
    if not text:
        raise HTTPException(400, "该文章没有可摘要的正文")
    from pydantic_ai import Agent

    agent = Agent(
        _model_or_400(),
        instructions="你是阅读助手。用简体中文为给定文章写一段简明摘要:先一句话点题,"
        "再用 3-5 个要点列出核心信息。只输出摘要本身,使用 Markdown。",
    )
    try:
        res = await agent.run(f"文章标题:{art['title']}\n\n正文:\n{text}")
    except Exception as e:  # noqa: BLE001 — surface the upstream model error
        raise HTTPException(400, f"摘要失败: {e}") from e
    summary = res.output if isinstance(res.output, str) else str(res.output)
    reading.set_article_summary(article_id, summary)
    return {"summary": summary}


@router.post("/articles/{article_id}/translate")
async def translate(article_id: str, req: TranslateBody) -> dict:
    art = reading.get_article(article_id)
    if art is None:
        raise HTTPException(404, "article not found")
    if art["translated_html"] and art["translated_lang"] == req.lang:
        return {"html": art["translated_html"]}
    source = art["extracted_html"] or art["content_html"] or ""
    if not reading._text_of(source):
        raise HTTPException(400, "该文章没有可翻译的正文")
    from pydantic_ai import Agent

    agent = Agent(
        _model_or_400(),
        instructions=f"你是翻译引擎。把给定的 HTML 文章正文翻译成{req.lang},"
        "保留原有的 HTML 标签结构,只翻译文本内容。只输出翻译后的 HTML,不要任何额外解释或代码围栏。",
    )
    try:
        res = await agent.run(source[:12000])
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, f"翻译失败: {e}") from e
    raw = res.output if isinstance(res.output, str) else str(res.output)
    html = sanitize_html(raw)  # re-sanitize model output before storing/rendering
    reading.set_article_translation(article_id, html, req.lang)
    return {"html": html}


@router.post("/ask")
async def ask(req: AskBody) -> dict:
    if not req.question.strip():
        raise HTTPException(422, "question is required")
    hits = reading.retrieve(req.question, k=6)
    if not hits:
        return {"answer": "你的阅读库里还没有相关文章。", "sources": []}
    context = "\n\n".join(
        f"【{i + 1}】{h['title']}\n{h['body_text'][:1200]}" for i, h in enumerate(hits)
    )
    from pydantic_ai import Agent

    agent = Agent(
        _model_or_400(),
        instructions="你是阅读助手。只依据下面提供的文章片段回答用户的问题,"
        "并在回答中用文章标题标注引用。如果这些片段里没有答案,就直接说明没有找到相关内容,不要编造。",
    )
    try:
        res = await agent.run(f"文章片段:\n{context}\n\n问题:{req.question}")
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, f"问答失败: {e}") from e
    answer = res.output if isinstance(res.output, str) else str(res.output)
    return {
        "answer": answer,
        "sources": [{"id": h["id"], "title": h["title"]} for h in hits],
    }


# --- KB bridge -------------------------------------------------------------

@router.post("/articles/{article_id}/save-note")
def save_note(article_id: str) -> dict:
    art = reading.get_article(article_id)
    if art is None:
        raise HTTPException(404, "article not found")
    body = reading._text_of(art["extracted_html"] or art["content_html"] or "")
    if not body:
        raise HTTPException(400, "该文章没有可保存的正文")
    note = knowledge.create_note(
        body, title=art["title"] or "阅读笔记",
        origin="reading", source={"url": art["url"]} if art["url"] else None,
    )
    reading.set_article_note(article_id, note["id"])
    return {"note_id": note["id"]}
