"""Build pydantic-ai toolsets from the MCP server store, applying the per-tool
policy: "off" tools are filtered out, "ask" tools require approval (folding into
Snowan's existing DeferredToolRequests flow), "auto" tools run. Each server's tools
are prefixed with the server name to avoid cross-server collisions. Also a `probe`
that connects to a server and lists its tools for the settings UI."""
from .. import mcp as store
from ..config import load_prefs

# Below this many known MCP tools (across enabled servers), sending every schema each
# turn is cheap. Above it, defer their loading so the auto-injected ToolSearch capability
# surfaces them on demand instead of bloating + churning the cached prompt prefix.
_DEFER_THRESHOLD = 10


def _build_one(name: str, cfg: dict):
    from pydantic_ai.mcp import MCPServerStdio, MCPServerStreamableHTTP

    if cfg.get("url"):
        return MCPServerStreamableHTTP(url=cfg["url"], headers=cfg.get("headers") or None)
    return MCPServerStdio(
        command=cfg["command"],
        args=cfg.get("args") or [],
        env=cfg.get("env") or None,
        cwd=cfg.get("cwd"),
    )


def build_toolsets() -> list:
    """One toolset per enabled server, with the per-tool policy + name prefix. When the
    enabled servers expose many tools in total, defer their loading so they're discovered
    via tool search rather than bloating (and churning) the cached prompt prefix."""
    mode = load_prefs().get("approval_mode", "ask")
    servers = list(store.enabled_servers())
    defer = sum(len(cfg.get("tools") or {}) for _, cfg in servers) > _DEFER_THRESHOLD
    toolsets = []
    for name, cfg in servers:
        policy = cfg.get("tools") or {}
        try:
            server = _build_one(name, cfg)
        except Exception:  # noqa: BLE001 — a malformed server config shouldn't break the agent
            continue

        def keep(ctx, td, _p=policy) -> bool:
            return _p.get(td.name, "ask") != "off"

        def needs_approval(ctx, td, args, _p=policy) -> bool:
            return True if mode == "strict" else _p.get(td.name, "ask") != "auto"

        ts = server.filtered(keep).approval_required(needs_approval).prefixed(name)
        if defer:
            ts = ts.defer_loading()  # all tools → surfaced via tool search on demand
        toolsets.append(ts)
    return toolsets


async def probe(name: str) -> dict:
    """Connect to a server and list its tools — for the settings UI status + policy."""
    cfg = store.get_server(name)
    if cfg is None:
        return {"ok": False, "error": "未找到服务器"}
    try:
        server = _build_one(name, cfg)
        async with server:
            tools = await server.list_tools()
        return {
            "ok": True,
            "tools": [{"name": t.name, "description": (t.description or "")[:200]} for t in tools],
        }
    except Exception as e:  # noqa: BLE001 — surface connection failure to the UI, don't crash
        return {"ok": False, "error": f"{type(e).__name__}: {e}"}
