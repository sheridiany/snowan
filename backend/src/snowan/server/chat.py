import base64
import json
from collections.abc import AsyncIterator
from contextlib import AsyncExitStack
from typing import Any

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from pydantic_ai import (
    Agent,
    BinaryContent,
    DeferredToolRequests,
    DeferredToolResults,
    FunctionToolCallEvent,
    FunctionToolResultEvent,
    PartDeltaEvent,
    RetryPromptPart,
    TextPartDelta,
    ToolDenied,
)
from pydantic_ai.messages import ModelMessage
from pydantic_ai.usage import UsageLimits

from ..agent.build import build_agent
from ..agent.mcp import build_toolsets
from ..agent.sessions import delete_history, load_history, save_history
from .. import audit, memory, usage
from ..config import load_prefs
from ..extract import extract_text as _extract_text

router = APIRouter()


def _limits() -> UsageLimits:
    return UsageLimits(request_limit=load_prefs().get("max_iters", 40))


class Attachment(BaseModel):
    name: str
    mime: str
    data: str  # base64


class ChatRequest(BaseModel):
    message: str
    session_id: str = "default"
    attachments: list[Attachment] = []


def _build_prompt(message: str, attachments: list[Attachment]):
    """Images -> vision content; documents -> extracted text; text files inlined."""
    if not attachments:
        return message
    parts: list[Any] = [message] if message else []
    for a in attachments:
        try:
            raw = base64.b64decode(a.data)
        except Exception:  # noqa: BLE001
            continue
        if a.mime.startswith("image/"):
            parts.append(BinaryContent(data=raw, media_type=a.mime))
            continue
        text = _extract_text(a.name, a.mime, raw)
        if text is None:
            try:
                text = raw.decode("utf-8")
            except UnicodeDecodeError:
                text = None
        if text is not None:
            parts.append(f"\n\n[附件 {a.name}]\n```\n{text[:50000]}\n```")
        else:
            parts.append(f"\n\n[附件 {a.name}:无法解析的二进制文件]")
    return parts


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
    pending: dict[str, str] = {}  # tool_call_id -> arg summary, for the audit log
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
                        pending[part.tool_call_id] = audit.summarize(args)
                        yield _sse({
                            "type": "tool_call",
                            "id": part.tool_call_id,
                            "name": part.tool_name,
                            "args": _jsonable(args),
                        })
                    elif isinstance(ev, FunctionToolResultEvent):
                        result = ev.result
                        # Status from the authoritative result type, not an English
                        # substring: a retry part is an error; a return part carries the
                        # outcome (success|failed|denied).
                        if isinstance(result, RetryPromptPart):
                            status = "error"
                        elif getattr(result, "outcome", "success") == "denied":
                            status = "denied"
                        else:
                            status = "ok"
                        audit.log(result.tool_name, pending.pop(result.tool_call_id, ""), status)
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


async def _live_mcp(stack: AsyncExitStack) -> list:
    """Enter each enabled MCP server (starts its stdio subprocess) resiliently — a
    server that fails to start is skipped, never fatal to the chat turn."""
    live = []
    for srv in build_toolsets():
        try:
            await stack.enter_async_context(srv)
            live.append(srv)
        except Exception:  # noqa: BLE001 — bad/unreachable server: skip, keep the rest
            pass
    return live


def _query_text(prompt: Any) -> str:
    if isinstance(prompt, str):
        return prompt
    if isinstance(prompt, (list, tuple)):
        return " ".join(p for p in prompt if isinstance(p, str))
    return ""


async def _run_new(prompt: Any, history: list[ModelMessage], session_id: str) -> AsyncIterator[str]:
    # Build per-request so a model/key change saved in Settings takes effect at once.
    # Per-turn retrieved memory rides in the USER message (a <相关记忆> block), NOT in
    # the instructions — that keeps the system+tools prefix byte-stable so prompt
    # caching lands; the dynamic memory is then the only uncached part of the turn.
    mem_ctx = memory.auto_context(_query_text(prompt)) if load_prefs().get("memory_enabled", True) else ""
    if mem_ctx:
        block = f"<相关记忆>\n{mem_ctx}\n</相关记忆>"
        prompt = [block, *prompt] if isinstance(prompt, list) else [block, prompt]
    agent = build_agent()
    async with AsyncExitStack() as stack:
        toolsets = await _live_mcp(stack)
        async with agent.iter(
            prompt, message_history=history, usage_limits=_limits(), toolsets=toolsets
        ) as run:
            async for chunk in _stream_run(run):
                yield chunk
            save_history(session_id, run.result.all_messages())
            usage.record(run.result)


async def _run_resume(
    history: list[ModelMessage],
    results: DeferredToolResults,
    session_id: str,
) -> AsyncIterator[str]:
    agent = build_agent()
    async with AsyncExitStack() as stack:
        toolsets = await _live_mcp(stack)
        async with agent.iter(
            message_history=history,
            deferred_tool_results=results,
            usage_limits=_limits(),
            toolsets=toolsets,
        ) as run:
            async for chunk in _stream_run(run):
                yield chunk
            save_history(session_id, run.result.all_messages())
            usage.record(run.result)


@router.post("/api/chat/stream")
async def chat_stream(req: ChatRequest) -> StreamingResponse:
    history = load_history(req.session_id)
    prompt = _build_prompt(req.message, req.attachments)
    return StreamingResponse(
        _run_new(prompt, history, req.session_id),
        media_type="text/event-stream",
    )


@router.delete("/api/sessions/{session_id}")
def delete_session(session_id: str) -> dict:
    delete_history(session_id)
    return {"ok": True}


@router.post("/api/chat/approve")
async def chat_approve(req: ApproveRequest) -> StreamingResponse:
    history = load_history(req.session_id)
    results = DeferredToolResults()
    for tool_call_id, approved in req.decisions.items():
        results.approvals[tool_call_id] = (
            True if approved else ToolDenied("The user denied this tool call.")
        )
    return StreamingResponse(
        _run_resume(history, results, req.session_id),
        media_type="text/event-stream",
    )
