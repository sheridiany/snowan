from pydantic_ai import Agent, DeferredToolRequests, Tool

from .. import skills as skills_store
from ..config import load_prefs, load_settings
from .mcp import build_toolsets
from .providers import build_model
from .tools.file_tools import append_file, edit_file, read_file, write_file
from .tools.knowledge_tools import knowledge_search
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
    web_search,
    web_fetch,
    load_skill,
    read_skill_resource,
]
MUTATING_FNS = [write_file, edit_file, append_file, execute_shell_command, create_skill]


def _first_line(fn) -> str:
    return (fn.__doc__ or "").strip().split("\n")[0]


def tool_catalog() -> list[dict]:
    """The agent's tools for the settings UI: name, one-line description, mutating."""
    return [
        {"name": f.__name__, "description": _first_line(f), "mutating": False}
        for f in READONLY_FNS
    ] + [
        {"name": f.__name__, "description": _first_line(f), "mutating": True}
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
    return text


def build_agent() -> Agent:
    """Tools are gated per the approval_mode preference:
    auto = nothing gated · ask = mutating/shell gated · strict = every tool gated."""
    prefs = load_prefs()
    mode = prefs.get("approval_mode", "ask")
    if mode == "strict":
        tools = [Tool(f, requires_approval=True) for f in (*READONLY_FNS, *MUTATING_FNS)]
    elif mode == "auto":
        tools = [*READONLY_FNS, *MUTATING_FNS]
    else:  # ask
        tools = [*READONLY_FNS, *(Tool(f, requires_approval=True) for f in MUTATING_FNS)]
    return Agent(
        build_model(load_settings()),
        instructions=_instructions(prefs),
        tools=tools,
        toolsets=build_toolsets(),  # enabled MCP servers, per-tool policy applied
        output_type=[str, DeferredToolRequests],
    )
