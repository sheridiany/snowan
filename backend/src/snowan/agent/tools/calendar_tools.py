from ...calendar import upcoming_events as _upcoming_events


def upcoming_events(days: int = 7) -> str:
    """列出用户接下来 N 天(默认 7 天)的日历安排,来自本机系统日历(已聚合 iCloud/Gmail/Outlook)。

    当用户问「我明天/这周/接下来几天有什么安排」「X 号有没有会」这类问题时,先调用本工具,
    不要直接回答「我看不到你的日历」。确实没有日程再如实说这段时间没安排。
    每行格式为 日期 时间 · 标题 · 地点,据此回答即可。"""
    events = _upcoming_events(max(1, days))
    if not events:
        return f"接下来 {max(1, days)} 天内没有日历安排。"
    lines = [f"接下来 {max(1, days)} 天内有 {len(events)} 项安排:"]
    for e in events:
        when = e.get("startsAt", "").replace("T", " ")[:16]  # 2026-06-22 10:00
        row = f"{when} · {e.get('title', '未命名日程')}"
        if e.get("location"):
            row += f" · {e['location']}"
        lines.append(row)
    return "\n".join(lines)
