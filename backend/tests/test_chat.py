"""Loop-layer tests for the chat streaming generator: text deltas, tool calls,
approval gating, and mid-run steering (the active-run registry + /api/chat/steer).
Drives the SSE generators directly against a TestModel — no network."""
import asyncio
import json

import pytest
from pydantic_ai import Agent, DeferredToolRequests, Tool
from pydantic_ai.models.test import TestModel

from snowan import config
from snowan.agent.sessions import load_history
from snowan.server import chat


@pytest.fixture
def home(tmp_path, monkeypatch):
    """Point every module-level ~/.snowan path at a tmp dir so tests are hermetic."""
    monkeypatch.setattr(config, "SNOWAN_HOME", tmp_path)
    monkeypatch.setattr("snowan.agent.sessions.SESSIONS_DIR", tmp_path / "sessions")
    monkeypatch.setattr("snowan.usage.USAGE_PATH", tmp_path / "usage.jsonl")
    monkeypatch.setattr("snowan.audit.AUDIT_PATH", tmp_path / "audit.jsonl")
    return tmp_path


async def _collect(agen):
    return [c async for c in agen]


def _events(chunks: list[str]) -> list[dict]:
    evs = []
    for c in chunks:
        for line in c.splitlines():
            if line.startswith("data: "):
                evs.append(json.loads(line[6:]))
    return evs


def _run(agen) -> list[dict]:
    return _events(asyncio.run(_collect(agen)))


def test_text_stream(home, monkeypatch):
    agent = Agent(TestModel(call_tools=[]), output_type=[str, DeferredToolRequests])
    monkeypatch.setattr(chat, "build_agent", lambda skill=None: agent)
    evs = _run(chat._run_new("hi", [], "s1"))
    kinds = [e["type"] for e in evs]
    assert "delta" in kinds
    assert kinds[-1] == "done"
    assert load_history("s1")  # persisted
    assert "s1" not in chat._active_runs  # registry cleaned up


def test_tool_call_stream(home, monkeypatch):
    def ping() -> str:
        """ping"""
        return "pong"

    agent = Agent(TestModel(call_tools=["ping"]), output_type=[str, DeferredToolRequests], tools=[ping])
    monkeypatch.setattr(chat, "build_agent", lambda skill=None: agent)
    evs = _run(chat._run_new("go", [], "s2"))
    kinds = [e["type"] for e in evs]
    assert "tool_call" in kinds and "tool_result" in kinds
    assert "pong" in next(e for e in evs if e["type"] == "tool_result")["result"]
    assert kinds[-1] == "done"


def test_approval_required(home, monkeypatch):
    def danger() -> str:
        """danger"""
        return "did it"

    agent = Agent(
        TestModel(call_tools=["danger"]),
        output_type=[str, DeferredToolRequests],
        tools=[Tool(danger, requires_approval=True)],
    )
    monkeypatch.setattr(chat, "build_agent", lambda skill=None: agent)
    evs = _run(chat._run_new("do", [], "s3"))
    appr = next((e for e in evs if e["type"] == "approval_required"), None)
    assert appr and appr["calls"] and appr["calls"][0]["id"]


def test_skill_threads_to_build_agent(home, monkeypatch):
    seen: dict[str, str | None] = {}
    agent = Agent(TestModel(call_tools=[]), output_type=[str, DeferredToolRequests])

    def stub(skill=None):
        seen["skill"] = skill
        return agent

    monkeypatch.setattr(chat, "build_agent", stub)
    _run(chat._run_new("hi", [], "s9", skill="deep-research"))
    assert seen["skill"] == "deep-research"
    assert chat._session_skill.get("s9") == "deep-research"


def test_steer_endpoint(home):
    class FakeRun:
        def __init__(self):
            self.calls = []

        def enqueue(self, *content, priority="asap"):
            self.calls.append((content, priority))

    fake = FakeRun()
    chat._active_runs["s4"] = fake
    out = asyncio.run(chat.chat_steer(chat.SteerRequest(session_id="s4", message="also do X")))
    assert out["ok"] is True
    assert fake.calls == [(("also do X",), "asap")]
    chat._active_runs.pop("s4", None)
    # no active run -> not ok
    out2 = asyncio.run(chat.chat_steer(chat.SteerRequest(session_id="missing", message="x")))
    assert out2["ok"] is False
    # empty message -> not ok even with an active run
    chat._active_runs["s5"] = FakeRun()
    out3 = asyncio.run(chat.chat_steer(chat.SteerRequest(session_id="s5", message="   ")))
    assert out3["ok"] is False
    chat._active_runs.pop("s5", None)
