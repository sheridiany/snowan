"""Shared vault primitives for the Markdown-file stores (knowledge / memory / skills).

The stores each keep their own frontmatter field mapping (those genuinely differ),
but the mechanics of splitting frontmatter, slugifying a filename, and picking a
free deduped filename are identical and live here. The vault is the source of truth;
these helpers must stay behavior-preserving."""
import re
from collections.abc import Callable
from pathlib import Path

import yaml

_ILLEGAL = re.compile(r'[\\/:*?"<>|\n\r\t]+')


def split_frontmatter(raw: str) -> tuple[dict, str]:
    """Split a Markdown file's `---` YAML frontmatter from its body. Returns
    ({} , raw) when there's no well-formed frontmatter; a malformed YAML block
    yields {} but the body still strips past the closing `---`."""
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
    return fm, body


def slugify(text: str, maxlen: int, fallback: str) -> str:
    """Filesystem-safe slug from arbitrary text (illegal chars → space, whitespace
    collapsed, trimmed to maxlen). Unicode is preserved — the vault is human-readable."""
    s = re.sub(r"\s+", " ", _ILLEGAL.sub(" ", text)).strip()[:maxlen].strip()
    return s or fallback


def dedup_path(directory: Path, base: str, doc_id: str, parse: Callable[[Path], dict | None]) -> Path:
    """Free filename for `base` under `directory`: `<base>.md`, then `-2`, `-3`, …
    A collision whose existing doc has the same `doc_id` is the doc's own file, so
    return it (an in-place update keeps its filename)."""
    p = directory / f"{base}.md"
    n = 2
    while p.exists():
        existing = parse(p)
        if existing and existing["id"] == doc_id:
            return p
        p = directory / f"{base}-{n}.md"
        n += 1
    return p
