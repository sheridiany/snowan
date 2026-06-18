import json
import os
import re
import uuid
from dataclasses import dataclass
from pathlib import Path

# App data dir (outside the repo). Holds config.json with the API keys.
SNOWAN_HOME = Path(os.getenv("SNOWAN_HOME", Path.home() / ".snowan"))
CONFIG_PATH = SNOWAN_HOME / "config.json"

# Built-in providers (always present). kind drives the model backend in providers.py.
BUILTIN: dict[str, dict] = {
    "anthropic": {"kind": "anthropic", "name": "Anthropic", "base_url": None},
    "openai": {"kind": "openai", "name": "OpenAI", "base_url": None},
    "google": {"kind": "google", "name": "Google Gemini", "base_url": None},
}

# A few well-known models seeded per built-in provider so the list isn't empty.
SEED_MODELS: dict[str, list[tuple[str, str]]] = {
    "anthropic": [
        ("claude-sonnet-4-5", "Claude Sonnet 4.5"),
        ("claude-opus-4-1", "Claude Opus 4.1"),
        ("claude-3-5-haiku-latest", "Claude Haiku 3.5"),
    ],
    "openai": [("gpt-4o", "GPT-4o"), ("gpt-4o-mini", "GPT-4o mini"), ("o3", "o3")],
    "google": [
        ("gemini-2.0-flash", "Gemini 2.0 Flash"),
        ("gemini-1.5-pro", "Gemini 1.5 Pro"),
    ],
}

# Model-id substrings that imply (no) vision. Used to auto-judge a model on add
# before any real probe.
_VISION_HINTS = (
    "gpt-4o", "gpt-4.1", "gpt-5", "o1", "o3", "o4", "vision", "4-vision",
    "claude-3", "claude-4", "claude-opus-4", "claude-sonnet-4", "claude-haiku-4",
    "gemini", "llama-3.2", "llava", "qwen-vl", "qwen2-vl", "qwen2.5-vl", "pixtral", "internvl",
)
_TEXT_HINTS = ("gpt-3.5", "text-", "-instruct-text", "embedding", "whisper", "tts", "moderation")


def guess_vision(model_id: str) -> bool | None:
    """Heuristic vision capability from the model id. None = unknown."""
    m = model_id.lower()
    if any(h in m for h in _TEXT_HINTS):
        return False
    if any(h in m for h in _VISION_HINTS):
        return True
    return None


@dataclass
class Settings:
    provider: str = "test"
    model: str = ""
    api_key: str | None = None
    base_url: str | None = None


def _model(model_id: str, name: str | None = None) -> dict:
    return {
        "id": model_id,
        "name": name or model_id,
        "vision": guess_vision(model_id),
        "probe": "heuristic",
    }


# --- store -----------------------------------------------------------------

def _read() -> dict:
    if not CONFIG_PATH.exists():
        return {}
    try:
        return json.loads(CONFIG_PATH.read_text())
    except (json.JSONDecodeError, OSError):
        return {}


def _write(data: dict) -> None:
    SNOWAN_HOME.mkdir(parents=True, exist_ok=True)
    CONFIG_PATH.write_text(json.dumps(data, indent=2))
    try:
        CONFIG_PATH.chmod(0o600)  # holds secrets
    except OSError:
        pass


def _migrate(data: dict) -> dict:
    """Upgrade older shapes to {active: {provider, model}, providers: {...}}."""
    providers = data.get("providers")
    # Oldest flat shape: {provider, model, api_key, base_url}
    if providers is None and "provider" in data:
        pid = data["provider"]
        providers = {
            pid: {
                "kind": "custom" if pid not in BUILTIN else pid,
                "name": BUILTIN.get(pid, {}).get("name", "自定义"),
                "base_url": data.get("base_url"),
                "api_key": data.get("api_key"),
                "models": [_model(data["model"])] if data.get("model") else [],
            }
        }
        data = {"active": {"provider": pid, "model": data.get("model", "")}, "providers": providers}
        providers = data["providers"]
    # Intermediate per-provider shape where entries lacked kind/name/models.
    for pid, cfg in (providers or {}).items():
        cfg.setdefault("kind", "custom" if pid not in BUILTIN else pid)
        cfg.setdefault("name", BUILTIN.get(pid, {}).get("name", "自定义"))
        cfg.setdefault("base_url", None)
        if "models" not in cfg:
            mid = cfg.pop("model", "")
            cfg["models"] = [_model(mid)] if mid else []
    if isinstance(data.get("active"), str):
        pid = data["active"]
        first = (providers or {}).get(pid, {}).get("models", [])
        data["active"] = {"provider": pid, "model": first[0]["id"] if first else ""}
    data.setdefault("active", {"provider": None, "model": ""})
    data["providers"] = providers or {}
    return data


