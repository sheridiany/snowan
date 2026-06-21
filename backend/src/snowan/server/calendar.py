"""Calendar capture API: list local calendar sources + events, force-sync the
macOS system Calendar (read-only, via AppleScript — no OAuth/EventKit), and import
an .ics file. The system calendar already aggregates the user's iCloud/Gmail/Outlook
accounts locally, so reading it is enough to see everything."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from .. import calendar as store

router = APIRouter(prefix="/api/calendar")


class ImportIcsBody(BaseModel):
    source_name: str = "导入日历"
    ics_text: str


@router.get("/sources")
def list_sources() -> dict:
    """Cached sources + events, no sync."""
    return store.list_calendar()


@router.post("/sync-system")
def sync_system() -> dict:
    """Force-read the macOS system Calendar and refresh the cache."""
    return store.sync_system_calendar(force=True)


@router.post("/import-ics")
def import_ics(req: ImportIcsBody) -> dict:
    if not req.ics_text.strip():
        raise HTTPException(422, "需要 ICS 内容")
    return store.import_ics(req.ics_text, req.source_name.strip() or "导入日历")
