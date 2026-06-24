"""Browser capture API: the companion extension POSTs captured web bodies, AI-chat
transcripts, and selections here; we store them in the knowledge vault + index and
return the AI-assigned category/tags. Classification runs a model, so create is
offloaded to a worker thread so the event loop isn't blocked."""
from fastapi import APIRouter, HTTPException
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response
from pydantic import BaseModel

from .. import browser_capture

router = APIRouter(prefix="/api/capture")


class CaptureIn(BaseModel):
    kind: str = "web"  # web | ai_chat | selection
    url: str = ""
    title: str = ""
    content: str
    html: str | None = None
    captured_at: str | None = None


@router.post("")
async def create_capture(body: CaptureIn) -> dict:
    if not body.content.strip():
        raise HTTPException(422, "抓取内容为空")
    cap = await run_in_threadpool(
        browser_capture.create_capture,
        body.kind,
        body.url,
        body.title,
        body.content,
        body.html,
        body.captured_at,
    )
    return {
        "id": cap["id"],
        "title": cap["title"],
        "category": cap["category"],
        "tags": cap["tags"],
        "kind": cap["kind"],
    }


@router.get("")
def list_captures() -> dict:
    return {"captures": browser_capture.list_captures()}


@router.get("/{capture_id}")
def get_capture(capture_id: str) -> dict:
    cap = browser_capture.get_capture(capture_id)
    if cap is None:
        raise HTTPException(404, "capture not found")
    return cap


@router.delete("/{capture_id}")
def delete_capture(capture_id: str) -> Response:
    if not browser_capture.delete_capture(capture_id):
        raise HTTPException(404, "capture not found")
    return Response(status_code=204)
