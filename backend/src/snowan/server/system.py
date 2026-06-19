"""Tools catalog, app preferences, and about/diagnostics."""
import subprocess

from fastapi import APIRouter
from pydantic import BaseModel

from .. import audit, config
from ..agent.build import tool_catalog

router = APIRouter()

APP_VERSION = "0.1.0"


class PrefsPatch(BaseModel):
    approval_mode: str | None = None
    max_iters: int | None = None
    timezone: str | None = None
    auto_title: bool | None = None
    system_prompt: str | None = None
    profile: dict | None = None
    web_search_provider: str | None = None
    tavily_api_key: str | None = None
    brave_api_key: str | None = None
    jina_api_key: str | None = None
    disabled_tools: list[str] | None = None


@router.get("/api/tools")
def list_tools() -> list[dict]:
    return tool_catalog()


@router.get("/api/audit")
def audit_log(limit: int = 100) -> list[dict]:
    """Recent tool calls (newest first) for the 权限 audit view."""
    return audit.recent(limit)


@router.get("/api/prefs")
def get_prefs() -> dict:
    return config.load_prefs()


@router.put("/api/prefs")
def put_prefs(patch: PrefsPatch) -> dict:
    return config.save_prefs(patch.model_dump(exclude_none=True))


@router.get("/api/about")
def about() -> dict:
    s = config.load_settings()
    return {
        "version": APP_VERSION,
        "data_dir": str(config.SNOWAN_HOME),
        "provider": s.provider,
        "model": s.model,
        "has_api_key": bool(s.api_key),
    }


@router.post("/api/about/open-data-dir")
def open_data_dir() -> dict:
    config.SNOWAN_HOME.mkdir(parents=True, exist_ok=True)
    subprocess.Popen(["open", str(config.SNOWAN_HOME)])
    return {"ok": True}
