"""Conversational onboarding for the L3 画像: serve the interview questions and draft
a 6-section persona from the user's answers. Persisting a confirmed draft goes through
the existing PUT /api/memory/profile — this router never writes."""
from fastapi import APIRouter
from pydantic import BaseModel

from .. import memory, persona_interview

router = APIRouter(prefix="/api/persona")


class DraftBody(BaseModel):
    answers: dict


@router.get("/questions")
def questions() -> list[dict]:
    return persona_interview.QUESTIONS


@router.post("/draft")
async def draft(body: DraftBody) -> dict:
    # Fold in the current 画像 so re-running from settings augments instead of clobbering.
    return {"draft": await persona_interview.draft(body.answers, memory.get_profile())}
