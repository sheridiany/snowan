"""Document export and in-process file generation. Markdown -> standalone HTML or
Word .docx (a small markdown-it token walker, no pandoc); Markdown -> PDF via the
bundled Chromium (no extra dep); plus structured builders for Excel (.xlsx) and
PowerPoint (.pptx). Shared by the notes export endpoint and the agent's create_*
document tools."""
import asyncio
import io
import os
import re
import subprocess

import nh3
from docx import Document
from docx.shared import Pt, RGBColor
from markdown_it import MarkdownIt

_md = MarkdownIt()

_HTML_CSS = """\
:root { color-scheme: light dark; }
body {
  max-width: 720px; margin: 40px auto; padding: 0 20px;
  font: 16px/1.7 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  color: #1a1a1a;
}
h1, h2, h3 { line-height: 1.3; margin-top: 1.6em; }
h1 { font-size: 1.8em; }
a { color: #2563eb; }
img { max-width: 100%; height: auto; }
pre {
  background: #f5f5f5; padding: 12px 14px; border-radius: 8px; overflow-x: auto;
}
code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.9em; }
pre code { background: none; padding: 0; }
blockquote {
  margin: 1em 0; padding-left: 14px; border-left: 3px solid #ddd; color: #555;
}
"""


def _filename(title: str, ext: str) -> str:
    base = re.sub(r'[\\/:*?"<>|\x00-\x1f]+', " ", title).strip()[:80].strip() or "未命名"
    return f"{base}.{ext}"


def md_to_html_doc(title: str, body_md: str) -> str:
    """Full standalone HTML page from a Markdown note body."""
    inner = nh3.clean(_md.render(body_md))
    return _wrap_html(title, inner)


def _wrap_html(title: str, body_html: str) -> str:
    esc = title.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return (
        f"<!DOCTYPE html>\n<html lang=\"zh\">\n<head>\n<meta charset=\"utf-8\">\n"
        f"<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n"
        f"<title>{esc}</title>\n<style>\n{_HTML_CSS}</style>\n</head>\n<body>\n"
        f"<h1>{esc}</h1>\n{body_html}\n</body>\n</html>\n"
    )


def md_to_docx(title: str, body_md: str) -> bytes:
    """Walk the markdown-it token stream into a Word document. Covers h1–h3,
    paragraphs, bullet/ordered lists, fenced code and inline bold/italic/links;
    anything fancier is flattened to text."""
    doc = Document()
    doc.add_heading(title, level=0)

    list_style = None  # "List Bullet" | "List Number" while inside a list
    tokens = _md.parse(body_md)
    i = 0
    while i < len(tokens):
        tok = tokens[i]
        if tok.type == "heading_open":
            level = min(int(tok.tag[1]), 3)
            _render_inline(doc.add_heading("", level=level), tokens[i + 1])
            i += 3
            continue
        if tok.type in ("bullet_list_open", "ordered_list_open"):
            list_style = "List Bullet" if tok.type == "bullet_list_open" else "List Number"
        elif tok.type in ("bullet_list_close", "ordered_list_close"):
            list_style = None
        elif tok.type == "paragraph_open":
            inline = tokens[i + 1]
            style = list_style or "Normal"
            para = doc.add_paragraph(style=style)
            _render_inline(para, inline)
            i += 3
            continue
        elif tok.type == "fence":
            for line in tok.content.rstrip("\n").split("\n"):
                run = doc.add_paragraph().add_run(line)
                run.font.name = "Courier New"
                run.font.size = Pt(10)
        i += 1

    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


def _render_inline(para, inline_tok) -> None:
    """Emit runs for an inline token's children, tracking bold/italic/link state."""
    bold = italic = link = False
    for c in inline_tok.children or []:
        if c.type == "strong_open":
            bold = True
        elif c.type == "strong_close":
            bold = False
        elif c.type in ("em_open",):
            italic = True
        elif c.type == "em_close":
            italic = False
        elif c.type == "link_open":
            link = True
        elif c.type == "link_close":
            link = False
        elif c.type == "code_inline":
            para.add_run(c.content).font.name = "Courier New"
        elif c.type == "text":
            run = para.add_run(c.content)
            run.bold = bold
            run.italic = italic
            if link:
                run.font.color.rgb = RGBColor(0x25, 0x63, 0xEB)
                run.font.underline = True
        elif c.type in ("softbreak", "hardbreak"):
            para.add_run("\n")


_PDF_HINT = (
    "PDF 引擎(Chromium)不可用,自动安装也失败了。请联网后重试,"
    "或在开发环境运行 `uv run playwright install chromium`。"
)


def _ensure_browsers_path() -> None:
    """In the frozen app the default browsers dir resolves INSIDE the read-only bundle,
    so install + launch can't write/find it there. Point both at an app-owned, writable
    dir (~/.snowan/ms-playwright), like the embedding model in ~/.snowan/models. Only in
    the frozen app — dev/tests keep playwright's normal cache. An existing override is
    respected."""
    import sys

    if getattr(sys, "frozen", False) and not os.environ.get("PLAYWRIGHT_BROWSERS_PATH"):
        from .config import SNOWAN_HOME

        os.environ["PLAYWRIGHT_BROWSERS_PATH"] = str(SNOWAN_HOME / "ms-playwright")


