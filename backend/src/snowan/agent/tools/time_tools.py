from datetime import datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


def get_current_time(timezone: str = "") -> str:
    """Current time as an ISO-8601 string in the given IANA timezone (e.g. 'Asia/Shanghai').
    Defaults to the user's configured timezone, then UTC."""
    if not timezone:
        from ...config import load_prefs

        timezone = load_prefs().get("timezone") or "UTC"
    try:
        return datetime.now(ZoneInfo(timezone)).isoformat()
    except (ZoneInfoNotFoundError, KeyError):
        return datetime.now(ZoneInfo("UTC")).isoformat()
