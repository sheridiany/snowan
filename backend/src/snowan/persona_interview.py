"""Conversational onboarding DRAFT engine for the L3 画像. Parallel to
memory_consolidate: a few warm one-focus questions, then ONE Agent call distills the
user's answers into the 6 canonical sections and returns an EDITABLE markdown draft.
It writes nothing — the frontend persists a confirmed draft via PUT /api/memory/profile.
On no model / failure it hands back an empty 6-section skeleton so a first run never errors."""
import asyncio

from pydantic import BaseModel

from .agent.providers import build_model
from .config import load_settings

_TIMEOUT = 60.0

# 5-7 warm, one-focus interview questions. Tone: a friendly assistant getting to know
# you, not a form. Covers the high-signal dimensions plus a light 成长背景&时代 + 家庭 touch.
QUESTIONS: list[dict] = [
    {
        "id": "work",
        "question": "先聊聊工作吧——你现在主要在做什么?",
        "hint": "角色、手上的项目、常打交道的领域或术语都行。",
    },
    {
        "id": "long_term",
        "question": "往远看,这一两年你最想达成的一件事是什么?",
        "hint": "一个真实的大目标就够,方便我帮你排优先级、该拒绝的时候提醒你拒绝。",
    },
    {
        "id": "short_term",
        "question": "那最近这阵子,你正盯着的是什么?",
        "hint": "手头这周/这月想推进的事。",
    },
    {
        "id": "habits",
        "question": "希望我平时怎么配合你?",
        "hint": "比如回复想要多简短、是否代码优先、喜欢什么语气——越具体我越好照做。",
    },
    {
        "id": "growth",
        "question": "有什么成长经历或背景,你觉得会影响我们怎么沟通?",
        "hint": "可选。只在你愿意说时聊,我不会从年龄之类去猜你是哪代人。",
    },
    {
        "id": "family",
        "question": "生活里有没有什么需要我纳入考虑的安排?",
        "hint": "可选,只说会影响建议的那种,比如带娃要现实排程;不用报家庭成员名单。",
    },
]


class Persona(BaseModel):
    growth: str = ""  # 成长背景&时代
    family: str = ""  # 家庭
    work: str = ""  # 工作
    long_term: str = ""  # 长期规划
    short_term: str = ""  # 短期规划
    habits: str = ""  # 个人习惯


# section field -> Chinese heading, in the fixed canonical order.
_SECTIONS: list[tuple[str, str]] = [
    ("growth", "成长背景&时代"),
    ("family", "家庭"),
    ("work", "工作"),
    ("long_term", "长期规划"),
    ("short_term", "短期规划"),
    ("habits", "个人习惯"),
]

_PLACEHOLDER = "(还没聊到,可在设置里补充)"

_SYSTEM = """你在为 Snowan 起草用户的「画像」——一份每轮都会注入对话、帮助手真正懂用户的稳定档案。你只根据用户在访谈里的回答起草,绝不编造;回答没覆盖到的分节就留空。输出简体中文。

画像分六节,每节都存「可执行的提炼」,不存标签/形容词:

- 成长背景&时代:只在用户主动说了的前提下,提炼出对沟通有用的语气/参照系/正式度。绝不写"90后"这类代际标签,更不准由年龄去推断时代——只能来自用户明说的内容。
- 家庭:只记会约束建议的部分(例如"有两个学龄前孩子→排程要现实"),最小化、最敏感。不要花名册、不要生日。
- 工作:角色 + 在做什么 + 常用术语。
- 长期规划:用户真实的大目标,写成助手能据此排优先级、该说不时说不的样子。
- 短期规划:最近正在推进的事。
- 个人习惯:可测的协作约束(如"回复默认 N 句内、代码优先")和期望的交互语气,不要写"我喜欢简洁"这种空话。

把每节写成简洁、可直接执行的一两句话或短条目。没有可靠依据就留空,宁缺毋滥。

绝不将密码、密钥、token、私钥、身份证号等敏感凭据写入画像;若用户回答里出现这类内容,一律忽略。"""


def empty_persona_markdown() -> str:
    """The 6-section skeleton with every section a fill-me-in placeholder. Used as the
    no-model first-run draft so the user still gets an editable structure."""
    return _to_markdown(Persona())


def _to_markdown(p: Persona) -> str:
    parts: list[str] = []
    for field, title in _SECTIONS:
        content = (getattr(p, field) or "").strip() or _PLACEHOLDER
        parts.append(f"## {title}\n{content}\n")
    return "\n".join(parts)


def _format_answers(answers: dict) -> str:
    by_id = {q["id"]: q["question"] for q in QUESTIONS}
    lines: list[str] = []
    for qid, ans in answers.items():
        text = (str(ans) if ans is not None else "").strip()
        if not text:
            continue
        lines.append(f"问:{by_id.get(qid, qid)}\n答:{text}")
    return "\n\n".join(lines) or "(用户没有提供任何回答)"


async def draft(answers: dict) -> str:
    """Distill the interview answers into the 6-section 画像 markdown. Writes nothing.
    On no model / failure returns the empty skeleton (never raises)."""
    s = load_settings()
    if s.provider == "test" or not s.api_key:
        return empty_persona_markdown()
    try:
        from pydantic_ai import Agent

        agent = Agent(build_model(s), instructions=_SYSTEM, output_type=Persona)
        res = await asyncio.wait_for(agent.run(_format_answers(answers)), timeout=_TIMEOUT)
        return _to_markdown(res.output)
    except Exception:  # noqa: BLE001 — a model failure must still hand back an editable skeleton
        return empty_persona_markdown()
