"""Agent skills: list / get / create / update / enable / delete."""
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

from .. import skills as store

router = APIRouter(prefix="/api/skills")


class SkillCreate(BaseModel):
    name: str
    description: str = ""
    body: str = ""


class SkillUpdate(BaseModel):
    description: str | None = None
    body: str | None = None


class EnableBody(BaseModel):
    enabled: bool


class ImportBody(BaseModel):
    paths: list[str]


@router.get("")
def list_skills() -> list[dict]:
    return store.list_skills()


# Registered before /{name} so "external" isn't captured as a skill name.
@router.get("/external")
def list_external() -> list[dict]:
    return store.discover_external()


@router.post("/import")
def import_external(req: ImportBody) -> dict:
    return {"imported": store.import_external(req.paths)}


@router.get("/{name}")
def get_skill(name: str) -> dict:
    s = store.get_skill(name)
    if s is None:
        raise HTTPException(404, "未找到技能")
    return s


@router.post("")
def create(req: SkillCreate) -> dict:
    if not req.name.strip() or not req.body.strip():
        raise HTTPException(422, "需要名称和内容")
    return store.create_skill(req.name.strip(), req.description, req.body)


@router.put("/{name}")
def update(name: str, req: SkillUpdate) -> dict:
    s = store.update_skill(name, description=req.description, body=req.body)
    if s is None:
        raise HTTPException(404, "未找到技能")
    return s


@router.patch("/{name}/enabled")
def set_enabled(name: str, req: EnableBody) -> dict:
    store.set_enabled(name, req.enabled)
    return {"ok": True}


@router.delete("/{name}")
def remove(name: str) -> Response:
    if not store.delete_skill(name):
        raise HTTPException(404, "未找到技能")
    return Response(status_code=204)
