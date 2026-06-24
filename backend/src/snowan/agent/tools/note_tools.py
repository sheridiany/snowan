"""Land deliverables into the knowledge vault, and read / append / reorganize existing
notes so related info collects in one place instead of spawning duplicate notes — used by
the 深度研究 / 文档编辑 skills and whenever the user says「补充到之前那篇里」."""
from ... import knowledge

# Terminal message — must NOT tell the model to "search again", or a file_* id (a
# read-only indexed file, never resolvable here) sends it into an endless
# append_note → not-found → knowledge_search → append_note loop.
def _not_found(note_id: str) -> str:
    if str(note_id).startswith("file_"):
        return (
            f"{note_id} 是一篇只读的索引文件,不是 app 内笔记,不能 append/rewrite。"
            "要记录就用 save_note 新建一篇,或用 edit_file 按文件路径直接改它。不要再检索这个 id。"
        )
    return (
        f"没有 id 为 {note_id} 的可编辑笔记(可能已删除或 id 不对)。"
        "要记录就直接用 save_note 新建,不要反复检索同一个 id。"
    )


def save_note(title: str, content: str) -> str:
    """新建一篇知识库笔记(研究报告/文档成果落库)。title 是标题,content 是 Markdown 正文。
    只在没有同主题已有笔记时才新建;要补充进已有笔记用 append_note,整理重写用 rewrite_note。"""
    note = knowledge.create_note(content, title=title.strip(), origin="chat")
    return f"已存为知识库笔记「{note['title']}」。用户可在知识库里查看 / 编辑 / 导出 (Word/HTML)。"


def read_note(note_id: str) -> str:
    """读取一篇已有笔记的完整标题和正文(note_id 来自 knowledge_search 的结果)。
    追加或重写之前先读一遍现有内容,避免重复或破坏原有结构。"""
    note = knowledge.get_note(note_id)
    if note is None:
        return _not_found(note_id)
    return f"《{note['title']}》(id: {note['id']})\n\n{note['body']}"


def append_note(note_id: str, content: str) -> str:
    """把 content 追加到一篇已有笔记的末尾(note_id 来自 knowledge_search)。
    用户说「补充 / 加到之前那篇里」时用它,不要为同一主题新建重复笔记。"""
    note = knowledge.get_note(note_id)
    if note is None:
        return _not_found(note_id)
    merged = f"{note['body'].rstrip()}\n\n{content.strip()}\n"
    updated = knowledge.update_note(note_id, body=merged)
    return f"已把内容追加到笔记「{updated['title']}」。"


def rewrite_note(note_id: str, content: str, title: str = "") -> str:
    """用 content 整篇替换一篇已有笔记的正文(可选 title 改标题)——用于重新组织 / 合并 / 精简。
    会覆盖原正文,所以先用 read_note 读全原文再重写。note_id 来自 knowledge_search。"""
    note = knowledge.get_note(note_id)
    if note is None:
        return _not_found(note_id)
    updated = knowledge.update_note(note_id, body=content, title=title.strip() or None)
    return f"已重新整理笔记「{updated['title']}」。"
