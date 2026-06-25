"""In-process document generation for the agent: Word / PDF / HTML / Markdown,
Excel and PowerPoint — built with the bundled office libs (and Chromium for PDF),
so it works the same in dev and in the packaged app (no shelling out to a system
`python`). Each tool writes the file into the workspace and returns its path; the
chat layer surfaces a successful call as a downloadable artifact card."""
from pydantic import BaseModel

from ...export import _filename, md_to_docx, md_to_html_doc, md_to_pdf, outline_to_pptx, rows_to_xlsx
from ...workspace import resolve_in_workspace


class SheetSpec(BaseModel):
    name: str
    rows: list[list[str]]
    columns: list[str] | None = None


class SlideSpec(BaseModel):
    title: str
    bullets: list[str] = []
    notes: str | None = None


def _save(title: str, ext: str, data: bytes) -> str:
    path = _filename(title, ext)
    resolve_in_workspace(path).write_bytes(data)
    return path


async def create_document(title: str, content: str, format: str = "docx") -> str:
    """用 Markdown 内容(content)生成一篇文档并存到 workspace,返回文件路径——成功后会自动作为可下载成果展示给用户。format 可选 docx|pdf|html|md。适合产出报告/方案/说明等长文。"""
    fmt = (format or "docx").lower()
    try:
        if fmt == "md":
            return _save(title, "md", content.encode("utf-8"))
        if fmt == "html":
            return _save(title, "html", md_to_html_doc(title, content).encode("utf-8"))
        if fmt == "docx":
            return _save(title, "docx", md_to_docx(title, content))
        if fmt == "pdf":
            return _save(title, "pdf", await md_to_pdf(title, content))
    except Exception as e:  # noqa: BLE001 — surface to the model so it can react/retry
        return f"error: 生成文档失败:{e}"
    return f"error: 不支持的格式 {format}(可选 docx|pdf|html|md)"


def create_spreadsheet(title: str, sheets: list[SheetSpec]) -> str:
    """生成 Excel(.xlsx)并存到 workspace,返回文件路径——成功后自动作为可下载成果展示。每个 sheet 单独一页:name 是页名,rows 是行(每行一组单元格),columns 是可选表头。百分比等格式直接把 "85%" 这类字符串放进单元格。"""
    if not sheets:
        return "error: sheets 不能为空"
    try:
        data = rows_to_xlsx([(s.name, s.columns, s.rows) for s in sheets])
        return _save(title, "xlsx", data)
    except Exception as e:  # noqa: BLE001
        return f"error: 生成 Excel 失败:{e}"


def create_slides(title: str, slides: list[SlideSpec]) -> str:
    """生成 PowerPoint(.pptx)并存到 workspace,返回文件路径——成功后自动作为可下载成果展示。封面用 title;之后每个 slide 一页:title 页标题,bullets 要点(每条一行),notes 可选演讲备注。每页一个清晰要点,别把整段塞进一页。"""
    if not slides:
        return "error: slides 不能为空"
    try:
        outline = [{"title": s.title, "bullets": s.bullets, "notes": s.notes} for s in slides]
        return _save(title, "pptx", outline_to_pptx(title, outline))
    except Exception as e:  # noqa: BLE001
        return f"error: 生成幻灯片失败:{e}"
