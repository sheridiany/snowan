import json
from collections.abc import AsyncIterator
from typing import Any

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from pydantic_ai import (
    Agent,
    FunctionToolCallEvent,
    FunctionToolResultEvent,
    PartDeltaEvent,
    TextPartDelta,
)
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


def _sse(event: dict[str, Any]) -> str:
    return f"data: {json.dumps(event)}\n\n"


def _jsonable(value: Any) -> Any:
    if isinstance(value, (str, int, float, bool, type(None), dict, list)):
        return value
    return str(value)


async def _run(message: str, history: list[ModelMessage], session_id: str) -> AsyncIterator[str]:
    async with _agent.iter(message, message_history=history) as run:
        async for node in run:
            if Agent.is_model_request_node(node):
                async with node.stream(run.ctx) as request_stream:
                    async for ev in request_stream:
                        if isinstance(ev, PartDeltaEvent) and isinstance(ev.delta, TextPartDelta):
                            yield _sse({"type": "delta", "text": ev.delta.content_delta})
            elif Agent.is_call_tools_node(node):
                async with node.stream(run.ctx) as handle_stream:
                    async for ev in handle_stream:
                        if isinstance(ev, FunctionToolCallEvent):
                            part = ev.part
                            args = part.args
                            if isinstance(args, str):
                                try:
                                    args = json.loads(args)
                                except json.JSONDecodeError:
                                    pass
                            yield _sse({
                                "type": "tool_call",
                                "id": part.tool_call_id,
                                "name": part.tool_name,
                                "args": _jsonable(args),
                            })
                        elif isinstance(ev, FunctionToolResultEvent):
                            result = ev.result
                            yield _sse({
                                "type": "tool_result",
                                "id": result.tool_call_id,
                                "name": result.tool_name,
                                "result": str(result.content),
                            })
        _sessions[session_id] = run.result.all_messages()
    yield _sse({"type": "done"})


@router.post("/api/chat/stream")
async def chat_stream(req: ChatRequest) -> StreamingResponse:
    history = _sessions.get(req.session_id, [])
    return StreamingResponse(
        _run(req.message, history, req.session_id),
        media_type="text/event-stream",
    )
