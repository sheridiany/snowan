"""Local-folder knowledge source: register folders and ingest their files into
the shared index as source_type='file'. Files become searchable — keyword now,
semantic once the embedding model is downloaded. Re-indexing is explicit (on add /
remove / a reindex action), not a live watcher, and runs in a background thread so
the request returns immediately."""
import hashlib
import json
import threading
from datetime import datetime, timezone
from pathlib import Path

from . import knowledge_index
from .config import SNOWAN_HOME
from .extract import extract_file

FOLDERS_PATH = SNOWAN_HOME / "knowledge" / "folders.json"

_MAX_BYTES = 1_000_000  # skip files larger than ~1MB
_MAX_FILES = 600  # cap total files indexed across all folders
_TEXT_EXT = {
    ".md", ".markdown", ".txt", ".text", ".rst", ".org", ".csv", ".tsv", ".json",
    ".yaml", ".yml", ".toml", ".ini", ".log", ".py", ".js", ".ts", ".tsx", ".jsx",
    ".java", ".go", ".rs", ".c", ".h", ".cpp", ".cc", ".sh", ".html", ".css",
    ".scss", ".sql", ".xml", ".vue", ".php", ".rb", ".kt", ".swift",
}
_DOC_EXT = {".pdf", ".docx", ".xlsx", ".xlsm", ".pptx"}
_SUPPORTED = _TEXT_EXT | _DOC_EXT
_SKIP_DIRS = {
    ".git", "node_modules", ".venv", "venv", "__pycache__", ".idea", ".vscode",
    "dist", "build", ".next", ".cache", "target",
}

_indexing = False
_lock = threading.Lock()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _mtime_iso(ts: float) -> str:
    return datetime.fromtimestamp(ts, timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _load() -> dict:
    if not FOLDERS_PATH.exists():
        return {"version": 1, "folders": []}
    try:
        d = json.loads(FOLDERS_PATH.read_text())
    except (json.JSONDecodeError, OSError):
        return {"version": 1, "folders": []}
    d.setdefault("folders", [])
    return d


def _save(d: dict) -> None:
    FOLDERS_PATH.parent.mkdir(parents=True, exist_ok=True)
    FOLDERS_PATH.write_text(json.dumps(d, ensure_ascii=False, indent=2))


def is_indexing() -> bool:
    return _indexing


def list_folders() -> dict:
    folders = _load()["folders"]
    counts: dict[str, int] = {}
    for r in knowledge_index.file_docs():
        uri = r["uri"] or ""
        for f in folders:
            if uri == f["path"] or uri.startswith(f["path"].rstrip("/") + "/"):
                counts[f["id"]] = counts.get(f["id"], 0) + 1
                break
    return {
        "folders": [
            {"id": f["id"], "path": f["path"], "file_count": counts.get(f["id"], 0)}
            for f in folders
        ],
        "indexing": _indexing,
    }


def _scan() -> list[dict]:
    docs: list[dict] = []
    for f in _load()["folders"]:
        root = Path(f["path"])
        if not root.is_dir():
            continue
        for path in sorted(root.rglob("*")):
            if len(docs) >= _MAX_FILES:
                break
            if not path.is_file() or path.name.startswith("."):
                continue
            rel_parents = path.relative_to(root).parts[:-1]
            if any(part in _SKIP_DIRS or part.startswith(".") for part in rel_parents):
                continue
            if path.suffix.lower() not in _SUPPORTED:
                continue
            try:
                if path.stat().st_size > _MAX_BYTES:
                    continue
            except OSError:
                continue
            text = extract_file(path)
            if not text or not text.strip():
                continue
            abspath = str(path.resolve())
            ts = path.stat().st_mtime
            docs.append({
                "id": "file_" + hashlib.sha1(abspath.encode()).hexdigest()[:16],
                "source_type": "file",
                "title": path.name,
                "uri": abspath,
                "body": text,
                "created_at": _mtime_iso(ts),
                "updated_at": _mtime_iso(ts),
            })
    return docs


def reindex() -> None:
    knowledge_index.reconcile("file", _scan())


def reindex_async() -> None:
    global _indexing
    with _lock:
        if _indexing:
            return
        _indexing = True

    def run() -> None:
        global _indexing
        try:
            reindex()
        finally:
            _indexing = False

    threading.Thread(target=run, daemon=True).start()


def add_folder(path: str) -> dict:
    p = Path(path).expanduser()
    if not p.is_dir():
        raise ValueError("not a directory")
    abspath = str(p.resolve())
    d = _load()
    if not any(f["path"] == abspath for f in d["folders"]):
        d["folders"].append(
            {"id": "fld_" + hashlib.sha1(abspath.encode()).hexdigest()[:12], "path": abspath, "added_at": _now()}
        )
        _save(d)
    reindex_async()
    return list_folders()


def remove_folder(folder_id: str) -> dict:
    d = _load()
    d["folders"] = [f for f in d["folders"] if f["id"] != folder_id]
    _save(d)
    reindex_async()  # reconciles to the remaining folders, pruning the removed one's files
    return list_folders()
