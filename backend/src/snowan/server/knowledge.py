"""Knowledge base: notes CRUD, hybrid search, chat -> note drafting, the daily
note (今天) module, and the local embedding model (status + explicit download)."""
import threading
from urllib.parse import quote

from typing import Annotated

from fastapi import APIRouter, HTTPException, Path
from fastapi.responses import Response
from pydantic import BaseModel

from .. import embeddings, export, knowledge, knowledge_draft, knowledge_folders, memory
from ..config import load_prefs, load_settings

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


@router.post("/daily/{date}/summarize")
async def daily_summarize(date: DailyDate) -> dict:
    """One-shot draft: today's note body + activity → a review draft (成就 / 挑战 /
    一条教训 / 明日重点). Returns an EDITABLE draft; never writes the note."""
    note = knowledge.get_daily(date)
    body = (note["body"] if note else "").strip() or "(今天还没写什么)"
    from pydantic_ai import Agent

    agent = Agent(
        _model_or_400(),
        instructions="你是 Snowan 的日记助手,帮用户复盘今天。基于他今天写的正文和当日活动,"
        "产出一份可编辑的晚复盘草稿:今天的成就、遇到的挑战、一条可带走的教训、明日重点。"
        "只是起草供他修改,不要说教、不要编造没发生的事。只输出 Markdown 草稿本身,简体中文,简洁。",
    )
    prompt = f"今天日期:{date}\n\n今天写的内容:\n{body}"
    persona = memory.profile_text() if load_prefs().get("memory_enabled", True) else ""
    if persona:
        prompt += (
            "\n\n关于用户(参考其长期/短期规划与习惯,据此把明日重点对齐他的真实目标,"
            f"但不要逐条复述):\n{persona}"
        )
    try:
        res = await agent.run(prompt)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, f"总结失败: {e}") from e
    return {"draft": res.output if isinstance(res.output, str) else str(res.output)}
