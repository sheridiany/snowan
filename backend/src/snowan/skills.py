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

from . import vault
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
    fm, body = vault.split_frontmatter(raw)
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
    """Seed + re-sync built-in skills from source. A new built-in appears; a shipped
    built-in whose SKILL.md changed is re-synced so improvements reach existing users
    (built-ins are managed — to customize one, fork it under a new name); a deleted
    built-in reappears. Per-skill enabled state lives in the manifest, so re-syncing
    never flips what's on/off."""
    SKILLS_DIR.mkdir(parents=True, exist_ok=True)
    if not _BUILTIN.exists():
        return
    for src in _BUILTIN.iterdir():
        if not (src.is_dir() and (src / "SKILL.md").exists()):
            continue
        dst = SKILLS_DIR / src.name
        synced = dst / "SKILL.md"
        if synced.exists() and synced.read_text(encoding="utf-8") == (src / "SKILL.md").read_text(encoding="utf-8"):
            continue
        if dst.exists():
            shutil.rmtree(dst)
        shutil.copytree(src, dst)


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
            "source": meta.get("source"),
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


# --- importing skills from other agents (Claude Code / shared ~/.agents) ---------
# Same SKILL.md format, so _parse() reads them directly. Imported skills are copied
# into our own store disabled, so they never flood the agent until the user opts in.
_EXTERNAL_ROOTS = [
    (Path.home() / ".claude" / "skills", "claude"),
    (Path.home() / ".agents" / "skills", "agents"),
    (Path.home() / ".codex" / "skills", "codex"),
]


def discover_external() -> list[dict]:
    """Scan known external agent-skill dirs for importable SKILL.md skills. Dedupe by
    resolved target (~/.claude/skills usually symlinks into ~/.agents/skills) and flag
    ones already present in our own store."""
    have = {s["name"] for s in list_skills()}
    seen: set[str] = set()
    out: list[dict] = []
    for root, source in _EXTERNAL_ROOTS:
        if not root.exists():
            continue
        for d in sorted(root.iterdir()):
            try:
                if not (d.is_dir() and (d / "SKILL.md").exists()):
                    continue
                real = str((d / "SKILL.md").resolve())
            except OSError:
                continue
            if real in seen:
                continue
            seen.add(real)
            s = _parse(d)
            if not s:
                continue
            out.append({
                "name": s["name"],
                "description": s["description"],
                "source": source,
                "path": str(d),
                "already": s["name"] in have,
            })
    return out


def _under_external_root(p: Path) -> bool:
    try:
        rp = p.resolve()
    except OSError:
        return False
    for root, _ in _EXTERNAL_ROOTS:
        try:
            r = root.resolve()
        except OSError:
            continue
        if rp == r or r in rp.parents:
            return True
    return False


def import_external(paths: list[str]) -> list[dict]:
    """Copy selected external skill folders into our store, disabled by default. Only
    paths under a known external root are accepted; existing skills are never clobbered."""
    _ensure_starters()
    man = _manifest()
    imported: list[dict] = []
    for raw in paths:
        src = Path(raw)
        if not _under_external_root(src):
            continue
        real = src.resolve()
        if not (real.is_dir() and (real / "SKILL.md").exists()):
            continue
        s = _parse(real)
        if not s:
            continue
        dst = SKILLS_DIR / _slug(s["name"])
        if dst.exists():
            continue
        shutil.copytree(real, dst)
        meta = man.setdefault(s["name"], {"tags": []})
        meta["enabled"] = False
        meta["source"] = "imported"
        imported.append({"name": s["name"], "description": s["description"], "enabled": False})
    if imported:
        _save_manifest(man)
    return imported


def read_resource(name: str, rel: str) -> str | None:
    d = _find_dir(name)
    if d is None:
        return None
    root = d.resolve()
    target = (d / rel).resolve()
    # Real ancestor check, not a string prefix — a sibling like `<skill>-secrets/`
    # would pass startswith() and escape the skill folder.
    if target != root and root not in target.parents:
        return None
    try:
        return target.read_text(encoding="utf-8")
    except OSError:
        return None
