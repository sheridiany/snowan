from pydantic_ai import Agent

from ..config import load_settings
from .providers import build_model
from .tools.time_tools import get_current_time

INSTRUCTIONS = """You are Snowan, a local-first personal AI assistant and knowledge \
workbench. Be concise and direct. Use tools when they help; otherwise just answer."""


def build_agent() -> Agent:
    model = build_model(load_settings())
    return Agent(model, instructions=INSTRUCTIONS, tools=[get_current_time])
