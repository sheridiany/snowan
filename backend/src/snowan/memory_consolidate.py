"""Manual "整理" (consolidation) engine: a reviewable hard-forgetting pass over the
memory vault. The agent NEVER writes — propose() reads recent daily logs + L2 entries
+ L3 profile and returns a structured DIFF (adds/updates/deprecations/promotions), each
item carrying evidence (daily-log dates / entry ids) and a reason. The user reviews it in
the UI and flips an `approved` flag per item; apply() then writes ONLY the approved items.
L3 PROFILE is never auto-written — only via an approved promotion or explicit user edit."""
import asyncio

from pydantic import BaseModel, Field

from . import memory
from .agent.providers import build_model
from .config import load_settings

_RECENT_DAYS = 3
_TIMEOUT = 60.0

_SYSTEM = """你是 Snowan 的记忆整理助手。你的工作是审视用户的长期记忆，提出一份"可审阅的修改建议(DIFF)"，而不是直接修改。绝不写入任何东西——你只产出建议，由用户逐条批准后才会生效。

记忆分三层:
- L1 流水日志(daily):每天发生了什么的原始记录。
- L2 语义条目(entries):从流水中提炼出的原子事实，每条带 id、类型、重要性。
- L3 画像(profile):稳定的身份/长期偏好，每轮都会注入对话，最珍贵也最需要谨慎。

你必须遵循四条原则:
1. 极简去冗:不要把流水账、一次性琐事(今天吃了什么、临时跑了个命令)沉淀成 L2 条目。只保留对未来仍有意义的事实/偏好/决策。
2. 状态覆写:新状态取代旧状态时，用 update(改写旧条目)或 deprecation(废弃旧条目)，绝不让自相矛盾的两条共存。例如"住在北京"被"搬到上海"取代——改写或废弃旧的，而不是新增一条并保留旧的。
3. 归纳合并:把零散、相似的事实合并成一条更完整的条目(用 update 合进其中一条，并 deprecate 其余)，减少碎片。
4. 废弃剔除:被证伪、已过期、不再成立的条目，用 deprecation 标记废弃。

提升到 L3 画像(promotion)的红线:
- 只提升持久、被多处证据反复印证的特质/长期偏好(durable + multi-evidence)，一次性或近期才出现的不要提。
- 绝不把任何秘密提升到画像:密码、密钥、token、私钥、身份证号等敏感凭据一律不进 L3(L2 也应避免)。

每个建议项都要给出:
- content:建议写入/改写后的最终文本。
- type:fact / preference / decision / project / todo / person 之一(promotion 可省)。
- importance:1-5(promotion 可省)。
- reason:为什么这么改(简短，中文)。
- evidence:支撑证据——相关的 daily 日期(YYYY-MM-DD)和/或已有条目的 id。
updates / deprecations 必须带上目标条目的 entry_id。没有可靠依据就不要编造建议;宁缺毋滥。"""


class Add(BaseModel):
    content: str
    type: str = "fact"
    importance: int = Field(default=3, ge=1, le=5)
    reason: str = ""
    evidence: list[str] = Field(default_factory=list)


class Update(BaseModel):
    entry_id: str
    content: str
    type: str | None = None
    importance: int | None = Field(default=None, ge=1, le=5)
    reason: str = ""
    evidence: list[str] = Field(default_factory=list)


class Deprecation(BaseModel):
    entry_id: str
    reason: str = ""
    evidence: list[str] = Field(default_factory=list)


class Promotion(BaseModel):
    content: str  # the durable trait/preference line to append to PROFILE.md
    reason: str = ""
    evidence: list[str] = Field(default_factory=list)


class Diff(BaseModel):
    adds: list[Add] = Field(default_factory=list)
    updates: list[Update] = Field(default_factory=list)
    deprecations: list[Deprecation] = Field(default_factory=list)
    promotions: list[Promotion] = Field(default_factory=list)


