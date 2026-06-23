"""Books (书籍) API: upload + parse (epub now), book list/detail/chapter, cover
serving + AI-generated covers, and the AI reading layer (速览 / 精读骨架 / 问答)
over the active provider model. 问答 is grounded RAG over the book's own chapters
(books.retrieve, scoped to source_type='book' + uri=book_id) and cites chapters."""
import base64

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

from .. import books, knowledge
from ..agent.providers import build_model
from ..config import image_settings, load_settings
from . import imagegen

router = APIRouter(prefix="/api/books")


# --- request models --------------------------------------------------------

class UploadBody(BaseModel):
    filename: str
    data: str  # base64-encoded file bytes


class AskTurn(BaseModel):
    role: str  # "user" | "ai"
    text: str


class AskBody(BaseModel):
    question: str
    mode: str = "qa"  # "qa" | "socratic" | "feynman"
    history: list[AskTurn] = []
    passage: str = ""  # a 划词 selection the user is asking about, force-included


class SyntopicalBody(BaseModel):
    question: str
    book_ids: list[str] = []  # [] = the whole shelf


class StartModeBody(BaseModel):
    mode: str = "socratic"


class SaveInsightBody(BaseModel):
    text: str
    chapter: str = ""


# Three grounded companion modes. socratic/feynman keep the reader ACTIVE — the AI asks
# back / plays the student rather than just answering. All still cite the book's passages.
_MODE_INSTRUCTIONS = {
    "qa": "你是这本书的阅读助手。只依据下面提供的书中片段回答用户的问题,并用章节名标注引用。"
    "如果片段里没有答案,就直说书中没有提到,不要编造。",
    "socratic": "你是这本书的苏格拉底式陪读。核心规则:无论用户问什么,都【不要直接给出答案或结论】,"
    "而是把它转化成一两个有锋芒的反问,逼用户自己想清楚——可顺着《如何阅读一本书》的四问"
    "(整体在讲什么 / 细节怎么说 / 它说得对吗 / 那又如何),或针对用户上一句的薄弱处追问、点出可质疑之处。"
    "只问问题、不替他作答(最多用半句话铺垫),然后把球抛回给他。引用书中片段时标注章节。",
    "feynman": "你扮演一个好奇但什么都不懂的初学者,用户正把书里的概念讲给你听。认真听,然后对没讲清的"
    "地方追问「为什么」,指出他用了术语却没解释、或跳了步的地方;若书中片段和他讲的不一致,温和指出并引用"
    "章节。目标是逼他把概念讲到你这个外行也能听懂。简体中文,别替他讲。",
}


# 学习物料: per-kind generation instructions, grounded in the whole book.
_ARTIFACT_INSTRUCTIONS = {
    "glossary": "挑出全书最核心的 12-18 个术语/概念(宁缺毋滥),每条一行「**术语** — 一句话定义」,"
    "用 Markdown 无序列表。只输出列表本身,不要前后说明。",
    "mindmap": "输出一张 mermaid 思维导图,而且只输出一个 mermaid 代码块(代码块首行是 mindmap)。"
    "根节点是书名,向下 3-4 层、最多 5 层;每个节点用简短中文短语,不要标点、括号、引号。"
    "只画主干脉络,不要逐章罗列细节。格式示例:\n```mermaid\nmindmap\n  书名\n    主题一\n      要点\n    主题二\n```",
    "summary": "为全书主要章节各写一段摘要,跳过版权/赞誉/献词/目录等非正文前页。"
    "每章用「### 章节名」加 2-3 句话讲清这章的核心观点,简洁不展开。只输出 Markdown。",
}


# --- upload / CRUD ---------------------------------------------------------

@router.post("/upload")
def upload(req: UploadBody) -> dict:
    if not req.filename.strip():
        raise HTTPException(422, "filename is required")
    try:
        raw = base64.b64decode(req.data)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(422, "data must be base64") from e
    try:
        return books.add_book(req.filename.strip(), raw)
    except NotImplementedError as e:
        raise HTTPException(400, str(e) or "暂不支持该格式") from e
    except ValueError as e:
        raise HTTPException(400, str(e)) from e


@router.get("/")
def list_books() -> list[dict]:
    return books.list_books()


