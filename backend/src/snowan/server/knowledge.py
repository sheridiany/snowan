"""Knowledge base: notes CRUD, hybrid search, chat -> note drafting, the daily
note (今天) module, and the local embedding model (status + explicit download)."""
import threading
from urllib.parse import quote

from typing import Annotated

from fastapi import APIRouter, HTTPException, Path
from fastapi.responses import Response
from pydantic import BaseModel

from .. import embeddings, export, knowledge, knowledge_draft, knowledge_folders, memory, reading
from ..config import load_settings

router = APIRouter(prefix="/api/knowledge")

# The {date} path param is client-supplied and ends up as a vault filename, so it
# must be a literal YYYY-MM-DD — reject anything else with a 422 at the boundary
# (defence in depth: knowledge._daily_path also validates) to block path traversal.
DailyDate = Annotated[str, Path(pattern=r"^\d{4}-\d{2}-\d{2}$")]


class NoteCreate(BaseModel):
    body: str
    title: str = ""
    origin: str = "manual"  # "manual" | "chat" (a 生成笔记)
    source: dict | None = None  # provenance, e.g. {"chat": <session_id>, "messages": [...]}


class NoteUpdate(BaseModel):
    title: str | None = None
    body: str | None = None


class DraftEntry(BaseModel):
    role: str  # "user" | "assistant"
    text: str


class DraftRequest(BaseModel):
    entries: list[DraftEntry]
    topic: str = ""
    title: str = ""


class FolderAdd(BaseModel):
    path: str


class DailySave(BaseModel):
    body: str
    base_updated_at: str | None = None  # the updated_at the client last saw; 409 if stale


@router.get("/notes")
def list_notes() -> list[dict]:
    return knowledge.list_notes()


@router.post("/notes")
def create_note(req: NoteCreate) -> dict:
    if not req.body.strip():
        raise HTTPException(422, "body is required")
    return knowledge.create_note(req.body, req.title, origin=req.origin, source=req.source)


@router.post("/notes/draft")
async def draft_note(req: DraftRequest) -> dict:
    """Distill chat messages into a structured note draft for the user to review."""
    return await knowledge_draft.draft_note(
        [e.model_dump() for e in req.entries], req.topic, req.title
    )


@router.get("/notes/{note_id}")
def get_note(note_id: str) -> dict:
    note = knowledge.get_note(note_id)
    if note is None:
        raise HTTPException(404, "note not found")
    return note


_EXPORT = {
    "md": ("text/markdown; charset=utf-8", "md"),
    "html": ("text/html; charset=utf-8", "html"),
    "docx": ("application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"),
}


def _attachment(filename: str) -> str:
    # RFC 5987 filename* so CJK note titles survive the Content-Disposition header.
    return f"attachment; filename*=UTF-8''{quote(filename)}"


@router.get("/notes/{note_id}/export")
def export_note(note_id: str, format: str = "md") -> Response:
    if format not in _EXPORT:
        raise HTTPException(422, "format must be md|html|docx")
    note = knowledge.get_note(note_id)
    if note is None:
        raise HTTPException(404, "note not found")
    media_type, ext = _EXPORT[format]
    title = note["title"]
    if format == "md":
        content: bytes = note["body"].encode("utf-8")
    elif format == "html":
        content = export.md_to_html_doc(title, note["body"]).encode("utf-8")
    else:
        content = export.md_to_docx(title, note["body"])
    return Response(
        content,
        media_type=media_type,
        headers={"Content-Disposition": _attachment(export._filename(title, ext))},
    )


@router.put("/notes/{note_id}")
def update_note(note_id: str, req: NoteUpdate) -> dict:
    note = knowledge.update_note(note_id, title=req.title, body=req.body)
    if note is None:
        raise HTTPException(404, "note not found")
    return note


@router.delete("/notes/{note_id}")
def delete_note(note_id: str) -> Response:
    if not knowledge.delete_note(note_id):
        raise HTTPException(404, "note not found")
    return Response(status_code=204)


@router.get("/search")
def search(q: str = "", limit: int = 8) -> dict:
    return {"results": knowledge.search_notes(q, limit)}


@router.get("/folders")
def list_folders() -> dict:
    return knowledge_folders.list_folders()


@router.post("/folders")
def add_folder(req: FolderAdd) -> dict:
    try:
        return knowledge_folders.add_folder(req.path)
    except ValueError:
        raise HTTPException(400, "路径不存在或不是文件夹")


@router.delete("/folders/{folder_id}")
def remove_folder(folder_id: str) -> dict:
    return knowledge_folders.remove_folder(folder_id)


@router.post("/folders/reindex")
def reindex_folders() -> dict:
    knowledge_folders.reindex_async()
    return knowledge_folders.list_folders()


@router.get("/embedding")
def embedding_status() -> dict:
    """Local semantic-search model status, for the Settings download UI."""
    return {
        "model": embeddings.MODEL_ID,
        "size_mb": embeddings.SIZE_MB,
        "ready": embeddings.is_ready(),
        "downloading": embeddings.is_downloading(),
    }


@router.post("/embedding/download")
def embedding_download() -> dict:
    """Kick off the one-time model download (background), then re-embed any notes
    that were saved before it landed. Poll GET /embedding for `ready`."""
    if embeddings.is_ready():
        return {"ready": True, "downloading": False}
    if not embeddings.is_downloading():

        def _run() -> None:
            embeddings.download()
            knowledge.sync_index()  # back-fill vectors for already-saved notes
            knowledge_folders.reindex()  # …and for indexed files

        threading.Thread(target=_run, daemon=True).start()
    return {"ready": False, "downloading": True}


