"""Image-generation API: resolve the active (or requested) provider+model, call
the cloud image API, and persist each result as a PNG under the artifacts dir.
The frontend keeps the session/library state locally; the backend only owns the
image bytes (generate, serve, delete, copy-for-library)."""
import base64
import re
import struct
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from .. import config

router = APIRouter(prefix="/api/imagegen")

_ID_RE = re.compile(r"^[0-9a-f]{32}$")  # uuid4().hex shape produced by _save


def _dir() -> Path:
    # Resolved per call so a test's monkeypatched SNOWAN_HOME is honored.
    return config.SNOWAN_HOME / "artifacts" / "imagegen"


def _path(image_id: str) -> Path:
    # Body-driven endpoints (/files/delete, /copy) pass ids that bypass routing,
    # so reject anything that isn't a bare _save() id to block path traversal.
    if not _ID_RE.fullmatch(image_id):
        raise HTTPException(400, "无效的图像 ID")
    return _dir() / f"{image_id}.png"


def _save(data: bytes) -> str:
    _dir().mkdir(parents=True, exist_ok=True)
    image_id = uuid.uuid4().hex
    _path(image_id).write_bytes(data)
    return image_id


def _png_dims(data: bytes) -> tuple[int | None, int | None]:
    # PNG: 8-byte signature, then an IHDR chunk whose width/height are big-endian
    # uint32 at offsets 16 and 20. Non-PNG bytes -> unknown dims.
    if len(data) < 24 or data[:8] != b"\x89PNG\r\n\x1a\n":
        return None, None
    width, height = struct.unpack(">II", data[16:24])
    return width, height


class GenerateBody(BaseModel):
    prompt: str
    size: str = "auto"
    n: int = 1
    provider: str | None = None
    model: str | None = None
    # Optional reference images (data URLs or bare base64). When present we route
    # to the image-edit endpoint instead of plain text-to-image.
    reference_images: list[str] = []


class IdsBody(BaseModel):
    ids: list[str]


_MAX_N = 4  # one generation request yields at most 4 images
_EXT = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp"}


def _resolve(body: GenerateBody) -> config.Settings:
    if body.provider and body.model:
        return config.provider_settings(body.provider, body.model)
    s = config.image_settings()
    if not s.model:
        raise HTTPException(400, "未配置图像生成模型,请先在设置中选择")
    return s


def _decode_refs(refs: list[str]) -> list[tuple[bytes, str]]:
    """Decode reference images (data URL or bare base64) to (bytes, mime)."""
    out: list[tuple[bytes, str]] = []
    for r in refs:
        mime, b64 = "image/png", r
        if r.startswith("data:"):
            head, _, b64 = r.partition(",")
            mime = head[5:].split(";", 1)[0] or mime
        out.append((base64.b64decode(b64), mime))
    return out


async def _collect(data) -> list[bytes]:
    """Image bytes from an OpenAI image response: prefer inline b64, else fetch the
    provider-returned url — but only after an SSRF check, and with redirects disabled
    so the url can't bounce to a private/metadata address."""
    from ..agent.tools.web_tools import _is_public

    out: list[bytes] = []
    for img in data or []:
        if getattr(img, "b64_json", None):
            out.append(base64.b64decode(img.b64_json))
        elif getattr(img, "url", None):
            import httpx

            if not _is_public(img.url):
                raise HTTPException(400, "图像下载地址不是公网地址,已拒绝")
            async with httpx.AsyncClient(timeout=60, follow_redirects=False) as c:
                resp = await c.get(img.url)
                resp.raise_for_status()
                out.append(resp.content)
    return out


def _openai_client(s: config.Settings):
    from openai import AsyncOpenAI

    return AsyncOpenAI(api_key=s.api_key or "missing", base_url=s.base_url or None)


async def _openai_generate(s, prompt, size, n) -> tuple[list[bytes], str | None]:
    client = _openai_client(s)
    # gpt-image returns b64 and rejects response_format; dall-e needs it for b64.
    kwargs = {} if "gpt-image" in (s.model or "") else {"response_format": "b64_json"}
    resp = await client.images.generate(model=s.model, prompt=prompt, size=size, n=n, **kwargs)
    revised = next((i.revised_prompt for i in (resp.data or []) if i.revised_prompt), None)
    return await _collect(resp.data), revised


async def _openai_edit(s, prompt, size, n, refs) -> tuple[list[bytes], str | None]:
    """Reference-image generation via the images.edit endpoint."""
    client = _openai_client(s)
    files = [
        (f"reference_{i}{_EXT.get(mime, '.png')}", data, mime)
        for i, (data, mime) in enumerate(refs)
    ]
    image_arg = files if len(files) > 1 else files[0]
    kwargs = {} if "gpt-image" in (s.model or "") else {"response_format": "b64_json"}
    resp = await client.images.edit(
        model=s.model, image=image_arg, prompt=prompt, size=size, n=n, **kwargs
    )
    return await _collect(resp.data), None


def _google_generate(s, prompt, refs) -> tuple[list[bytes], str | None]:
    from google.genai import Client
    from google.genai import types

    client = Client(api_key=s.api_key)
    contents: list = [prompt]
    for data, mime in refs:
        contents.append(types.Part.from_bytes(data=data, mime_type=mime))
    resp = client.models.generate_content(
        model=s.model,
        contents=contents,
        config=types.GenerateContentConfig(response_modalities=["IMAGE"]),
    )
    images: list[bytes] = []
    for candidate in resp.candidates or []:
        for part in (candidate.content.parts if candidate.content else []) or []:
            if part.inline_data and part.inline_data.data:
                images.append(part.inline_data.data)
    return images, None


@router.post("/generate")
async def generate(body: GenerateBody) -> dict:
    s = _resolve(body)
    if s.provider == "anthropic":
        raise HTTPException(400, "Anthropic 不支持图像生成,请选择其他模型")
    n = max(1, min(_MAX_N, body.n))
    refs = _decode_refs(body.reference_images)
    try:
        if s.provider == "google":
            raw, revised = _google_generate(s, body.prompt, refs)
        elif refs:
            raw, revised = await _openai_edit(s, body.prompt, body.size, n, refs)
        else:
            raw, revised = await _openai_generate(s, body.prompt, body.size, n)
    except Exception as e:  # noqa: BLE001 — surface the upstream error to the UI
        raise HTTPException(400, f"图像生成失败: {e}") from e
    images = []
    for data in raw:
        image_id = _save(data)
        width, height = _png_dims(data)
        images.append({"id": image_id, "width": width, "height": height})
    return {"images": images, "revised_prompt": revised}


@router.get("/file/{image_id}")
def get_file(image_id: str) -> FileResponse:
    p = _path(image_id)
    if not p.exists():
        raise HTTPException(404, "图像不存在")
    return FileResponse(p, media_type="image/png")


@router.delete("/file/{image_id}")
def delete_file(image_id: str) -> dict:
    _path(image_id).unlink(missing_ok=True)
    return {"ok": True}


@router.post("/file/{image_id}/copy")
def copy_file(image_id: str) -> dict:
    src = _path(image_id)
    if not src.exists():
        raise HTTPException(404, "图像不存在")
    new_id = _save(src.read_bytes())
    return {"id": new_id}


@router.post("/files/delete")
def delete_files(body: IdsBody) -> dict:
    for image_id in body.ids:
        _path(image_id).unlink(missing_ok=True)
    return {"ok": True}
