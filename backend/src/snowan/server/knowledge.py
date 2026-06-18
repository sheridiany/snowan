"""Knowledge base: notes CRUD + keyword search."""
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

from .. import knowledge

router = APIRouter(prefix="/api/knowledge")


class NoteCreate(BaseModel):
    body: str
    title: str = ""


class NoteUpdate(BaseModel):
    title: str | None = None
    body: str | None = None


@router.get("/notes")
def list_notes() -> list[dict]:
    return knowledge.list_notes()


@router.post("/notes")
def create_note(req: NoteCreate) -> dict:
    if not req.body.strip():
        raise HTTPException(422, "body is required")
    return knowledge.create_note(req.body, req.title)


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
