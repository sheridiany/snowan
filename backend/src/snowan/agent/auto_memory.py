"""Passive memory capture: after a turn, distill at most a few TERSE atomic facts
about the user (preferences, ongoing projects, identity, recurring concerns) into L2.

This is the "越用越懂你" capture loop — it runs without the user clicking 记一下.
Deliberately conservative: low importance + confidence + an `auto` origin so curated
memories outrank these and they decay faster; deduped against existing entries; fully
best-effort (never raises, never blocks the response). L3 profile is still never touched
automatically — promotion stays in the human-approved consolidation pass."""
from pydantic_ai import Agent

from .. import memory
from ..config import load_prefs, load_settings
from .providers import build_model
from .sessions import load_history

_TYPES = {"preference", "project", "fact", "person", "decision"}
_MAX_PER_TURN = 3
_MAX_LEN = 40  # facts must stay terse — short atomic lines, not summaries

_INSTRUCTIONS = (
    "你从一段对话里提炼关于【用户本人】的、值得长期记住的稳定信息"
    "(偏好习惯 / 正在做的项目 / 身份背景 / 反复出现的关注点 / 明确的决定)。\n"
    "硬性规则:\n"
    "- 每条一行,极简短(≤20 字),只写事实本身,不解释、不复述对话。\n"
    "- 最多 3 条;凡是一次性的闲聊、临时问题、通用知识都不要记。\n"
    "- 没有任何值得长期记的,只输出一个字: 无\n"
    "- 每行格式严格为  类型|事实  ,类型 ∈ preference/project/fact/person/decision\n"
    "示例:\npreference|偏好简洁、结果先行的回答\nproject|在做本地 AI 助手 Snowan"
)


def _text_of(message) -> str:
    out: list[str] = []
    for part in getattr(message, "parts", []) or []:
        c = getattr(part, "content", None)
        if isinstance(c, str):
            out.append(c)
        elif isinstance(c, (list, tuple)):
            out.extend(x for x in c if isinstance(x, str))
    return "\n".join(out)


def _recent_exchange(session_id: str) -> str:
    # The last few messages = the turn just finished. Drop our own injected blocks.
    msgs = load_history(session_id)[-4:]
    parts = []
    for m in msgs:
        t = _text_of(m).strip()
        if not t or t.startswith("[压缩摘要]") or t.startswith("<相关记忆>"):
            continue
        parts.append(t)
    return "\n\n".join(parts)[:6000]


def _is_dup(content: str, existing: list[str]) -> bool:
    c = content.strip().lower()
    return any(c == e or (len(c) > 6 and (c in e or e in c)) for e in existing)


async def capture(session_id: str) -> None:
    if not load_prefs().get("memory_enabled", True):
        return
    try:
        transcript = _recent_exchange(session_id)
        if len(transcript) < 20:
            return
        agent = Agent(build_model(load_settings()), instructions=_INSTRUCTIONS)
        out = ((await agent.run(transcript)).output or "").strip()
        if not out or out.replace("无", "").strip() == "":
            return
        existing = [m["content"].strip().lower() for m in memory._all_entries()]
        written = 0
        for line in out.splitlines():
            if written >= _MAX_PER_TURN or "|" not in line:
                continue
            kind, _, fact = line.partition("|")
            kind, fact = kind.strip().lower(), fact.strip()[:_MAX_LEN]
            if not fact or fact == "无" or _is_dup(fact, existing):
                continue
            memory.create_entry(
                fact,
                type=kind if kind in _TYPES else "fact",
                importance=2,
                confidence=0.5,
                source={"origin": "auto", "session": session_id},
            )
            existing.append(fact.lower())
            written += 1
    except Exception:
        pass  # capture is best-effort; never disturb the chat
