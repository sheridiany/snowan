"""Document export: render a Markdown note (or sanitized article HTML) to a
standalone HTML page or a Word .docx. No pandoc — the docx side is a small
markdown-it token walker covering headings, paragraphs, lists, code and inline
emphasis/links. PDF is intentionally out of scope (would need a new dep)."""
import io
import re

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
    base = re.sub(r'[\\/:*?"<>|\n\r\t]+', " ", title).strip()[:80].strip() or "未命名"
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


def html_to_html_doc(title: str, body_html: str) -> str:
    """Wrap already-sanitized article HTML into a standalone, styled page."""
    return _wrap_html(title, nh3.clean(body_html))


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