# 主题阅读 (syntopical): shelf-level, NOT under /{book_id}. Registered BEFORE the
# /{book_id} routes below so "/syntopical" isn't swallowed as a book id.
@router.post("/syntopical")
async def syntopical(req: SyntopicalBody) -> dict:
    """跨书主题阅读: retrieve across a set of books (or the whole shelf), group hits per
    book, and synthesize an Adler-style syntopical answer — 各书怎么说 / 共识 / 分歧 / 综合判断,
    grounded only in the retrieved snippets and citing 《书名·章节》."""
    if not req.question.strip():
        raise HTTPException(422, "question is required")
    hits = books.retrieve_multi(req.book_ids, req.question, k=8)
    if not hits:
        return {"answer": "书架上这些书里没有找到相关内容。", "sources": [], "books_used": []}

    grouped: dict[str, list[dict]] = {}
    for h in hits:
        grouped.setdefault(h["book_id"], []).append(h)
    context_blocks = []
    for book_id, book_hits in grouped.items():
        title = book_hits[0]["book_title"] or book_id
        snippets = "\n".join(
            f"  ·【{h['chapter_title']}】{h['snippet']}" for h in book_hits
        )
        context_blocks.append(f"《{title}》:\n{snippets}")
    context = "\n\n".join(context_blocks)

    from pydantic_ai import Agent

    agent = Agent(
        _model_or_400(),
        instructions="你是主题阅读教练,按《如何阅读一本书》的主题阅读法,围绕用户的问题对照多本书。"
        "用简体中文输出 Markdown:① 各本书分别怎么说这个问题(按书标注);② 它们的共识;"
        "③ 它们的分歧 / 不同视角;④ 一个综合判断。只依据下面给出的片段,引用时标注《书名·章节》,"
        "片段里没有的就直说没有,不要编造。",
    )
    prompt = f"用户的问题:{req.question}\n\n各书相关片段:\n{context}"
    try:
        res = await agent.run(prompt)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, f"主题阅读失败: {e}") from e
    answer = res.output if isinstance(res.output, str) else str(res.output)
    return {
        "answer": answer,
        "sources": [
            {"book_title": h["book_title"], "chapter_title": h["chapter_title"], "snippet": h["snippet"]}
            for h in hits
        ],
        "books_used": [
            {"book_id": bid, "book_title": (bh[0]["book_title"] or bid), "n_hits": len(bh)}
            for bid, bh in grouped.items()
        ],
    }


@router.get("/{book_id}")
def get_book(book_id: str) -> dict:
    book = books.get_book(book_id)
    if book is None:
        raise HTTPException(404, "book not found")
    return book


@router.get("/{book_id}/chapter/{num}")
def get_chapter(book_id: str, num: int) -> dict:
    chapter = books.get_chapter(book_id, num)
    if chapter is None:
        raise HTTPException(404, "chapter not found")
    return chapter


@router.get("/{book_id}/cover")
def get_cover(book_id: str) -> Response:
    png = books.cover_bytes(book_id)
    if not png:
        raise HTTPException(404, "该书没有封面")
    return Response(png, media_type="image/png")


@router.delete("/{book_id}")
def delete_book(book_id: str) -> Response:
    if not books.delete_book(book_id):
        raise HTTPException(404, "book not found")
    return Response(status_code=204)


# --- AI --------------------------------------------------------------------

def _model_or_400():
    s = load_settings()
    if s.provider == "test" or not s.api_key:
        raise HTTPException(400, "未配置 AI 模型,请先在设置中选择")
    return build_model(s)


def _book_or_404(book_id: str) -> dict:
    book = books.get_book(book_id)
    if book is None:
        raise HTTPException(404, "book not found")
    return book


def _chapter_texts(book_id: str, nums: list[int], cap: int) -> str:
    """Join the plaintext of the given chapters, each truncated to `cap` chars."""
    parts: list[str] = []
    for num in nums:
        ch = books.get_chapter(book_id, num)
        if ch is None:
            continue
        text = reading_text(ch.get("html") or "")[:cap]
        if text:
            parts.append(f"## {ch.get('title') or f'第 {num} 章'}\n{text}")
    return "\n\n".join(parts)


def reading_text(html: str) -> str:
    from ..extract import text_of

    return text_of(html)


