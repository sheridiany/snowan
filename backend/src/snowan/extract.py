"""Text extraction from documents, shared by chat attachments and the local-folder
knowledge source. Office/PDF parsers are imported lazily."""
import io
import mimetypes
from pathlib import Path


def extract_text(name: str, mime: str, raw: bytes) -> str | None:
    """Readable text from office/pdf documents. None if not a known doc type."""
    ext = name.lower().rsplit(".", 1)[-1] if "." in name else ""
    try:
        if ext in ("xlsx", "xlsm") or "spreadsheetml" in mime:
            from openpyxl import load_workbook

            wb = load_workbook(io.BytesIO(raw), read_only=True, data_only=True)
            out: list[str] = []
            for ws in wb.worksheets:
                out.append(f"## {ws.title}")
                for row in ws.iter_rows(values_only=True):
                    cells = [str(c) for c in row if c is not None]
                    if cells:
                        out.append(" | ".join(cells))
            return "\n".join(out)
        if ext == "docx" or "wordprocessingml" in mime:
            import docx

            d = docx.Document(io.BytesIO(raw))
            return "\n".join(p.text for p in d.paragraphs if p.text.strip())
        if ext == "pdf" or mime == "application/pdf":
            from pypdf import PdfReader

            reader = PdfReader(io.BytesIO(raw))
            return "\n\n".join((pg.extract_text() or "") for pg in reader.pages)
        if ext == "pptx" or "presentationml" in mime:
            from pptx import Presentation

            prs = Presentation(io.BytesIO(raw))
            out2: list[str] = []
            for i, slide in enumerate(prs.slides, 1):
                out2.append(f"## Slide {i}")
                for shape in slide.shapes:
                    if shape.has_text_frame and shape.text_frame.text.strip():
                        out2.append(shape.text_frame.text)
            return "\n".join(out2)
    except Exception:  # noqa: BLE001 — an unparseable doc just falls through
        return None
    return None


def extract_file(path: Path) -> str | None:
    """Text from a file on disk: office/pdf via extract_text, else a utf-8 decode.
    None if unreadable or binary."""
    try:
        raw = path.read_bytes()
    except OSError:
        return None
    mime = mimetypes.guess_type(path.name)[0] or ""
    text = extract_text(path.name, mime, raw)
    if text is not None:
        return text
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError:
        return None
