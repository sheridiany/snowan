"""Per-session agent message history, persisted to disk so context survives a
backend restart. Serialized with PydanticAI's ModelMessagesTypeAdapter."""
import re

from pydantic_ai.messages import ModelMessage, ModelMessagesTypeAdapter

from ..config import SNOWAN_HOME

SESSIONS_DIR = SNOWAN_HOME / "sessions"
_SAFE = re.compile(r"[^A-Za-z0-9_-]")


def _path(session_id: str):
    return SESSIONS_DIR / f"{_SAFE.sub('_', session_id)}.json"


def load_history(session_id: str) -> list[ModelMessage]:
    p = _path(session_id)
    if not p.exists():
        return []
    try:
        return list(ModelMessagesTypeAdapter.validate_json(p.read_bytes()))
    except Exception:  # noqa: BLE001 — a corrupt/old file just starts fresh
        return []


def save_history(session_id: str, messages: list[ModelMessage]) -> None:
    SESSIONS_DIR.mkdir(parents=True, exist_ok=True)
    _path(session_id).write_bytes(ModelMessagesTypeAdapter.dump_json(messages))


def delete_history(session_id: str) -> None:
    _path(session_id).unlink(missing_ok=True)