@router.post("/{book_id}/overview")
async def overview(book_id: str) -> dict:
    """速览: from metadata + chapter titles + the first ~2 chapters, produce an
    editable Markdown orientation — book type, one-sentence thesis, the central
    question it answers, and a 2-minute read-in."""
    book = _book_or_404(book_id)
    chapters = book.get("chapters") or []
    toc = "\n".join(f"- {c['num']}. {c['title']}" for c in chapters) or "(无目录)"
    head_nums = [c["num"] for c in chapters[:2]]
    body = _chapter_texts(book_id, head_nums, cap=4000) or "(没有可读正文)"
    from pydantic_ai import Agent

    agent = Agent(
        _model_or_400(),
        instructions="你是阅读助手,帮用户在两分钟内大致了解一本书。根据书名、作者、目录和"
        "开头两章,用简体中文输出 Markdown:① 这是哪一类书;② 用一句话概括全书主旨;"
        "③ 它想回答的核心问题;④ 一段两分钟的导读,帮读者建立整体框架。只输出 Markdown,语气克制。",
    )
    prompt = (
        f"书名:{book.get('title')}\n作者:{book.get('author') or '未知'}\n\n"
        f"目录:\n{toc}\n\n开头章节正文:\n{body}"
    )
    try:
        res = await agent.run(prompt)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, f"速览失败: {e}") from e
    return {"overview": res.output if isinstance(res.output, str) else str(res.output)}


@router.post("/{book_id}/skeleton")
async def skeleton(book_id: str) -> dict:
    """精读骨架: an Adler-style analytical structure of the whole book — the problem
    it answers, key terms, the argument chain, and per-chapter "what the author is
    doing". Built from the TOC + chapter texts (capped). Editable Markdown."""
    book = _book_or_404(book_id)
    chapters = book.get("chapters") or []
    toc = "\n".join(f"- {c['num']}. {c['title']}" for c in chapters) or "(无目录)"
    nums = [c["num"] for c in chapters]
    body = _chapter_texts(book_id, nums, cap=1500) or "(没有可读正文)"
    from pydantic_ai import Agent

    agent = Agent(
        _model_or_400(),
        instructions="你是分析阅读教练,按照《如何阅读一本书》的分析阅读方法,为整本书搭一个精读骨架。"
        "用简体中文输出 Markdown,包含:① 全书要解决的问题;② 关键术语/概念;③ 作者的论证主线"
        "(主张如何一步步推进);④ 逐章说明「作者在这一章做了什么」。结构清晰,只输出 Markdown。",
    )
    prompt = f"书名:{book.get('title')}\n作者:{book.get('author') or '未知'}\n\n目录:\n{toc}\n\n各章正文(已截断):\n{body}"
    try:
        res = await agent.run(prompt)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, f"精读骨架生成失败: {e}") from e
    return {"skeleton": res.output if isinstance(res.output, str) else str(res.output)}


# --- 学习物料: artifacts ----------------------------------------------------

@router.post("/{book_id}/artifact/{kind}")
async def generate_artifact(book_id: str, kind: str) -> dict:
    """Generate (or regenerate) a 学习物料 — 术语表 / 思维导图 / 章节摘要 — grounded in the
    whole book, cache it via books.set_artifact, and return it. 422 on unknown kind."""
    instructions = _ARTIFACT_INSTRUCTIONS.get(kind)
    if instructions is None:
        raise HTTPException(422, "unknown artifact kind")
    book = _book_or_404(book_id)
    body = books.all_chapter_text(book_id) or "(没有可读正文)"
    from pydantic_ai import Agent

    agent = Agent(_model_or_400(), instructions="你是阅读助手,根据整本书的正文生成学习物料。" + instructions)
    prompt = f"书名:{book.get('title')}\n作者:{book.get('author') or '未知'}\n\n全书正文(每章已截断):\n{body}"
    try:
        res = await agent.run(prompt)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, f"生成失败: {e}") from e
    content = res.output if isinstance(res.output, str) else str(res.output)
    books.set_artifact(book_id, kind, content)
    return {"kind": kind, "content": content, "updated_at": books._now()}


@router.get("/{book_id}/artifacts")
def get_artifacts(book_id: str) -> dict:
    """All cached 学习物料 for the book: {glossary?, mindmap?, summary?}."""
    _book_or_404(book_id)
    return books.list_artifacts(book_id)


