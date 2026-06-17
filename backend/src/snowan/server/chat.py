import json

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ..agent.build import build_agent

router = APIRouter()
_agent = build_agent()


class ChatRequest(BaseModel):
    message: str


@router.post("/api/chat/stream")
async def chat_stream(req: ChatRequest) -> StreamingResponse:
    async def gen():
        async with _agent.run_stream(req.message) as result:
            async for delta in result.stream_text(delta=True):
                yield f"data: {json.dumps({'delta': delta})}\n\n"
        yield 'data: {"done": true}\n\n'

    return StreamingResponse(gen(), media_type="text/event-stream")
