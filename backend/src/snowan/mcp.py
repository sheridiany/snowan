"""MCP server store at ~/.snowan/mcp.json. The on-disk shape IS the Claude Code /
Cursor `{"mcpServers": {...}}` format, so a config pasted from any docs works
verbatim — with two Snowan-only keys per server: `enabled` (bool) and `tools`
(per-tool policy: "ask" | "auto" | "off"). Those are stripped before the config
reaches the pydantic-ai loader."""
import json

from .config import SNOWAN_HOME

MCP_PATH = SNOWAN_HOME / "mcp.json"
_EXT_KEYS = ("enabled", "tools")  # Snowan extensions, not part of the MCP config


def _load() -> dict:
    if not MCP_PATH.exists():
        return {"mcpServers": {}}
    try:
        d = json.loads(MCP_PATH.read_text())
    except (json.JSONDecodeError, OSError):
        return {"mcpServers": {}}
    d.setdefault("mcpServers", {})
    return d


def _save(d: dict) -> None:
    SNOWAN_HOME.mkdir(parents=True, exist_ok=True)
    MCP_PATH.write_text(json.dumps(d, ensure_ascii=False, indent=2))


def _transport(cfg: dict) -> str:
    return "http" if cfg.get("url") else "stdio"


def list_servers() -> list[dict]:
    """Server summaries for the settings UI (full config included — local app)."""
    out = []
    for name, cfg in _load()["mcpServers"].items():
        out.append({
            "name": name,
            "transport": _transport(cfg),
            "enabled": cfg.get("enabled", True),
            "command": cfg.get("command", ""),
            "args": cfg.get("args", []),
            "env": cfg.get("env", {}) or {},
            "url": cfg.get("url", ""),
            "headers": cfg.get("headers", {}) or {},
            "tools": cfg.get("tools", {}) or {},
        })
    return out


def get_server(name: str) -> dict | None:
    return _load()["mcpServers"].get(name)


def _clean(cfg: dict) -> dict:
    """A server config without Snowan extension keys (command/args/env or url/headers)."""
    return {k: v for k, v in cfg.items() if k not in _EXT_KEYS}


def upsert_server(name: str, cfg: dict) -> None:
    """Add or replace a server's config, preserving its enabled flag + tool policy."""
    d = _load()
    existing = d["mcpServers"].get(name, {})
    merged = _clean(cfg)
    merged["enabled"] = cfg.get("enabled", existing.get("enabled", True))
    merged["tools"] = existing.get("tools", {})  # keep policy across edits
    d["mcpServers"][name] = merged
    _save(d)


def merge_paste(blob: dict) -> list[str]:
    """Import a pasted config: either a full {"mcpServers": {...}} object or a single
    server entry under one key. Returns the names added/updated."""
    servers = blob.get("mcpServers", blob)
    if not isinstance(servers, dict):
        raise ValueError("无法识别的 MCP 配置")
    names = []
    for name, cfg in servers.items():
        if not isinstance(cfg, dict) or not (cfg.get("command") or cfg.get("url")):
            continue
        upsert_server(name, cfg)
        names.append(name)
    if not names:
        raise ValueError("没有找到有效的服务器(需要 command 或 url)")
    return names


def set_enabled(name: str, enabled: bool) -> None:
    d = _load()
    if name in d["mcpServers"]:
        d["mcpServers"][name]["enabled"] = enabled
        _save(d)


def set_tool_policy(name: str, tool: str, policy: str) -> None:
    if policy not in ("ask", "auto", "off"):
        raise ValueError("policy must be ask|auto|off")
    d = _load()
    if name in d["mcpServers"]:
        d["mcpServers"][name].setdefault("tools", {})[tool] = policy
        _save(d)


def remove_server(name: str) -> None:
    d = _load()
    if d["mcpServers"].pop(name, None) is not None:
        _save(d)


def enabled_servers() -> list[tuple[str, dict]]:
    """(name, clean-config-with-tools-policy) for each enabled server — for the loader."""
    out = []
    for name, cfg in _load()["mcpServers"].items():
        if cfg.get("enabled", True):
            out.append((name, cfg))
    return out
