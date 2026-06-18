import json
from collections.abc import AsyncIterator
from typing import Any

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from pydantic_ai import (
    Agent,
    DeferredToolRequests,
    DeferredToolResults,
    FunctionToolCallEvent,
    FunctionToolResultEvent,
    PartDeltaEvent,
    TextPartDelta,
    ToolDenied,
)
from pydantic_ai.messages import ModelMessage

from ..agent.build import build_agent

router = APIRouter()

# In-memory conversation history per session. Disk persistence (ModelMessagesTypeAdapter)
# arrives with the session-store phase.
_sessions: dict[str, list[ModelMessage]] = {}


class ChatRequest(BaseModel):
    message: str
    session_id: str = "default"


class ApproveRequest(BaseModel):
    session_id: str = "default"
    decisions: dict[str, bool]


def _sse(event: dict[str, Any]) -> str:
    return f"data: {json.dumps(event)}\n\n"


def _jsonable(value: Any) -> Any:
    if isinstance(value, (str, int, float, bool, type(None), dict, list)):
        return value
    return str(value)


def _approval_event(requests: DeferredToolRequests) -> dict[str, Any]:
    return {
        "type": "approval_required",
        "calls": [
            {
                "id": call.tool_call_id,
                "name": call.tool_name,
                "args": _jsonable(call.args_as_dict()),
            }
            for call in requests.approvals
        ],
    }


async def _stream_run(run: Any) -> AsyncIterator[str]:
    """Stream one agent run, emitting delta/tool_call/tool_result/approval_required events."""
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

    output = run.result.output
    if isinstance(output, DeferredToolRequests) and output.approvals:
        yield _sse(_approval_event(output))
    yield _sse({"type": "done"})


async def _run_new(message: str, history: list[ModelMessage], session_id: str) -> AsyncIterator[str]:
    # Build per-request so a model/key change saved in Settings takes effect at once.
    agent = build_agent()
    async with agent.iter(message, message_history=history) as run:
        async for chunk in _stream_run(run):
            yield chunk
        _sessions[session_id] = run.result.all_messages()


async def _run_resume(
    history: list[ModelMessage],
    results: DeferredToolResults,
    session_id: str,
) -> AsyncIterator[str]:
    agent = build_agent()
    async with agent.iter(message_history=history, deferred_tool_results=results) as run:
        async for chunk in _stream_run(run):
            yield chunk
        _sessions[session_id] = run.result.all_messages()


@router.post("/api/chat/stream")
async def chat_stream(req: ChatRequest) -> StreamingResponse:
    history = _sessions.get(req.session_id, [])
    return StreamingResponse(
        _run_new(req.message, history, req.session_id),
        media_type="text/event-stream",
    )


@router.post("/api/chat/approve")
async def chat_approve(req: ApproveRequest) -> StreamingResponse:
    history = _sessions.get(req.session_id, [])
    results = DeferredToolResults()
    for tool_call_id, approved in req.decisions.items():
        results.approvals[tool_call_id] = (
            True if approved else ToolDenied("The user denied this tool call.")
        )
    return StreamingResponse(
        _run_resume(history, results, req.session_id),
        media_type="text/event-stream",
    )
