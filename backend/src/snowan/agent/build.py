from pydantic_ai import Agent, DeferredToolRequests, Tool

from ..config import load_settings
from .providers import build_model
from .tools.file_tools import append_file, edit_file, read_file, write_file
from .tools.search_tools import glob_search, grep_search
from .tools.shell_tools import execute_shell_command
from .tools.time_tools import get_current_time

INSTRUCTIONS = """You are Snowan, a local-first personal AI assistant and knowledge \
workbench. Be concise and direct. Use tools when they help; otherwise just answer."""

# Read-only tools run automatically; mutating + shell tools require human approval.
READONLY_TOOLS = [get_current_time, read_file, grep_search, glob_search]
GUARDED_TOOLS = [
    Tool(write_file, requires_approval=True),
    Tool(edit_file, requires_approval=True),
    Tool(append_file, requires_approval=True),
    Tool(execute_shell_command, requires_approval=True),
]


def build_agent() -> Agent:
    model = build_model(load_settings())
    return Agent(
        model,
        instructions=INSTRUCTIONS,
        tools=[*READONLY_TOOLS, *GUARDED_TOOLS],
        output_type=[str, DeferredToolRequests],
    )
