import asyncio
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
from pydantic_ai.exceptions import (
    ModelAPIError,
    ModelHTTPError,
    UndrainedPendingMessagesError,
)
from pydantic_ai.messages import ModelMessage
from pydantic_ai.usage import UsageLimits

from ..agent.build import build_agent
from ..agent.mcp import build_toolsets
from ..agent.sessions import delete_history, load_history, save_history
from ..agent import auto_memory
from .. import audit, memory, usage
from ..config import load_prefs
from ..extract import extract_text as _extract_text

router = APIRouter()

# session_id -> the live AgentRun, so POST /api/chat/steer can enqueue a follow-up
# into the in-flight turn. Single-process, single-user; one entry per active turn.
_active_runs: dict[str, Any] = {}
# session_id -> the active skill mode, so an approval-resume rebuilds the agent in the
# same mode (the skill body isn't in the persisted history).
_session_skill: dict[str, str] = {}

# Skills that need a bigger iteration budget than the default — deep research fans out
# many searches + fetches before it can synthesize.
_SKILL_ITER_FLOOR = {"deep-research": 80}


def _limits(skill: str | None = None) -> UsageLimits:
    base = load_prefs().get("max_iters", 40)
    return UsageLimits(request_limit=max(base, _SKILL_ITER_FLOOR.get(skill or "", 0)))


class Attachment(BaseModel):
    name: str
    mime: str
    data: str  # base64


class ChatRequest(BaseModel):
    message: str
    session_id: str = "default"
    attachments: list[Attachment] = []
    skill: str | None = None  # active composer skill mode (deep-research / make-slides / …)


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
    # Tools whose call/result is surfaced as a synthetic event instead of a tool card.
    # Each: a per-call stash of the call args, the call-args key used as the audit label
    # (with its max length), and a builder turning the stashed args into the SSE event
    # (returns None to emit nothing).
    special: dict[str, dict[str, Any]] = {
        "render_diagram": {
            "stash": {},
            "label_key": "title",
            "label_len": 80,
            "event": lambda m: (
                {"type": "diagram", "svg": str(m["svg"]), "title": str(m.get("title") or "")}
                if m.get("svg")
                else None
            ),
        },
        "present_artifact": {
            "stash": {},
            "label_key": "path",
            "label_len": 200,
            "event": lambda m: (
                {"type": "artifact", "path": str(m["path"]), "title": str(m.get("title") or "")}
                if m.get("path")
                else None
            ),
        },
    }
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
                        if part.tool_name in special:
                            special[part.tool_name]["stash"][part.tool_call_id] = (
                                args if isinstance(args, dict) else {}
                            )
                            continue  # surfaced as a synthetic event on its result, not a tool card
                        pending[part.tool_call_id] = audit.summarize(args)
                        yield _sse({
                            "type": "tool_call",
                            "id": part.tool_call_id,
                            "name": part.tool_name,
                            "args": _jsonable(args),
                        })
                    elif isinstance(ev, FunctionToolResultEvent):
                        result = ev.result
                        if result.tool_name in special:
                            spec = special[result.tool_name]
                            meta = spec["stash"].pop(result.tool_call_id, {})
                            ok = not str(result.content).startswith("error")
                            label = str(meta.get(spec["label_key"], ""))[: spec["label_len"]]
                            audit.log(result.tool_name, label, "ok" if ok else "error")
                            if ok:
                                event = spec["event"](meta)
                                if event is not None:
                                    yield _sse(event)
                            continue
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


def _drain_pending_text(run: Any) -> str:
    """Text of the user message(s) stranded in the run's pending queue — a steer that
    arrived in the brief final-response window, too late to inject into this turn."""
    out: list[str] = []
    for pm in getattr(run, "pending_messages", None) or []:
        for m in pm.messages:
            for part in getattr(m, "parts", []) or []:
                c = getattr(part, "content", None)
                if isinstance(c, str):
                    out.append(c)
                elif isinstance(c, (list, tuple)):
                    out.extend(x for x in c if isinstance(x, str))
    return "\n".join(out).strip()


# Retry tuning for transient model-provider failures (overload / rate-limit / network).
_RETRY_MAX_ATTEMPTS = 3
_RETRY_BASE_DELAY = 1.0  # seconds; doubled each attempt (1s, 2s, 4s)


