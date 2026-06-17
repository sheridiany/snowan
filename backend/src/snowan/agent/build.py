from pydantic_ai import Agent

from ..config import load_settings
from .providers import build_model
from .tools.file_tools import read_file
from .tools.search_tools import glob_search, grep_search
from .tools.time_tools import get_current_time

INSTRUCTIONS = """You are Snowan, a local-first personal AI assistant and knowledge \
workbench. Be concise and direct. Use tools when they help; otherwise just answer."""

TOOLS = [get_current_time, read_file, grep_search, glob_search]


def build_agent() -> Agent:
    model = build_model(load_settings())
    return Agent(model, instructions=INSTRUCTIONS, tools=TOOLS)
