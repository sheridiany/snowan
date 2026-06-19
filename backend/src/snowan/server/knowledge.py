"""Knowledge base: notes CRUD, hybrid search, chat -> note drafting, and the
local embedding model (status + explicit download)."""
import threading

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

from .. import embeddings, knowledge, knowledge_draft, knowledge_folders

router = APIRouter(prefix="/api/knowledge")


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
