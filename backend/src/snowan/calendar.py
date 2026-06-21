"""Local-first calendar capture: read the macOS *system* Calendar (which already
aggregates the user's iCloud / Gmail / Outlook accounts on-device) via AppleScript,
plus ICS text import. NO OAuth, NO EventKit/pyobjc — just `osascript`.

Events live in a single JSON store (~/.snowan/calendar.json) and, after every
sync/import, are mirrored into the shared hybrid index as source_type='calendar'
so the agent can semantic-search them alongside notes/files. Indexing is gated so
a failing index never breaks a sync.

Permission note: the first system read triggers the macOS Automation/Calendar TCC
prompt. We therefore sync ONLY on explicit user action — never at app launch."""
import hashlib
import json
import re
import shutil
import subprocess
import sys
from datetime import datetime, timedelta, timezone

from . import knowledge_index
from .config import SNOWAN_HOME

CALENDAR_PATH = SNOWAN_HOME / "calendar.json"

_SYSTEM_SOURCE_ID = "calendar_source_system_macos"
_THROTTLE = timedelta(minutes=5)
_HORIZON_DAYS = 90  # how far ahead the system read looks


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _stable_id(prefix: str, value: str) -> str:
    digest = hashlib.sha256(value.strip().lower().encode("utf-8")).hexdigest()[:24]
    return f"{prefix}_{digest}"


# --- store -----------------------------------------------------------------

def _load() -> dict:
    if not CALENDAR_PATH.exists():
        return {"version": 1, "sources": [], "events": []}
    try:
        d = json.loads(CALENDAR_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError, UnicodeDecodeError):
        return {"version": 1, "sources": [], "events": []}
    d.setdefault("sources", [])
    d.setdefault("events", [])
    return d


def _save(d: dict) -> None:
    CALENDAR_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = CALENDAR_PATH.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(d, ensure_ascii=False, indent=2), encoding="utf-8")
    shutil.move(str(tmp), str(CALENDAR_PATH))


# --- ICS parsing (ported from QwenPaw) -------------------------------------

def _clean_ics_text(value: str) -> str:
    return value.replace("\\n", "\n").replace("\\,", ",").replace("\\;", ";").strip()


def _unfold_ics_lines(text: str) -> list[str]:
    lines: list[str] = []
    for raw in text.replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        if raw.startswith((" ", "\t")) and lines:
            lines[-1] += raw[1:]
        else:
            lines.append(raw.strip())
    return lines


def _field_name(line: str) -> str:
    return line.split(":", 1)[0].split(";", 1)[0].upper()


def _field_value(line: str) -> str:
    return _clean_ics_text(line.split(":", 1)[1]) if ":" in line else ""


def _field_param(line: str, name: str) -> str:
    head = line.split(":", 1)[0]
    match = re.search(rf"(?:^|;){re.escape(name)}=([^;:]+)", head, flags=re.I)
    return _clean_ics_text(match.group(1)) if match else ""


