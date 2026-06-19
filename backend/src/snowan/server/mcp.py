"""MCP servers: list / add (form or paste-JSON) / enable / per-tool policy / remove
/ probe (connect + list a server's tools)."""
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

from .. import mcp as store
from ..agent.mcp import probe

router = APIRouter(prefix="/api/mcp")


class ServerForm(BaseModel):
    name: str
    command: str = ""
    args: list[str] = []
    env: dict = {}
    url: str = ""
    headers: dict = {}


class PasteBody(BaseModel):
    config: dict  # full {"mcpServers": {...}} or a single-entry object


class EnableBody(BaseModel):
    enabled: bool


class PolicyBody(BaseModel):
    tool: str
    policy: str  # ask | auto | off


@router.get("")
def list_servers() -> list[dict]:
    return store.list_servers()


@router.post("")
def add_server(req: ServerForm) -> dict:
    if not req.name.strip():
        raise HTTPException(422, "需要名称")
    if not (req.command.strip() or req.url.strip()):
        raise HTTPException(422, "stdio 需要命令,远程需要 URL")
    cfg = (
        {"command": req.command.strip(), "args": req.args, "env": req.env}
        if req.command.strip()
        else {"url": req.url.strip(), "headers": req.headers}
    )
    store.upsert_server(req.name.strip(), cfg)
    return {"ok": True}


@router.post("/paste")
def paste(req: PasteBody) -> dict:
    try:
        names = store.merge_paste(req.config)
    except ValueError as e:
        raise HTTPException(422, str(e))
    return {"ok": True, "names": names}


@router.patch("/{name}/enabled")
def set_enabled(name: str, req: EnableBody) -> dict:
    store.set_enabled(name, req.enabled)
    return {"ok": True}


@router.patch("/{name}/tool-policy")
def set_policy(name: str, req: PolicyBody) -> dict:
    try:
        store.set_tool_policy(name, req.tool, req.policy)
    except ValueError as e:
        raise HTTPException(422, str(e))
    return {"ok": True}


@router.delete("/{name}")
def remove(name: str) -> Response:
    store.remove_server(name)
    return Response(status_code=204)


@router.post("/{name}/probe")
async def probe_server(name: str) -> dict:
    return await probe(name)
