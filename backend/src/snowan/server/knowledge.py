"""Knowledge base: notes CRUD, hybrid search, and chat -> note drafting."""
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

from .. import knowledge, knowledge_draft

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
