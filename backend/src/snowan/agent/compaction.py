"""Long-chat compaction for pydantic-ai.

Per-request, in-memory only: when a turn's running history exceeds a token
budget, all-but-the-recent-tail messages are summarized into ONE synthetic
message marked with a sentinel so it is never re-summarized. The raw history
on disk is untouched — chat.py persists run.result.all_messages() verbatim, so
sessions stay fully replayable. Attach via capabilities=[ProcessHistory(compact)].
"""
from pydantic_ai import Agent, RunContext
from pydantic_ai.messages import ModelMessage, ModelRequest, UserPromptPart

from ..config import load_prefs, load_settings
from .providers import build_model
from .. import memory

# Above this many input tokens (or the char-based fallback estimate) we compact.
_TOKEN_BUDGET = 24_000
# Rough chars-per-token for the fallback when usage isn't available yet.
_CHARS_PER_TOKEN = 4
# How many trailing messages to keep verbatim.
_KEEP_TAIL = 6
# Marks a synthetic summary message so it's excluded from future compaction.
SENTINEL = "[压缩摘要]"

_SUMMARY_INSTRUCTIONS = (
    "你是对话压缩助手。把给定的对话历史压缩成一段简洁的中文摘要,"
    "保留:用户的目标与偏好、已确定的事实与决定、未完成的事项、"
    "以及确切的文件路径/函数名/错误信息。不要寒暑,不要逐条复述,"
    "直接输出摘要正文。"
)


def _text_of(message: ModelMessage) -> str:
    """Best-effort plain text of a message's parts, for sentinel + length checks."""
    out: list[str] = []
    for part in getattr(message, "parts", []) or []:
        content = getattr(part, "content", None)
        if isinstance(content, str):
            out.append(content)
        elif isinstance(content, (list, tuple)):
            out.extend(c for c in content if isinstance(c, str))
    return "\n".join(out)


def _is_summary(message: ModelMessage) -> bool:
    return SENTINEL in _text_of(message)


def _estimate_tokens(ctx: RunContext | None, messages: list[ModelMessage]) -> int:
    usage = getattr(ctx, "usage", None)
    if usage is not None and getattr(usage, "input_tokens", 0):
        return usage.input_tokens
    chars = sum(len(_text_of(m)) for m in messages)
    return chars // _CHARS_PER_TOKEN


async def compact(ctx: RunContext, messages: list[ModelMessage]) -> list[ModelMessage]:
    """ProcessHistory hook: summarize old history when over budget, keep the tail.

    No-op (returns messages unchanged) when under budget, when there's nothing
    worth folding, or on any error — compaction must never break the turn.
    """
    try:
        if len(messages) <= _KEEP_TAIL + 1:
            return messages
        if _estimate_tokens(ctx, messages) < _TOKEN_BUDGET:
            return messages

        head, tail = messages[:-_KEEP_TAIL], messages[-_KEEP_TAIL:]
        # Already compacted and nothing new to fold in -> nothing to do.
        if all(_is_summary(m) for m in head):
            return messages

        transcript = "\n\n".join(t for t in (_text_of(m) for m in head) if t.strip())
        if not transcript.strip():
            return messages

        summarizer = Agent(build_model(load_settings()), instructions=_SUMMARY_INSTRUCTIONS)
        result = await summarizer.run(transcript)
        summary = (result.output or "").strip()
        if not summary:
            return messages

        if load_prefs().get("memory_enabled", True):
            try:
                memory.append_daily(f"[对话摘要] {summary}")
            except Exception:
                pass

        synthetic = ModelRequest(parts=[UserPromptPart(content=f"{SENTINEL}\n{summary}")])
        return [synthetic, *tail]
    except Exception:
        # Any failure (model down, parsing, etc.) falls back to the raw history.
        return messages
