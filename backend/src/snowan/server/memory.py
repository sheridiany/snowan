"""Long-term memory: L2 entries CRUD, L3 profile, L1 daily logs, recall preview,
and the reviewable consolidation pass (propose a diff -> apply only what the user
approved). The consolidation agent never writes directly."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from .. import memory, memory_consolidate

router = APIRouter(prefix="/api/memory")


class EntryCreate(BaseModel):
    content: str
    type: str = "fact"
    importance: int = 3
    confidence: float | None = None


class EntryUpdate(BaseModel):
    content: str | None = None
    type: str | None = None
    importance: int | None = None
    valid: bool | None = None


class ProfileBody(BaseModel):
    text: str


@router.get("/entries")
def list_entries(include_invalid: bool = False) -> list[dict]:
    return memory.list_entries(include_invalid=include_invalid)


@router.post("/entries")
def create_entry(req: EntryCreate) -> dict:
    if not req.content.strip():
        raise HTTPException(422, "content is required")
    return memory.create_entry(
        req.content, type=req.type, importance=req.importance, confidence=req.confidence
    )


@router.put("/entries/{mem_id}")
def update_entry(mem_id: str, req: EntryUpdate) -> dict:
    m = memory.update_entry(
        mem_id, content=req.content, type=req.type,
        importance=req.importance, valid=req.valid,
    )
    if m is None:
        raise HTTPException(404, "memory not found")
    return m


@router.delete("/entries/{mem_id}")
def delete_entry(mem_id: str) -> dict:
    return {"ok": memory.delete_entry(mem_id)}


@router.delete("/all")
def clear_all() -> dict:
    """Erase all long-term memory (entries + profile + daily logs); profile backed up."""
    return memory.clear_all()


@router.get("/profile")
def get_profile() -> dict:
    return {"text": memory.get_profile()}


@router.put("/profile")
def set_profile(req: ProfileBody) -> dict:
    memory.set_profile(req.text)
    return {"text": req.text}  # echo back so the UI keeps the saved value


@router.get("/daily")
def read_daily(date: str | None = None) -> dict:
    return {"date": date, "text": memory.read_daily(date)}


@router.get("/daily/dates")
def list_daily_dates() -> list[str]:
    return memory.list_daily_dates()


@router.get("/recall")
def recall(q: str = "") -> list[dict]:
    return memory.recall(q, 8)


@router.post("/consolidate")
async def consolidate() -> dict:
    """Propose a reviewable consolidation diff (adds/updates/deprecations/promotions),
    each item carrying its evidence. Nothing is written here."""
    return await memory_consolidate.propose()


@router.post("/consolidate/apply")
def consolidate_apply(diff: dict) -> dict:
    """Write only the diff items the user approved (approved=true)."""
    return memory_consolidate.apply(diff)
