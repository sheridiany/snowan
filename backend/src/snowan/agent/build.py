from pydantic_ai import Agent, DeferredToolRequests, Tool
from pydantic_ai.capabilities import ProcessHistory

from .. import memory
from .compaction import compact
from .. import skills as skills_store
from ..config import load_prefs, load_settings
from .providers import build_model, cache_settings
from .tools.file_tools import append_file, edit_file, read_file, write_file
from .tools.calendar_tools import upcoming_events
from .tools.knowledge_tools import knowledge_search
from .tools.memory_tools import recall_memory, remember
from .tools.search_tools import glob_search, grep_search
from .tools.shell_tools import execute_shell_command
from .tools.skill_tools import create_skill, load_skill, read_skill_resource
from .tools.time_tools import get_current_time
from .tools.web_tools import web_fetch, web_search

INSTRUCTIONS = """You are Snowan, a local-first personal AI assistant and knowledge \
workbench. Be concise and direct. Use tools when they help; otherwise just answer."""

# Read-only tools are safe to auto-run; mutating + shell tools change the user's
# machine. The approval_mode preference decides which get gated.
READONLY_FNS = [
    get_current_time,
    read_file,
    grep_search,
    glob_search,
    knowledge_search,
    upcoming_events,
    recall_memory,
    # remember writes a memory entry, but it's a cheap, expected action ("记一下") with
    # full oversight in the 记忆 panel + audit log, so it auto-runs rather than gating.
    remember,
    web_search,
    web_fetch,
    load_skill,
    read_skill_resource,
]
MUTATING_FNS = [write_file, edit_file, append_file, execute_shell_command, create_skill]


def _first_line(fn) -> str:
    return (fn.__doc__ or "").strip().split("\n")[0]


def tool_catalog() -> list[dict]:
    """The agent's tools for the settings UI: name, one-line description, mutating, enabled."""
    disabled = set(load_prefs().get("disabled_tools") or [])
    return [
        {"name": f.__name__, "description": _first_line(f), "mutating": False, "enabled": f.__name__ not in disabled}
        for f in READONLY_FNS
    ] + [
        {"name": f.__name__, "description": _first_line(f), "mutating": True, "enabled": f.__name__ not in disabled}
        for f in MUTATING_FNS
    ]


def _instructions(prefs: dict) -> str:
    text = INSTRUCTIONS
    p = prefs.get("profile") or {}
    bits = []
    if p.get("name"):
        bits.append(f"- 称呼: {p['name']}")
    if p.get("location"):
        bits.append(f"- 所在地: {p['location']}")
    if p.get("notes"):
        bits.append(f"- 备注: {p['notes']}")
    if bits:
        text += "\n\n关于用户(用于个性化你的回答):\n" + "\n".join(bits)
    if prefs.get("system_prompt"):
        text += "\n\n附加指令:\n" + prefs["system_prompt"]
    enabled = skills_store.enabled_skills()
    if enabled:
        text += (
            "\n\n可用技能(与当前任务相关时,先调用 load_skill(name) 读取完整步骤再按它执行):\n"
            + "\n".join(f"- {s['name']}: {s['description']}" for s in enabled)
        )
    if prefs.get("memory_enabled", True):
        profile = memory.profile_text()
        if profile:
            text += "\n\n## 用户长期画像(稳定信息,优先遵循)\n" + profile
        text += (
            "\n\n关于长期记忆:涉及用户的长期偏好/身份/过往决定/项目事实时,先用 recall_memory 查证;"
            "当用户让你「记一下」或你发现值得长期记住的事实时,用 remember 记录(别记一次性琐事或敏感信息)。"
        )
    return text


def build_agent() -> Agent:
    """Tools are gated per the approval_mode preference:
    auto = nothing gated · ask = mutating/shell gated · strict = every tool gated.

    `instructions` is kept byte-stable across turns so the Anthropic system+tools
    prefix stays cacheable — per-turn dynamic context (retrieved memory) rides in the
    user message instead (server/chat.py)."""
    prefs = load_prefs()
    mode = prefs.get("approval_mode", "ask")
    disabled = set(prefs.get("disabled_tools") or [])
    if not prefs.get("memory_enabled", True):  # paused: drop the memory tools too
        disabled |= {"remember", "recall_memory"}
    readonly = [f for f in READONLY_FNS if f.__name__ not in disabled]
    mutating = [f for f in MUTATING_FNS if f.__name__ not in disabled]
    if mode == "strict":
        tools = [Tool(f, requires_approval=True) for f in (*readonly, *mutating)]
    elif mode == "auto":
        tools = [*readonly, *mutating]
    else:  # ask
        tools = [*readonly, *(Tool(f, requires_approval=True) for f in mutating)]
    # MCP toolsets are NOT attached here — they're entered resiliently per chat run
    # (server/chat.py) so one failed server can't break the whole turn.
    settings = load_settings()
    return Agent(
        build_model(settings),
        instructions=_instructions(prefs),
        tools=tools,
        output_type=[str, DeferredToolRequests],
        capabilities=[ProcessHistory(compact)],  # summarize long histories per-request
        model_settings=cache_settings(settings),  # cache the stable prefix (Anthropic)
    )