@router.post("/{book_id}/ask")
async def ask(book_id: str, req: AskBody) -> dict:
    """问答 / 苏格拉底 / 费曼 —— 三种模式都基于书中片段(RAG)接地,可带 划词 passage +
    对话历史。qa 直接答并引用;socratic 反过来追问;feynman 扮初学者逼用户讲清。"""
    _book_or_404(book_id)
    if not req.question.strip():
        raise HTTPException(422, "question is required")
    # The 划词 selection biases retrieval and is force-included as the user's focus.
    query = (req.passage + " " + req.question).strip()
    hits = books.retrieve(book_id, query, k=6)
    context = "\n\n".join(
        f"【{i + 1}】{h['chapter_title']}\n{h['snippet']}" for i, h in enumerate(hits)
    ) or "(没有检索到相关片段)"
    history = "\n".join(
        f"{'用户' if t.role == 'user' else 'AI'}: {t.text}" for t in req.history[-8:]
    )
    from pydantic_ai import Agent

    agent = Agent(_model_or_400(), instructions=_MODE_INSTRUCTIONS.get(req.mode, _MODE_INSTRUCTIONS["qa"]))
    parts = [f"书中片段:\n{context}"]
    if req.passage.strip():
        parts.append(f"用户正在看的原文(划词):\n{req.passage.strip()}")
    if history:
        parts.append(f"对话历史:\n{history}")
    parts.append(f"用户这轮说:{req.question}")
    try:
        res = await agent.run("\n\n".join(parts))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, f"问答失败: {e}") from e
    answer = res.output if isinstance(res.output, str) else str(res.output)
    return {
        "answer": answer,
        "sources": [{"chapter": h["chapter_title"], "snippet": h["snippet"]} for h in hits],
    }


@router.post("/{book_id}/start-mode")
async def start_mode(book_id: str, req: StartModeBody) -> dict:
    """The AI's opening turn when entering a mode: socratic → a first probing question
    grounded in the book; feynman → invite the user to teach a concept; qa → empty."""
    if req.mode == "qa":
        return {"answer": ""}
    book = _book_or_404(book_id)
    title = book.get("title") or "这本书"
    if req.mode == "feynman":
        return {"answer": f"来,把《{title}》里你最想搞懂的一个概念讲给我听——我什么都不懂,"
                "你讲、我追问,讲到我能听懂为止。想从哪个概念开始?"}
    chapters = book.get("chapters") or []
    toc = "\n".join(f"- {c['num']}. {c['title']}" for c in chapters[:20]) or "(无目录)"
    from pydantic_ai import Agent

    agent = Agent(
        _model_or_400(),
        instructions="你是苏格拉底式陪读。基于书名和目录,提出一个能撬动用户去思考整本书的开场问题"
        "(围绕《如何阅读一本书》的四问)。只问一个问题,简体中文,简短而有锋芒。",
    )
    try:
        res = await agent.run(f"书名:{title}\n目录:\n{toc}")
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, f"开场失败: {e}") from e
    return {"answer": res.output if isinstance(res.output, str) else str(res.output)}


@router.post("/{book_id}/save-insight")
def save_insight(book_id: str, req: SaveInsightBody) -> dict:
    """Save a companion insight/answer into the KB vault as a note, with book provenance."""
    book = _book_or_404(book_id)
    if not req.text.strip():
        raise HTTPException(422, "text is required")
    title = (req.text.strip().splitlines()[0] if req.text.strip().splitlines() else "读书笔记")[:40]
    source = {"book": book_id, "book_title": book.get("title"), "chapter": req.chapter or None}
    return knowledge.create_note(req.text, title, origin="book", source=source)


@router.post("/{book_id}/cover/generate")
async def generate_cover(book_id: str) -> dict:
    """Generate a stylized cover from the book's title/theme via imagegen, store it
    as the book's cover, and return its cover_url."""
    book = _book_or_404(book_id)
    s = image_settings()
    if not s.model:
        raise HTTPException(400, "未配置图像生成模型,请先在设置中选择")
    if s.provider == "anthropic":
        raise HTTPException(400, "Anthropic 不支持图像生成,请选择其他模型")
    title = book.get("title") or "未命名"
    theme = book.get("author") or "literature"
    prompt = (
        f"Book cover art for a book titled '{title}'. Theme: {theme}. "
        f"Distinct illustrated style, bold composition, title-friendly negative space, no text."
    )
    try:
        images, _revised = await imagegen._openai_generate(s, prompt, size="auto", n=1)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, f"封面生成失败: {e}") from e
    if not images:
        raise HTTPException(400, "封面生成失败: 模型未返回图像")
    books.set_cover(book_id, images[0])
    return {"cover_url": f"/api/books/{book_id}/cover"}