def _context() -> str:
    parts: list[str] = []
    dates = memory.list_daily_dates()[:_RECENT_DAYS]
    if dates:
        parts.append("## 最近的流水日志(L1)")
        for d in reversed(dates):  # oldest first, chronological
            log = memory.read_daily(d).strip()
            if log:
                parts.append(log)
    entries = memory.list_entries()
    if entries:
        parts.append("## 现有语义条目(L2)")
        for e in entries:
            parts.append(
                f"- id={e['id']} type={e['type']} importance={e['importance']}"
                f" valid={e['valid']}: {e['content']}"
            )
    profile = memory.get_profile().strip()
    parts.append("## 当前画像(L3)\n" + (profile or "(空)"))
    return "\n\n".join(parts)


def _flatten(diff: Diff) -> dict:
    """The LLM returns category lists (good for the model); the UI wants ONE flat list
    of {kind,...,approved} items to render with checkboxes. Default approved=true."""
    items: list[dict] = []
    for a in diff.adds:
        items.append({"kind": "add", "content": a.content, "type": a.type,
                      "importance": a.importance, "reason": a.reason, "evidence": a.evidence, "approved": True})
    for u in diff.updates:
        items.append({"kind": "update", "id": u.entry_id, "content": u.content, "type": u.type,
                      "importance": u.importance, "reason": u.reason, "evidence": u.evidence, "approved": True})
    for d in diff.deprecations:
        items.append({"kind": "deprecate", "id": d.entry_id,
                      "reason": d.reason, "evidence": d.evidence, "approved": True})
    for p in diff.promotions:
        items.append({"kind": "promote", "content": p.content,
                      "reason": p.reason, "evidence": p.evidence, "approved": True})
    return {"items": items}


async def propose() -> dict:
    """Read recent memory and ask the LLM for a reviewable DIFF. Writes nothing; returns
    a jsonable {items:[{kind,...,approved}]} for the UI to render and approve per item. On
    no model / failure returns an empty diff (never raises)."""
    s = load_settings()
    if s.provider == "test" or not s.api_key:
        return {"items": []}
    try:
        from pydantic_ai import Agent

        agent = Agent(build_model(s), instructions=_SYSTEM, output_type=Diff)
        res = await asyncio.wait_for(agent.run(_context()), timeout=_TIMEOUT)
        return _flatten(res.output)
    except Exception:  # noqa: BLE001 — a model failure must not break the maintenance pass
        return {"items": []}


def apply(diff: dict) -> dict:
    """Write ONLY the approved items of the flat diff (each carries an `approved` bool; a
    promotion appends to PROFILE.md, which set_profile backs up first)."""
    summary = {"added": 0, "updated": 0, "deprecated": 0, "promoted": 0}
    promo_lines: list[str] = []

    for it in diff.get("items") or []:
        if not it.get("approved"):
            continue
        kind = it.get("kind")
        content = (it.get("content") or "").strip()
        if kind == "add" and content:
            memory.create_entry(content, type=it.get("type") or "fact", importance=int(it.get("importance") or 3))
            summary["added"] += 1
        elif kind == "update" and it.get("id"):
            fields: dict = {}
            if content:
                fields["content"] = content
            if it.get("type"):
                fields["type"] = it["type"]
            if it.get("importance") is not None:
                fields["importance"] = int(it["importance"])
            if memory.update_entry(it["id"], **fields):
                summary["updated"] += 1
        elif kind == "deprecate" and it.get("id"):
            if memory.update_entry(it["id"], valid=False):
                summary["deprecated"] += 1
        elif kind == "promote" and content:
            promo_lines.append(content)

    if promo_lines:
        current = memory.get_profile().rstrip()
        existing = {ln.strip().lstrip("-").strip() for ln in current.splitlines()}
        fresh: list[str] = []
        for ln in promo_lines:
            clean = " ".join(ln.split())[:200]  # collapse to one bounded line
            if clean and clean not in existing and clean not in fresh:
                fresh.append(clean)
        if fresh:  # skip the write (and its backup) when nothing is new
            appended = "\n".join(f"- {ln}" for ln in fresh)
            memory.set_profile(f"{current}\n{appended}" if current else appended)
            summary["promoted"] = len(fresh)

    summary["applied"] = summary["added"] + summary["updated"] + summary["deprecated"] + summary["promoted"]
    return summary
