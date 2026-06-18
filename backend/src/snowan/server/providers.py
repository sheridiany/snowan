"""AI-engine API: providers, their models, the active selection, plus network
helpers (connection test, /v1/models discovery, vision probe)."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from .. import config

router = APIRouter(prefix="/api/providers")

# A 32x32 solid-red PNG used to probe whether a model can actually see images.
_RED_PNG = (
    "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAOklEQVR4nO3RQREAQAjDwHJC8C8K"
    "MSchfPhlBZSZUNOdS+90PR5Y8AfIRMhEyETIRMhEyETIRMhEIR/SgAFY1t5YwgAAAABJRU5ErkJggg=="
)
_RED_KW = ("red", "scarlet", "crimson", "vermilion", "maroon", "红")


class ConfigPatch(BaseModel):
    name: str | None = None
    base_url: str | None = None
    api_key: str | None = None


class CustomBody(BaseModel):
    name: str
    base_url: str
    api_key: str | None = None


class ModelBody(BaseModel):
    id: str
    name: str | None = None


class ModelRef(BaseModel):
    model_id: str


class ModelRename(BaseModel):
    model_id: str
    name: str


class ActiveBody(BaseModel):
    provider: str
    model: str


def _require(pid: str) -> dict:
    cfg = config.get_provider(pid)
    if cfg is None:
        raise HTTPException(404, f"未知提供商: {pid}")
    return cfg


def _openai_client(s: config.Settings):
    from openai import AsyncOpenAI

    return AsyncOpenAI(api_key=s.api_key or "missing", base_url=s.base_url or None)


# --- CRUD ------------------------------------------------------------------

@router.get("")
def list_providers() -> dict:
    return config.list_state()


@router.put("/{pid}/config")
def configure(pid: str, patch: ConfigPatch) -> dict:
    _require(pid)
    config.configure_provider(pid, name=patch.name, base_url=patch.base_url, api_key=patch.api_key)
    return config.list_state()


@router.post("/custom")
def create_custom(body: CustomBody) -> dict:
    return {"id": config.create_custom(body.name, body.base_url, body.api_key)}


@router.delete("/{pid}")
def delete(pid: str) -> dict:
    config.delete_provider(pid)
    return config.list_state()


@router.post("/{pid}/models")
def add_model(pid: str, body: ModelBody) -> dict:
    _require(pid)
    return config.add_model(pid, body.id, body.name)


@router.post("/{pid}/models/delete")
def delete_model(pid: str, ref: ModelRef) -> dict:
    config.delete_model(pid, ref.model_id)
    return config.list_state()


@router.post("/{pid}/models/rename")
def rename_model(pid: str, body: ModelRename) -> dict:
    config.rename_model(pid, body.model_id, body.name)
    return config.list_state()


@router.put("/active")
def set_active(body: ActiveBody) -> dict:
    config.set_active(body.provider, body.model)
    return config.list_state()


# --- network ---------------------------------------------------------------

@router.post("/{pid}/discover")
async def discover(pid: str) -> dict:
    cfg = _require(pid)
    if cfg["kind"] not in ("openai", "custom"):
        raise HTTPException(400, "该提供商不支持自动发现(仅 OpenAI 兼容端点)")
    client = _openai_client(config.provider_settings(pid))
    try:
        resp = await client.models.list()
    except Exception as e:  # noqa: BLE001 — surface the upstream error to the UI
        raise HTTPException(400, f"发现失败: {e}") from e
    before = {m["id"] for m in cfg.get("models", [])}
    for m in resp.data:
        mid = getattr(m, "id", None)
        if mid:
            config.add_model(pid, mid)
    updated = _require(pid)["models"]
    added = [m for m in updated if m["id"] not in before]
    return {"added": added, "total": len(updated)}


async def _run_ping(s: config.Settings) -> tuple[bool, str]:
    from pydantic_ai import Agent

    from ..agent.providers import build_model

    try:
        agent = Agent(build_model(s))
        await agent.run("ping")
        return True, "连接成功"
    except Exception as e:  # noqa: BLE001
        return False, str(e)[:300]


@router.post("/{pid}/test")
async def test_provider(pid: str) -> dict:
    cfg = _require(pid)
    models = cfg.get("models", [])
    if not models:
        return {"ok": False, "message": "请先添加一个模型再测试"}
    ok, msg = await _run_ping(config.provider_settings(pid, models[0]["id"]))
    return {"ok": ok, "message": msg}


@router.post("/{pid}/models/test")
async def test_model(pid: str, ref: ModelRef) -> dict:
    _require(pid)
    ok, msg = await _run_ping(config.provider_settings(pid, ref.model_id))
    return {"ok": ok, "message": msg}


@router.post("/{pid}/models/probe")
async def probe_vision(pid: str, ref: ModelRef) -> dict:
    cfg = _require(pid)
    if cfg["kind"] not in ("openai", "custom"):
        v = config.guess_vision(ref.model_id)
        config.set_model_vision(pid, ref.model_id, v, "heuristic")
        return {"vision": v, "message": "该类型暂用启发式判断"}
    client = _openai_client(config.provider_settings(pid))
    try:
        resp = await client.chat.completions.create(
            model=ref.model_id,
            max_tokens=20,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "What is the single dominant color of this image? Reply with ONLY the color name."},
                        {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{_RED_PNG}"}},
                    ],
                }
            ],
        )
        answer = (resp.choices[0].message.content or "").lower().strip()
        vision = any(k in answer for k in _RED_KW)
        config.set_model_vision(pid, ref.model_id, vision, "probed")
        verdict = "支持视觉" if vision else "未识别图像"
        return {"vision": vision, "message": f"检测完成:{verdict}(回答:{answer[:40]})"}
    except Exception as e:  # noqa: BLE001 — a rejected image request implies no vision
        config.set_model_vision(pid, ref.model_id, False, "probed")
        return {"vision": False, "message": f"图像请求失败,判定为不支持视觉:{str(e)[:160]}"}
