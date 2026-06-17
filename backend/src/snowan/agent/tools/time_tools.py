from datetime import datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


def get_current_time(timezone: str = "UTC") -> str:
    """Current time as an ISO-8601 string in the given IANA timezone (e.g. 'Asia/Shanghai')."""
    try:
        return datetime.now(ZoneInfo(timezone)).isoformat()
    except (ZoneInfoNotFoundError, KeyError):
        return datetime.now(ZoneInfo("UTC")).isoformat()
