import json

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from pydantic_ai.messages import ModelMessage

from ..agent.build import build_agent

router = APIRouter()
_agent = build_agent()

# In-memory conversation history per session. Disk persistence (ModelMessagesTypeAdapter)
# arrives with the session-store phase.
_sessions: dict[str, list[ModelMessage]] = {}


class ChatRequest(BaseModel):
    message: str
    session_id: str = "default"


@router.post("/api/chat/stream")
async def chat_stream(req: ChatRequest) -> StreamingResponse:
    history = _sessions.get(req.session_id, [])

    async def gen():
        async with _agent.run_stream(req.message, message_history=history) as result:
            async for delta in result.stream_text(delta=True):
                yield f"data: {json.dumps({'delta': delta})}\n\n"
            _sessions[req.session_id] = result.all_messages()
        yield 'data: {"done": true}\n\n'

    return StreamingResponse(gen(), media_type="text/event-stream")