# --- 今天 (daily note) ------------------------------------------------------
# "date" is always the CLIENT's local YYYY-MM-DD; the server never computes its
# own "today". /daily/dates is declared before /daily/{date} so it isn't swallowed.


@router.get("/daily/dates")
def daily_dates() -> list[str]:
    return knowledge.list_daily_dates()


@router.get("/daily/{date}")
def get_daily(date: DailyDate) -> dict:
    """The daily note for a date (find-or-create; applies the template on create)."""
    return knowledge.get_or_create_daily(date)


@router.put("/daily/{date}")
def save_daily(date: DailyDate, req: DailySave) -> dict:
    try:
        return knowledge.save_daily(date, req.body, req.base_updated_at)
    except knowledge.DailyConflict as e:
        raise HTTPException(409, "笔记在别处被修改过,请刷新后再保存") from e


@router.get("/daily/{date}/assembly")
def daily_assembly(date: DailyDate) -> dict:
    return knowledge.daily_assembly(date)


@router.get("/daily/{date}/carryover")
def daily_carryover(date: DailyDate) -> list[dict]:
    return knowledge.daily_carryover(date)


def _model_or_400():
    s = load_settings()
    if s.provider == "test" or not s.api_key:
        raise HTTPException(400, "未配置 AI 模型,请先在设置中选择")
    from ..agent.providers import build_model

    return build_model(s)


def _kb_digest(date: str) -> str:
    """A broad, bounded snapshot of the whole knowledge base for the suggestions
    agent: profile + long-term memory + note breadth/excerpts + recent daily prose +
    recent reading. Capped so it fits a prompt; grows richer as the KB grows."""
    def ex(text: str, n: int = 140) -> str:
        return " ".join((text or "").split())[:n]

    profile = memory.profile_text().strip() or "(未设置)"
    mems = [ex(m["content"], 120) for m in memory.list_entries()][:15]
    notes = sorted(knowledge.list_notes(), key=lambda n: n.get("updated_at", ""), reverse=True)
    titles = [n["title"] for n in notes][:40]
    excerpts = [f"《{n['title']}》:{ex(n['body'])}" for n in notes[:8]]
    recent_daily = []
    for d in knowledge.list_daily_dates()[:5]:
        nd = knowledge.get_daily(d)
        prose = ex(nd["body"], 280) if nd else ""
        if prose:
            recent_daily.append(f"[{d}] {prose}")
    reading_titles = [a["title"] for a in reading.list_articles(limit=12)]
    return (
        f"# 用户画像\n{profile}\n\n"
        "# 长期记忆\n" + ("\n".join(f"- {m}" for m in mems) or "(无)") + "\n\n"
        f"# 笔记标题(共 {len(notes)} 篇)\n" + ("、".join(titles) or "(无)") + "\n\n"
        "# 近期笔记摘录\n" + ("\n".join(excerpts) or "(无)") + "\n\n"
        "# 最近几天的日记\n" + ("\n".join(recent_daily) or "(无)") + "\n\n"
        "# 最近读的\n" + ("、".join(reading_titles) or "(无)")
    )


@router.post("/daily/{date}/suggest")
async def daily_suggest(date: DailyDate) -> dict:
    """Exactly 3 KB-grounded suggestions (advice, NOT tasks): drawn from the user's
    profile, long-term memory, notes, recent daily prose, and recent reading.
    Returns an editable draft; never writes anything."""
    digest = _kb_digest(date)
    from pydantic_ai import Agent

    agent = Agent(
        _model_or_400(),
        instructions="你是用户的思考伙伴,不是任务管理器。基于他知识库里的内容——画像、长期记忆、"
        "笔记、最近的日记、读过的东西——给他正好 3 条建议。建议可以是:值得重拾的一个想法、"
        "两件事之间值得连接的洞察、值得深入的一个方向、一个温和的提醒、或一个引发思考的问题。"
        "绝不要派任务、不要给 to-do 清单、不要催他做事——给的是启发,不是指令。每条简短(一两句)、"
        "具体、尽量点到他自己写过/读过的东西。只输出 3 条 Markdown 列表项(- 开头),简体中文,别的都不要。",
    )
    try:
        res = await agent.run(f"今天日期:{date}\n\n{digest}")
    except Exception as e:  # noqa: BLE001 — surface the upstream model error
        raise HTTPException(400, f"建议生成失败: {e}") from e
    return {"draft": res.output if isinstance(res.output, str) else str(res.output)}


@router.post("/daily/{date}/summarize")
async def daily_summarize(date: DailyDate) -> dict:
    """One-shot draft: today's note body + activity → a review draft (成就 / 挑战 /
    一条教训 / 明日重点). Returns an EDITABLE draft; never writes the note."""
    note = knowledge.get_daily(date)
    body = (note["body"] if note else "").strip() or "(今天还没写什么)"
    assembly = knowledge.daily_assembly(date)
    reading_lines = "\n".join(f"- 读了《{r['title']}》" for r in assembly["reading"]) or "(无)"
    from pydantic_ai import Agent

    agent = Agent(
        _model_or_400(),
        instructions="你是 Snowan 的日记助手,帮用户复盘今天。基于他今天写的正文和当日活动,"
        "产出一份可编辑的晚复盘草稿:今天的成就、遇到的挑战、一条可带走的教训、明日重点。"
        "只是起草供他修改,不要说教、不要编造没发生的事。只输出 Markdown 草稿本身,简体中文,简洁。",
    )
    prompt = f"今天日期:{date}\n\n今天写的内容:\n{body}\n\n今天的阅读:\n{reading_lines}"
    try:
        res = await agent.run(prompt)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, f"总结失败: {e}") from e
    return {"draft": res.output if isinstance(res.output, str) else str(res.output)}