def _parse_ics_datetime(value: str) -> str:
    raw = value.strip()
    if not raw:
        return _now()
    if raw.endswith("Z"):
        dt = datetime.strptime(raw, "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc)
        return dt.isoformat().replace("+00:00", "Z")
    if "T" in raw:
        dt = datetime.strptime(raw[:15], "%Y%m%dT%H%M%S")
        return dt.replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")
    dt = datetime.strptime(raw[:8], "%Y%m%d").replace(tzinfo=timezone.utc)
    return dt.isoformat().replace("+00:00", "Z")


def _parse_ics_events(text: str, source_id: str, source_name: str, now: str) -> list[dict]:
    events: list[dict] = []
    current: dict[str, list[str]] | None = None
    for line in _unfold_ics_lines(text):
        if line.upper() == "BEGIN:VEVENT":
            current = {}
            continue
        if line.upper() == "END:VEVENT":
            if current:
                uid = (current.get("UID") or [""])[0]
                title = (current.get("SUMMARY") or ["未命名日程"])[0] or "未命名日程"
                starts_at = _parse_ics_datetime((current.get("DTSTART") or [""])[0])
                ends_value = (current.get("DTEND") or [""])[0]
                if ends_value:
                    ends_at = _parse_ics_datetime(ends_value)
                else:
                    ends_at = (
                        datetime.fromisoformat(starts_at.replace("Z", "+00:00"))
                        + timedelta(hours=1)
                    ).isoformat().replace("+00:00", "Z")
                event_id = _stable_id("calendar_event", uid or f"{source_id}:{title}:{starts_at}")
                events.append({
                    "id": event_id,
                    "sourceId": source_id,
                    "title": title,
                    "startsAt": starts_at,
                    "endsAt": ends_at,
                    "calendarName": source_name,
                    "location": (current.get("LOCATION") or [""])[0],
                    "notes": (current.get("DESCRIPTION") or [""])[0],
                    "attendees": current.get("ATTENDEE") or [],
                    "url": (current.get("URL") or [""])[0],
                    "updatedAt": now,
                })
            current = None
            continue
        if current is None or ":" not in line:
            continue
        name = _field_name(line)
        value = _field_value(line)
        if name == "ATTENDEE":
            value = _field_param(line, "CN") or value.removeprefix("mailto:")
        current.setdefault(name, []).append(value)
    return events


# --- macOS system calendar via AppleScript (ported from QwenPaw) ------------

def _date_parts_to_iso(value: str) -> str:
    parts = [int(part) for part in value.split(",")]
    if len(parts) != 6:
        return _now()
    return datetime(parts[0], parts[1], parts[2], parts[3], parts[4], parts[5]).astimezone().isoformat()


_APPLESCRIPT = r"""
on scrub(value)
  set textValue to value as text
  set AppleScript's text item delimiters to character id 31
  set textValue to text items of textValue
  set AppleScript's text item delimiters to " "
  set textValue to textValue as text
  set AppleScript's text item delimiters to linefeed
  set textValue to text items of textValue
  set AppleScript's text item delimiters to " "
  return textValue as text
end scrub

on dateParts(value)
  return ((year of value as integer) as text) & "," & ((month of value as integer) as text) & "," & ((day of value as integer) as text) & "," & ((hours of value as integer) as text) & "," & ((minutes of value as integer) as text) & "," & ((seconds of value as integer) as text)
end dateParts

set startDate to current date
set endDate to startDate + (%d * days)
set outputRows to ""
tell application "Calendar"
  repeat with calendarItem in calendars
    set calendarName to name of calendarItem as text
    set matchedEvents to (every event of calendarItem whose start date is greater than startDate and start date is less than endDate)
    repeat with eventItem in matchedEvents
      set eventUid to ""
      set eventLocation to ""
      set eventNotes to ""
      set eventUrl to ""
      try
        set eventUid to uid of eventItem as text
      end try
      try
        set eventLocation to location of eventItem as text
      end try
      try
        set eventNotes to description of eventItem as text
      end try
      try
        set eventUrl to url of eventItem as text
      end try
      set outputRows to outputRows & my scrub(calendarName) & (character id 31) & my scrub(eventUid) & (character id 31) & my scrub(summary of eventItem) & (character id 31) & my dateParts(start date of eventItem) & (character id 31) & my dateParts(end date of eventItem) & (character id 31) & my scrub(eventLocation) & (character id 31) & my scrub(eventNotes) & (character id 31) & my scrub(eventUrl) & linefeed
    end repeat
  end repeat
end tell
return outputRows
"""


def _read_macos_calendar_events(now: str) -> list[dict] | None:
    """Read the system Calendar via osascript. Returns a list of event dicts, [] when
    empty, or None on failure (no Calendar access / osascript error) — the caller maps
    None to a clear sync error rather than crashing."""
    script = _APPLESCRIPT % _HORIZON_DAYS
    # Wake Calendar in the background (-gj) so the AppleScript bridge is live.
    subprocess.run(
        ["open", "-gj", "-a", "Calendar"],
        capture_output=True, check=False, text=True, timeout=10,
    )
    completed = subprocess.run(
        ["osascript", "-e", script],
        capture_output=True, check=False, text=True, timeout=60,
    )
    if completed.returncode != 0:
        return None
    if not completed.stdout.strip():
        return []
    events: list[dict] = []
    for line in completed.stdout.splitlines():
        fields = line.split(chr(31))
        if len(fields) != 8:
            continue
        calendar_name, uid, title, starts_raw, ends_raw, location, notes, url = [
            "" if field == "missing value" else field for field in fields
        ]
        starts_at = _date_parts_to_iso(starts_raw)
        event_id = _stable_id(
            "calendar_event", f"system:macos:{uid or calendar_name}:{title}:{starts_at}"
        )
        events.append({
            "id": event_id,
            "sourceId": _SYSTEM_SOURCE_ID,
            "title": title or "未命名日程",
            "startsAt": starts_at,
            "endsAt": _date_parts_to_iso(ends_raw),
            "calendarName": calendar_name,
            "location": location,
            "notes": notes,
            "attendees": [],
            "url": url,
            "updatedAt": now,
        })
    return events


# --- KB index mirror -------------------------------------------------------

def _index_events(events: list[dict]) -> None:
    """Mirror all stored events into the shared hybrid index as source_type='calendar'.
    reconcile prunes events that disappeared from the store. Best-effort: a failing
    index must never break a sync/import."""
    docs = []
    for e in events:
        body = "\n".join(
            part for part in [
                e["title"],
                f"{e['startsAt']}–{e['endsAt']}",
                e.get("location", ""),
                e.get("notes", ""),
            ] if part
        )
        docs.append({
            "id": e["id"],
            "source_type": "calendar",
            "title": e["title"],
            "uri": e.get("url") or e["id"],
            "body": body,
            "created_at": e.get("startsAt", ""),
            "updated_at": e.get("updatedAt", ""),
        })
    try:
        knowledge_index.reconcile("calendar", docs)
    except Exception:  # noqa: BLE001 — indexing is a nice-to-have, never the sync's blocker
        pass


# --- public API ------------------------------------------------------------

def list_calendar() -> dict:
    """Stored sources + events (events sorted by start), for the UI. Read-only, no sync."""
    d = _load()
    events = sorted(d["events"], key=lambda e: e.get("startsAt", ""))
    return {"sources": d["sources"], "events": events, "syncStatus": "idle", "syncError": ""}


def sync_system_calendar(force: bool = False) -> dict:
    """Read the macOS system Calendar and replace the system source's events in the
    store + index. Throttled to once / 5 min unless force. On non-darwin or an
    osascript failure, returns syncStatus='failed' with a clear message (no crash)."""
    now = _now()
    d = _load()
    existing = next((s for s in d["sources"] if s["id"] == _SYSTEM_SOURCE_ID), None)

    if existing and existing.get("lastSyncedAt") and not force:
        try:
            last = datetime.fromisoformat(existing["lastSyncedAt"].replace("Z", "+00:00"))
            if datetime.now(timezone.utc) - last < _THROTTLE:
                return list_calendar()
        except ValueError:
            pass

    if sys.platform != "darwin":
        return {**list_calendar(), "syncStatus": "failed",
                "syncError": "系统日历读取仅支持 macOS。"}

    try:
        events = _read_macos_calendar_events(now)
    except (OSError, subprocess.SubprocessError):
        events = None

    if events is None:
        # Stamp nothing — leave lastSyncedAt so a retry isn't throttled away.
        return {**list_calendar(), "syncStatus": "failed",
                "syncError": "无法读取系统日历。请在「系统设置 › 隐私与安全性 › 日历 / 自动化」中允许 Snowan 访问。"}

    d = _load()  # reload in case the store changed while osascript ran
    source = {
        "id": _SYSTEM_SOURCE_ID,
        "name": "系统日历",
        "provider": "system",
        "enabled": True,
        "createdAt": existing["createdAt"] if existing else now,
        "updatedAt": now,
        "lastSyncedAt": now,
    }
    d["sources"] = [s for s in d["sources"] if s["id"] != _SYSTEM_SOURCE_ID]
    d["sources"].insert(0, source)
    d["events"] = [e for e in d["events"] if e.get("sourceId") != _SYSTEM_SOURCE_ID]
    d["events"].extend(events)
    _save(d)
    _index_events(d["events"])
    return {**list_calendar(), "syncStatus": "success", "syncError": ""}


def import_ics(ics_text: str, source_name: str = "导入的日历") -> dict:
    """Parse ICS text and replace that named source's events in the store + index."""
    now = _now()
    name = (source_name or "导入的日历").strip() or "导入的日历"
    source_id = _stable_id("calendar_source", f"ics:{name}")
    events = _parse_ics_events(ics_text, source_id, name, now)

    d = _load()
    existing = next((s for s in d["sources"] if s["id"] == source_id), None)
    source = {
        "id": source_id,
        "name": name,
        "provider": "ics",
        "enabled": True,
        "createdAt": existing["createdAt"] if existing else now,
        "updatedAt": now,
        "lastSyncedAt": now,
    }
    d["sources"] = [s for s in d["sources"] if s["id"] != source_id]
    d["sources"].insert(0, source)
    d["events"] = [e for e in d["events"] if e.get("sourceId") != source_id]
    d["events"].extend(events)
    _save(d)
    _index_events(d["events"])
    return {**list_calendar(), "syncStatus": "success", "syncError": ""}


# --- query helpers (pure reads over the store; used by the agent tool) ------

def _to_dt(value: str) -> datetime | None:
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return None


def upcoming_events(days: int = 7) -> list[dict]:
    """Events starting between now and `days` from now, sorted by start time."""
    now = datetime.now(timezone.utc)
    until = now + timedelta(days=max(days, 0))
    out = []
    for e in _load()["events"]:
        start = _to_dt(e.get("startsAt", ""))
        if start is None:
            continue
        start = start.astimezone(timezone.utc)
        if now <= start <= until:
            out.append(e)
    out.sort(key=lambda e: e.get("startsAt", ""))
    return out


def events_on(date: str) -> list[dict]:
    """Events whose start date matches the given YYYY-MM-DD (local date), sorted by start."""
    out = []
    for e in _load()["events"]:
        start = _to_dt(e.get("startsAt", ""))
        if start is None:
            continue
        if start.astimezone().date().isoformat() == date:
            out.append(e)
    out.sort(key=lambda e: e.get("startsAt", ""))
    return out