def _install_chromium() -> None:
    """Provision Chromium on first use — like the embedding model, it's downloaded at
    runtime (not bundled: a browser .app can't be ad-hoc-signed inside the
    PyInstaller/Tauri bundle). Drives the bundled node CLI so it works in the frozen
    app too."""
    from playwright._impl._driver import compute_driver_executable, get_driver_env

    _ensure_browsers_path()
    exe = compute_driver_executable()
    args = list(exe) if isinstance(exe, (list, tuple)) else [exe]
    subprocess.run([*args, "install", "chromium"], env=get_driver_env(), check=True, timeout=600)


async def _block_remote(route) -> None:
    """The PDF page is self-contained (set_content, no base URL), so abort any
    http(s) sub-resource fetch — a stray remote <img> in the content can't phone
    home or be used for SSRF during render. Local/data: resources still load."""
    if route.request.url.startswith(("http://", "https://")):
        await route.abort()
    else:
        await route.continue_()


async def md_to_pdf(title: str, body_md: str) -> bytes:
    """Render the Markdown note to PDF via Chromium (same engine as the `browse` tool)
    — full CSS fidelity, CJK fonts, no extra dependency. Chromium is provisioned on
    first use (downloaded at runtime). Raises RuntimeError with a setup hint if the
    engine can't be made available."""
    try:
        from playwright.async_api import async_playwright
    except ImportError as e:
        raise RuntimeError(_PDF_HINT) from e
    _ensure_browsers_path()
    html = md_to_html_doc(title, body_md)
    try:
        async with async_playwright() as pw:
            try:
                browser = await pw.chromium.launch(headless=True)
            except Exception:  # noqa: BLE001 — most likely the browser isn't provisioned yet
                await asyncio.to_thread(_install_chromium)  # one-time download, then retry
                browser = await pw.chromium.launch(headless=True)
            try:
                page = await browser.new_page()
                await page.route("**/*", _block_remote)
                await page.set_content(html, wait_until="load")
                return await page.pdf(
                    format="A4",
                    print_background=True,
                    margin={"top": "18mm", "bottom": "18mm", "left": "16mm", "right": "16mm"},
                )
            finally:
                try:
                    await browser.close()
                except Exception:  # noqa: BLE001 — a cleanup error must not mask the real one
                    pass
    except RuntimeError:
        raise
    except Exception as e:  # noqa: BLE001 — browser provisioning or render failed
        raise RuntimeError(f"生成 PDF 失败:{e}。{_PDF_HINT}") from e


def _safe_sheet_title(name: str, used: set[str]) -> str:
    """An Excel-legal, unique worksheet title (≤31 chars, none of []:*?/\\)."""
    base = re.sub(r"[\[\]:*?/\\]", " ", str(name or "")).strip()[:31] or "Sheet"
    title, n = base, 1
    while title.lower() in used:
        suffix = f" ({n})"
        title = base[: 31 - len(suffix)] + suffix
        n += 1
    used.add(title.lower())
    return title


def rows_to_xlsx(sheets: list[tuple[str, list[str] | None, list[list[str]]]]) -> bytes:
    """One worksheet per (name, columns|None, rows). Header row (if any) is bold;
    columns are auto-sized to their longest cell."""
    import io as _io

    from openpyxl import Workbook
    from openpyxl.styles import Font

    wb = Workbook()
    wb.remove(wb.active)
    used: set[str] = set()
    for name, columns, rows in sheets:
        ws = wb.create_sheet(_safe_sheet_title(name, used))
        if columns:
            ws.append(list(columns))
            for cell in ws[1]:
                cell.font = Font(bold=True)
        for row in rows:
            ws.append([str(c) for c in row])
        for col in ws.columns:
            width = max((len(str(c.value or "")) for c in col), default=0)
            ws.column_dimensions[col[0].column_letter].width = min(max(width + 2, 8), 60)
    if not wb.sheetnames:
        wb.create_sheet("Sheet1")
    buf = _io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def outline_to_pptx(title: str, slides: list[dict]) -> bytes:
    """A title slide followed by one content slide per outline entry
    ({title, bullets, notes?}); each bullet is its own paragraph."""
    import io as _io

    from pptx import Presentation

    prs = Presentation()
    cover = prs.slides.add_slide(prs.slide_layouts[0])
    cover.shapes.title.text = title
    for sl in slides:
        slide = prs.slides.add_slide(prs.slide_layouts[1])
        slide.shapes.title.text = str(sl.get("title") or "")
        bullets = [str(b) for b in (sl.get("bullets") or [])]
        tf = slide.placeholders[1].text_frame
        if bullets:
            tf.text = bullets[0]
            for b in bullets[1:]:
                tf.add_paragraph().text = b
        if sl.get("notes"):
            slide.notes_slide.notes_text_frame.text = str(sl["notes"])
    buf = _io.BytesIO()
    prs.save(buf)
    return buf.getvalue()
