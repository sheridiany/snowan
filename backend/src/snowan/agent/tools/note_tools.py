"""Persist a deliverable into the knowledge vault — used by the 深度研究 / 文档编辑
skills to land their output as an editable, exportable note."""
from ... import knowledge


def save_note(title: str, content: str) -> str:
    """把一篇 Markdown 内容保存成知识库笔记(研究报告/文档成果落库)。title 是标题,content 是正文。"""
    note = knowledge.create_note(content, title=title.strip(), origin="chat")
    return f"已存为知识库笔记「{note['title']}」。用户可在知识库里查看 / 编辑 / 导出 (Word/HTML)。"
