from datetime import date as _date

from ...knowledge import get_daily


def daily_note(date: str = "") -> str:
    """读取用户某天的「随手记」(daily note)——他自己写下的任务、待办、想法、计划都记在这里。

    当用户问「今天/某天我有哪些任务/待办」「我今天要做什么」「我之前记了什么」这类问题时,先调用本工具。
    注意:日历(upcoming_events)只有正式日程;用户随手写下的任务/计划在随手记里,两者要分开看,
    别因为日历为空就说「今天没安排」。date 留空表示今天,否则传 YYYY-MM-DD。"""
    d = date.strip() or _date.today().isoformat()
    note = get_daily(d)
    body = note["body"].strip() if note else ""
    if not body:
        return f"({d}) 这天的随手记还是空的。"
    return f"({d}) 随手记:\n{body}"