def _is_retryable(err: BaseException) -> bool:
    """True for transient provider failures worth retrying: 408/429/5xx HTTP errors and
    bare network/connection errors. 4xx (bad key, bad request, content filter) are not."""
    if isinstance(err, ModelHTTPError):
        return err.status_code == 408 or err.status_code == 429 or err.status_code >= 500
    # ModelAPIError without an HTTP status is a transport-level failure (DNS, timeout, reset).
    return isinstance(err, ModelAPIError)


def _friendly_error(err: BaseException) -> str:
    """A readable Chinese explanation + triage hints for a model-call failure."""
    if isinstance(err, ModelHTTPError):
        code = err.status_code
        if code in (401, 403):
            return (
                "调用模型失败:凭证无效或已过期(HTTP "
                f"{code})。请到设置中检查 API Key 是否正确、是否仍在有效期内。"
            )
        if code == 429:
            return (
                "调用模型失败:触发服务商限流(HTTP 429)。已自动重试多次仍未成功,"
                "请稍后再试,或在设置中切换到额度更充足的模型/账号。"
            )
        if code >= 500:
            return (
                f"调用模型失败:服务商暂时不可用(HTTP {code})。这是模型服务端的问题,"
                "已自动重试多次仍未恢复,请稍后再试。"
            )
        if code == 400:
            return (
                "调用模型失败:请求被服务商拒绝(HTTP 400)。可能是模型名配置有误或本次"
                "输入不被支持,请到设置中检查所选模型。"
            )
        return f"调用模型失败:服务商返回 HTTP {code}。请稍后再试或检查设置中的模型配置。"
    if isinstance(err, ModelAPIError):
        return (
            "调用模型失败:无法连接到模型服务(网络问题)。请检查网络连接、代理设置,"
            "以及设置中的接口地址是否正确,稍后再试。"
        )
    return f"调用模型失败:{err}"


async def _drive(
    session_id: str,
    prompt: Any,
    history: list[ModelMessage],
    deferred_results: DeferredToolResults | None = None,
    skill: str | None = None,
) -> AsyncIterator[str]:
    """Stream one agent turn, registering it as the session's active run so a steer
    (POST /api/chat/steer) can `enqueue` into it mid-flight. A steer that lands too
    late to be injected (the brief final-response window, where the loop hits End with
    the message still queued) is run as an immediate follow-up turn rather than lost.

    A transient model-provider failure (overload / rate-limit / network) is retried with
    exponential backoff while nothing has been streamed yet; if every attempt fails, or a
    non-retryable error surfaces, a clear Chinese error message is streamed to the client
    instead of a bare 500."""
    stranded = ""
    progress = {"emitted": False, "stranded": ""}
    for attempt in range(_RETRY_MAX_ATTEMPTS):
        try:
            async for chunk in _drive_once(
                session_id, prompt, history, deferred_results, skill, progress
            ):
                yield chunk
            stranded = progress["stranded"]
            break
        except (ModelHTTPError, ModelAPIError) as e:
            # Only retry while the turn produced no output: re-running after partial
            # content would duplicate it. Non-retryable errors fall straight through.
            if progress["emitted"] or not _is_retryable(e) or attempt == _RETRY_MAX_ATTEMPTS - 1:
                yield _sse({"type": "delta", "text": f"\n\n⚠️ {_friendly_error(e)}"})
                yield _sse({"type": "error", "message": str(e)})
                yield _sse({"type": "done"})
                break
            await asyncio.sleep(_RETRY_BASE_DELAY * (2**attempt))
    if stranded:
        async for chunk in _run_new(stranded, load_history(session_id), session_id, skill=skill):
            yield chunk


