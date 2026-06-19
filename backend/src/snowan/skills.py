"""Agent skills: each skill is a folder ~/.snowan/skills/<name>/ with a SKILL.md
(YAML frontmatter `name` + `description`, then a markdown body) — the portable
Claude / Claude Code format. A skills.json manifest holds per-skill {enabled, tags}
so toggling a skill never rewrites its file.

Progressive disclosure: enabled skills' name + description are injected into the
agent instructions (level 1, build.py); `load_skill(name)` returns the full body on
demand (level 2); `read_skill_resource(skill, path)` reads a bundled file (level 3).
Built-in starter skills are copied in on first run."""
import json
import re
import shutil
from pathlib import Path

import yaml

from .config import SNOWAN_HOME

SKILLS_DIR = SNOWAN_HOME / "skills"
MANIFEST = SKILLS_DIR / "skills.json"
_BUILTIN = Path(__file__).parent / "skills_builtin"
_ILLEGAL = re.compile(r"[^a-zA-Z0-9_-]+")


def _slug(name: str) -> str:
    s = _ILLEGAL.sub("-", name.strip()).strip("-").lower()
    return s or "skill"


def _parse(skill_dir: Path) -> dict | None:
    md = skill_dir / "SKILL.md"
    try:
        raw = md.read_text(encoding="utf-8")
    except OSError:
        return None
    fm: dict = {}
    body = raw
    if raw.startswith("---"):
        end = raw.find("\n---", 3)
        if end != -1:
            try:
                fm = yaml.safe_load(raw[3:end]) or {}
            except yaml.YAMLError:
                fm = {}
            body = raw[end + 4 :].lstrip("\n")
    if not isinstance(fm, dict):
        fm = {}
    return {
        "name": str(fm.get("name") or skill_dir.name),
        "description": str(fm.get("description") or ""),
        "body": body,
        "dir": skill_dir,
    }


def _manifest() -> dict:
    try:
        return json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {}
    except (json.JSONDecodeError, OSError):
        return {}


def _save_manifest(m: dict) -> None:
    SKILLS_DIR.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(m, ensure_ascii=False, indent=2))


def _ensure_starters() -> None:
    """Copy built-in starter skills on first run (when the vault doesn't exist)."""
    if SKILLS_DIR.exists() or not _BUILTIN.exists():
        SKILLS_DIR.mkdir(parents=True, exist_ok=True)
        return
    shutil.copytree(_BUILTIN, SKILLS_DIR)


def _find_dir(name: str) -> Path | None:
    _ensure_starters()
    for d in SKILLS_DIR.iterdir() if SKILLS_DIR.exists() else []:
        if d.is_dir() and (d / "SKILL.md").exists():
            s = _parse(d)
            if s and (s["name"] == name or d.name == name):
                return d
    return None


def list_skills() -> list[dict]:
    _ensure_starters()
    man = _manifest()
    out = []
    for d in sorted(SKILLS_DIR.iterdir()) if SKILLS_DIR.exists() else []:
        if not (d.is_dir() and (d / "SKILL.md").exists()):
            continue
        s = _parse(d)
        if not s:
            continue
        meta = man.get(s["name"], {})
        out.append({
            "name": s["name"],
            "description": s["description"],
            "enabled": meta.get("enabled", True),
            "tags": meta.get("tags", []),
        })
    return out


def get_skill(name: str) -> dict | None:
    d = _find_dir(name)
    if d is None:
        return None
    s = _parse(d)
    if s is None:
        return None
    meta = _manifest().get(s["name"], {})
    return {"name": s["name"], "description": s["description"], "body": s["body"], "enabled": meta.get("enabled", True)}


def enabled_skills() -> list[dict]:
    """name + description of enabled skills — injected into the agent instructions."""
    return [{"name": s["name"], "description": s["description"]} for s in list_skills() if s["enabled"]]


def _serialize(name: str, description: str, body: str) -> str:
    fm = yaml.safe_dump({"name": name, "description": description}, allow_unicode=True, sort_keys=False).strip()
    return f"---\n{fm}\n---\n\n{body.strip()}\n"


def create_skill(name: str, description: str, body: str) -> dict:
    _ensure_starters()
    d = SKILLS_DIR / _slug(name)
    d.mkdir(parents=True, exist_ok=True)
    (d / "SKILL.md").write_text(_serialize(name, description, body), encoding="utf-8")
    man = _manifest()
    man.setdefault(name, {"enabled": True, "tags": []})
    _save_manifest(man)
    return {"name": name, "description": description, "body": body, "enabled": True}


def update_skill(name: str, *, description: str | None = None, body: str | None = None) -> dict | None:
    d = _find_dir(name)
    if d is None:
        return None
    s = _parse(d)
    if s is None:
        return None
    desc = description if description is not None else s["description"]
    new_body = body if body is not None else s["body"]
    (d / "SKILL.md").write_text(_serialize(s["name"], desc, new_body), encoding="utf-8")
    return get_skill(name)


def delete_skill(name: str) -> bool:
    d = _find_dir(name)
    if d is None:
        return False
    shutil.rmtree(d, ignore_errors=True)
    man = _manifest()
    if man.pop(name, None) is not None:
        _save_manifest(man)
    return True


def set_enabled(name: str, enabled: bool) -> None:
    man = _manifest()
    man.setdefault(name, {"tags": []})["enabled"] = enabled
    _save_manifest(man)


def read_resource(name: str, rel: str) -> str | None:
    d = _find_dir(name)
    if d is None:
        return None
    target = (d / rel).resolve()
    if not str(target).startswith(str(d.resolve())):  # no path escape
        return None
    try:
        return target.read_text(encoding="utf-8")
    except OSError:
        return None
