"""The 生成笔记 flow: distill selected chat messages into a structured Markdown
note via the active LLM, with a local fallback so saving a conversation never
hard-fails. The user reviews/edits the draft before it is saved as a note."""
import asyncio
import re

from .agent.providers import build_model
from .config import load_settings

_SYSTEM = """你是笔记整理助手。把给定的对话内容提炼成一篇结构化的 Markdown 笔记。
第一行用一级标题写出这篇笔记的真实标题(例如「# 知识库技术选型」,不要写「# 标题」这种占位词)。
正文严格使用以下小节:
## 摘要
## 关键内容
## 决策/结论
## 后续行动
## 来源
要点凝练、以用户第一人称陈述事实;某个小节确实没有内容就写"(无)"。只输出 Markdown 笔记本身,不要任何额外解释。"""

_TOOL_LINE = re.compile(
    r"^\s*(已调用工具|工具调用|Tool call|read_file|write_file|edit_file|append_file"
    r"|execute_shell_command|grep_search|glob_search|knowledge_search)\b"
)
_FENCE = re.compile(r"^```(?:markdown|md)?\s*\n(.*)\n```\s*$", re.S)
_TIMEOUT = 20.0


def _clean(text: str) -> str:
    return "\n".join(ln for ln in text.splitlines() if not _TOOL_LINE.match(ln)).strip()


def _entries_text(entries: list[dict]) -> str:
    parts = []
    for e in entries:
        who = "我" if e.get("role") == "user" else "助手"
        body = _clean(e.get("text", ""))[:4000]
        if body:
            parts.append(f"【{who}】{body}")
    return "\n\n".join(parts)


def _title_of(body: str, fallback: str) -> str:
    for line in body.splitlines():
        m = re.match(r"^#\s+(.*)", line)
        if m and m.group(1).strip():
            return m.group(1).strip()
    return fallback


def _local_draft(entries: list[dict], topic: str) -> dict:
    title = topic or "对话笔记"
    body = (
        f"# {title}\n\n## 摘要\n(待补充)\n\n## 关键内容\n{_entries_text(entries)}\n\n"
        f"## 决策/结论\n(无)\n\n## 后续行动\n(无)\n\n## 来源\n来自一次对话。"
    )
    return {"title": title, "body": body, "used_model": False, "fallback_reason": "model_unavailable"}


async def draft_note(entries: list[dict], topic: str = "", title: str = "") -> dict:
    """Returns {title, body, used_model, fallback_reason}. Never raises."""
    src = _entries_text(entries)
    if not src:
        return {"title": title or "空笔记", "body": "# 空笔记\n\n(没有可用内容)", "used_model": False, "fallback_reason": "empty"}

    s = load_settings()
    if s.provider == "test" or not s.api_key:
        return _local_draft(entries, topic)
    try:
        from pydantic_ai import Agent

        agent = Agent(build_model(s), instructions=_SYSTEM)
        prompt = (f"主题提示:{topic}\n\n" if topic else "") + f"对话内容:\n{src}"
        res = await asyncio.wait_for(agent.run(prompt), timeout=_TIMEOUT)
        out = res.output if isinstance(res.output, str) else str(res.output)
        m = _FENCE.match(out.strip())
        body = (m.group(1) if m else out).strip()
        if not body:
            return _local_draft(entries, topic)
        return {"title": title or _title_of(body, topic or "对话笔记"), "body": body, "used_model": True, "fallback_reason": None}
    except Exception:  # noqa: BLE001 — any model failure/timeout -> never lose the save
        return _local_draft(entries, topic)