async def _drive_once(
    session_id: str,
    prompt: Any,
    history: list[ModelMessage],
    deferred_results: DeferredToolResults | None,
    skill: str | None,
    progress: dict[str, Any],
) -> AsyncIterator[str]:
    """One attempt of a turn. Sets progress["emitted"] once any chunk is streamed (so the
    caller knows a retry would duplicate output) and progress["stranded"] for a late steer.
    Re-raises model-provider errors for the caller's retry loop after persisting the turn."""
    # Build per-request so a model/key change saved in Settings takes effect at once.
    agent = build_agent(skill=skill)
    async with AsyncExitStack() as stack:
        toolsets = await _live_mcp(stack)
        kwargs: dict[str, Any] = {"message_history": history, "usage_limits": _limits(skill), "toolsets": toolsets}
        if deferred_results is not None:
            kwargs["deferred_tool_results"] = deferred_results
        args = (prompt,) if prompt is not None else ()
        async with agent.iter(*args, **kwargs) as run:
            _active_runs[session_id] = run
            try:
                try:
                    async for chunk in _stream_run(run):
                        progress["emitted"] = True
                        yield chunk
                except UndrainedPendingMessagesError:
                    progress["stranded"] = _drain_pending_text(run)
                    yield _sse({"type": "done"})
                usage.record(run.result)
            except (ModelHTTPError, ModelAPIError):
                # Transient/provider failure: persist the partial turn and let _drive's
                # retry loop decide whether to retry or surface a friendly message.
                save_history(session_id, run.all_messages())
                raise
            except BaseException as e:
                # Persist the partial turn on Stop (GeneratorExit/CancelledError) and on
                # any mid-stream failure, then surface the error to the client. The turn
                # is saved exactly once — here on the failure path, in finally on success.
                save_history(session_id, run.all_messages())
                if not isinstance(e, GeneratorExit):
                    yield _sse({"type": "error", "message": str(e)})
                    yield _sse({"type": "done"})
                raise
            else:
                save_history(session_id, run.all_messages())
            finally:
                _active_runs.pop(session_id, None)


# Strong refs to fire-and-forget background tasks (auto memory capture) so the
# event loop doesn't GC them mid-run.
_bg_tasks: set = set()


async def _run_new(
    prompt: Any, history: list[ModelMessage], session_id: str, skill: str | None = None
) -> AsyncIterator[str]:
    # Remember the turn's skill mode so an approval-resume stays in it.
    if skill:
        _session_skill[session_id] = skill
    else:
        _session_skill.pop(session_id, None)
    # Per-turn retrieved memory rides in the USER message (a <相关记忆> block), NOT in the
    # instructions — that keeps the system+tools prefix byte-stable so prompt caching lands.
    # Skip retrieval on empty / pure-image / attachment-only turns: no query text to match.
    query = _query_text(prompt).strip()
    mem_ctx = (
        await asyncio.to_thread(memory.auto_context, query)
        if load_prefs().get("memory_enabled", True) and len(query) >= 2
        else ""
    )
    if mem_ctx:
        block = f"<相关记忆>\n{mem_ctx}\n</相关记忆>"
        prompt = [block, *prompt] if isinstance(prompt, list) else [block, prompt]
    async for chunk in _drive(session_id, prompt, history, skill=skill):
        yield chunk
    # Passive "越用越懂你" capture: distill a few terse facts about the user into L2,
    # off the response path (best-effort). L3 profile still only changes via approval.
    if len(query) >= 4 and load_prefs().get("memory_enabled", True):
        _t = asyncio.create_task(auto_memory.capture(session_id))
        _bg_tasks.add(_t)
        _t.add_done_callback(_bg_tasks.discard)


async def _run_resume(
    history: list[ModelMessage],
    results: DeferredToolResults,
    session_id: str,
) -> AsyncIterator[str]:
    async for chunk in _drive(
        session_id, None, history, deferred_results=results, skill=_session_skill.get(session_id)
    ):
        yield chunk


@router.post("/api/chat/stream")
async def chat_stream(req: ChatRequest) -> StreamingResponse:
    history = load_history(req.session_id)
    prompt = _build_prompt(req.message, req.attachments)
    return StreamingResponse(
        _run_new(prompt, history, req.session_id, skill=req.skill),
        media_type="text/event-stream",
    )


class SteerRequest(BaseModel):
    session_id: str = "default"
    message: str


@router.post("/api/chat/steer")
async def chat_steer(req: SteerRequest) -> dict:
    """Inject a follow-up instruction into the session's in-flight turn without
    interrupting it (PydanticAI `enqueue`, 'asap'). No-op if no turn is running."""
    run = _active_runs.get(req.session_id)
    if run is None or not req.message.strip():
        return {"ok": False}
    run.enqueue(req.message, priority="asap")
    return {"ok": True}


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