def _load() -> dict:
    """Read config, migrate, and ensure the 3 built-in providers exist (seeded)."""
    data = _migrate(_read())
    providers = data["providers"]
    for pid, meta in BUILTIN.items():
        if pid not in providers:
            providers[pid] = {
                **meta,
                "api_key": None,
                "models": [_model(mid, name) for mid, name in SEED_MODELS.get(pid, [])],
            }
    return data


def load_settings() -> Settings:
    """The active provider+model resolved for the chat agent (env is the fallback)."""
    data = _load()
    active = data.get("active") or {}
    pid = active.get("provider")
    cfg = data["providers"].get(pid, {}) if pid else {}
    return Settings(
        provider=cfg.get("kind") or os.getenv("SNOWAN_PROVIDER", "test").lower(),
        model=active.get("model") or os.getenv("SNOWAN_MODEL", ""),
        api_key=cfg.get("api_key") or os.getenv("SNOWAN_API_KEY") or None,
        base_url=cfg.get("base_url") or os.getenv("SNOWAN_BASE_URL") or None,
    )


# --- mutations (used by the providers router) ------------------------------

def list_state() -> dict:
    """Full state with keys masked — safe to send to the client."""
    data = _load()
    return {
        "active": data["active"],
        "providers": [
            {
                "id": pid,
                "kind": cfg.get("kind"),
                "name": cfg.get("name"),
                "base_url": cfg.get("base_url"),
                "is_custom": cfg.get("kind") == "custom",
                "has_api_key": bool(cfg.get("api_key")),
                "models": cfg.get("models", []),
            }
            for pid, cfg in data["providers"].items()
        ],
    }


def get_provider(pid: str) -> dict | None:
    return _load()["providers"].get(pid)


def configure_provider(pid: str, *, name=None, base_url=None, api_key=None) -> None:
    data = _load()
    cfg = data["providers"].setdefault(pid, {"kind": "custom", "models": []})
    if name is not None:
        cfg["name"] = name
    if base_url is not None:
        cfg["base_url"] = base_url or None
    if api_key:
        cfg["api_key"] = api_key
    _write(data)


def create_custom(name: str, base_url: str, api_key: str | None) -> str:
    data = _load()
    pid = f"custom:{uuid.uuid4().hex[:8]}"
    data["providers"][pid] = {
        "kind": "custom",
        "name": name or "自定义端点",
        "base_url": base_url or None,
        "api_key": api_key or None,
        "models": [],
    }
    _write(data)
    return pid


def delete_provider(pid: str) -> None:
    data = _load()
    if pid in BUILTIN:
        # Don't remove a built-in; just clear its key.
        if pid in data["providers"]:
            data["providers"][pid]["api_key"] = None
    else:
        data["providers"].pop(pid, None)
        if data["active"].get("provider") == pid:
            data["active"] = {"provider": None, "model": ""}
    _write(data)


def add_model(pid: str, model_id: str, name: str | None = None) -> dict:
    data = _load()
    cfg = data["providers"].get(pid)
    if cfg is None:
        raise KeyError(pid)
    models = cfg.setdefault("models", [])
    existing = next((m for m in models if m["id"] == model_id), None)
    if existing:
        return existing
    m = _model(model_id, name)
    models.append(m)
    _write(data)
    return m


def delete_model(pid: str, model_id: str) -> None:
    data = _load()
    cfg = data["providers"].get(pid)
    if cfg:
        cfg["models"] = [m for m in cfg.get("models", []) if m["id"] != model_id]
        if data["active"] == {"provider": pid, "model": model_id}:
            data["active"] = {"provider": None, "model": ""}
        _write(data)


def set_model_vision(pid: str, model_id: str, vision: bool | None, probe: str) -> None:
    data = _load()
    for m in data["providers"].get(pid, {}).get("models", []):
        if m["id"] == model_id:
            m["vision"] = vision
            m["probe"] = probe
            break
    _write(data)


def set_active(pid: str, model_id: str) -> None:
    data = _load()
    if pid in data["providers"]:
        data["active"] = {"provider": pid, "model": model_id}
        _write(data)


def provider_settings(pid: str, model_id: str = "") -> Settings:
    """Resolve a Settings for a specific provider+model (used by test/probe)."""
    cfg = get_provider(pid) or {}
    return Settings(
        provider=cfg.get("kind", "custom"),
        model=model_id,
        api_key=cfg.get("api_key"),
        base_url=cfg.get("base_url"),
    )
