"""Serve a file generated into the workspace (a deck, a chart, an export) so the
frontend can preview an image inline and download any artifact. Path-traversal is
refused at the workspace boundary."""
from urllib.parse import quote

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

from ..workspace import resolve_in_workspace

router = APIRouter()


@router.get("/api/workspace/file")
def workspace_file(path: str = Query(...), download: bool = False) -> FileResponse:
    """Serve a workspace file inline (so <img> can load a chart); `download=1` forces a
    save-as with the original filename (RFC 5987, so CJK names survive)."""
    try:
        p = resolve_in_workspace(path)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="bad path") from exc
    if not p.is_file():
        raise HTTPException(status_code=404, detail="not found")
    headers = (
        {"Content-Disposition": f"attachment; filename*=UTF-8''{quote(p.name)}"} if download else {}
    )
    return FileResponse(p, headers=headers)
