"""Snowan slide QA — structural, render-free.

Snowan ships no renderer (no LibreOffice), so QA reads the .pptx back with
python-pptx and estimates, per text frame, whether text overflows its box using a
geometry + character-width model. It also flags box-vs-box collisions (auto-fit
boxes that regrow and overrun the shape stacked below), empty boxes, mojibake,
leftover placeholders, missing East-Asian fonts (the CJK-serif regression guard),
straight quotes in CJK, out-of-bounds shapes, and v1 decorative-bar regressions.

Width model: CJK ideographs are full-em squares (~1.0em in PingFang SC), so they
are NOT shrunk by the Latin proportional factor — under-counting CJK width would
bias toward MISSED overflow, not toward a safe false TIGHT.

Every deck.py box is auto-fit (SHAPE_TO_FIT_TEXT), so its stored height is not a
binding constraint — PowerPoint regrows it on render. Vertical fit is therefore
judged by collision with neighbours, not by needed-vs-stored-height; the
needed-vs-height OVERFLOW_V/TIGHT check applies only to fixed-height boxes.

    python qa.py deck.pptx          # human-readable report, exit 1 on any ERROR

If `soffice` happens to be installed, you MAY additionally render to images for a
human eye-check — but QA never depends on it; absence is silently skipped.
"""
import sys
import re
import shutil

from pptx import Presentation
from pptx.enum.shapes import MSO_SHAPE_TYPE

EMU_PER_PT = 12700
EMU_PER_IN = 914400
SLIDE_W_IN = 13.333
SLIDE_H_IN = 7.5

# per-glyph advance in em (font-size units), as a fraction of the point size.
# CJK ideographs in PingFang SC are full-em squares — ~1.0em wide — so they must
# NOT be scaled by the Latin proportional factor. Latin/space advances are the
# proportional-font correction baked in directly (Helvetica Neue lower-case avg).
ADV_CJK = 1.00
ADV_CJK_BOLD = 1.02
ADV_LATIN = 0.52
ADV_LATIN_BOLD = 0.55
ADV_SPACE = 0.26
LINE_TO_FONT = 1.2  # built-in leading ratio (natural line height / font size)

PLACEHOLDER_RE = re.compile(
    r"lorem ipsum|\btodo\b|\btbd\b|占位符|placeholder|\bxxx+\b|\{\{|\}\}|\[insert", re.I)


def _is_cjk(ch):
    o = ord(ch)
    return (0x4E00 <= o <= 0x9FFF or 0x3000 <= o <= 0x303F or
            0xFF00 <= o <= 0xFFEF or 0x3040 <= o <= 0x30FF)


def _has_cjk(text):
    return any(_is_cjk(c) for c in text)


def _char_adv(ch, size_pt, bold):
    """Advance of a single glyph in points. CJK is treated as a full-em square
    (no Latin proportional shrink); Latin/space carry the proportional factor."""
    if _is_cjk(ch):
        return size_pt * (ADV_CJK_BOLD if bold else ADV_CJK)
    if ch == " ":
        return size_pt * ADV_SPACE
    return size_pt * (ADV_LATIN_BOLD if bold else ADV_LATIN)


def _wrap_lines(text, size_pt, avail_w_pt, bold):
    """Greedy line-break: CJK breaks per-char; long latin tokens don't split.
    Returns (n_lines, max_line_width_pt)."""
    lines = 1
    cur = 0.0
    maxw = 0.0
    token = ""

    def flush_token():
        nonlocal cur, lines, maxw, token
        if not token:
            return
        tw = sum(_char_adv(c, size_pt, bold) for c in token)
        if cur > 0 and cur + tw > avail_w_pt:
            maxw = max(maxw, cur)
            lines += 1
            cur = 0.0
        cur += tw
        token = ""

    for ch in text:
        if _is_cjk(ch) or ch == " ":
            flush_token()
            adv = _char_adv(ch, size_pt, bold)
            if cur > 0 and cur + adv > avail_w_pt:
                maxw = max(maxw, cur)
                lines += 1
                cur = 0.0
            cur += adv
        else:
            token += ch
    flush_token()
    maxw = max(maxw, cur)
    return lines, maxw


def _emu_to_pt(v):
    return (v or 0) / EMU_PER_PT


def _para_size_bold(para):
    sizes = []
    bold = False
    text = ""
    for r in para.runs:
        text += r.text
        if r.font.size is not None:
            sizes.append(r.font.size.pt)
        if r.font.bold:
            bold = True
    size = max(sizes) if sizes else 18.0
    return text, size, bold


def _line_spacing(para, size_pt):
    """Per-line height in points.

    A float/int line_spacing is a DrawingML spcPct multiple. Per ISO/IEC 29500,
    omitted spacing == one natural line == size * LINE_TO_FONT, and a percentage
    scales *that* natural line. So the multiple and the LINE_TO_FONT leading are
    distinct factors, not a double-count: ls=1.0 must reproduce the omitted-spacing
    default (size * LINE_TO_FONT), which only holds if both factors are applied.
    An a:spcPts value is an absolute line height in points and overrides leading."""
    ls = para.line_spacing
    if ls is None:
        return size_pt * LINE_TO_FONT
    if isinstance(ls, (float, int)):
        return size_pt * ls * LINE_TO_FONT
    return ls.pt  # Pt absolute (spcPts)


def _space(val):
    return val.pt if val is not None else 0.0


def _frame_needed_h(tf, avail_w_pt):
    """Estimated needed height (pt) and the widest single-line width (pt)."""
    total = 0.0
    widest = 0.0
    for para in tf.paragraphs:
        text, size, bold = _para_size_bold(para)
        if not text.strip():
            total += size * LINE_TO_FONT  # empty line still takes a line
            continue
        n_lines, line_w = _wrap_lines(text, size, avail_w_pt, bold)
        widest = max(widest, line_w)
        lh = _line_spacing(para, size)
        total += n_lines * lh + _space(para.space_before) + _space(para.space_after)
    return total, widest


class Report:
    def __init__(self):
        self.findings = []

    def add(self, slide, shape_id, level, code, detail, fix_hint=""):
        self.findings.append(dict(slide=slide, shape_id=shape_id, level=level,
                                  code=code, detail=detail, fix_hint=fix_hint))

    @property
    def errors(self):
        return [f for f in self.findings if f["level"] == "ERROR"]


def _word_wrap_off(tf):
    return tf.word_wrap is False


def _is_autofit(tf):
    """True when the box is MSO_AUTO_SIZE.SHAPE_TO_FIT_TEXT (<a:spAutoFit/>).
    Such a box is regrown to fit on render, so its stored height is not a binding
    constraint — vertical fit must be judged by collision with neighbours instead."""
    from pptx.oxml.ns import qn
    bodyPr = tf._txBody.find(qn("a:bodyPr"))
    return bodyPr is not None and bodyPr.find(qn("a:spAutoFit")) is not None


def _anchor(tf):
    from pptx.oxml.ns import qn
    bodyPr = tf._txBody.find(qn("a:bodyPr"))
    return (bodyPr.get("anchor") if bodyPr is not None else None) or "t"


def _grown_box(shape, tf):
    """For an auto-fit box, the (top_pt, bottom_pt) PowerPoint regrows it to, given
    the text it holds. Top-anchored boxes grow downward; middle/bottom-anchored grow
    symmetrically/upward. Returns the vertical span in points (slide coords)."""
    top_pt = _emu_to_pt(shape.top)
    h_pt = _emu_to_pt(shape.height)
    ml = _emu_to_pt(tf.margin_left)
    mr = _emu_to_pt(tf.margin_right)
    mt = _emu_to_pt(tf.margin_top)
    mb = _emu_to_pt(tf.margin_bottom)
    avail_w = max(1.0, _emu_to_pt(shape.width) - ml - mr)
    needed, _ = _frame_needed_h(tf, avail_w)
    grown_h = needed + mt + mb
    anc = _anchor(tf)
    if anc == "t":
        return top_pt, top_pt + grown_h
    if anc == "b":
        bottom = top_pt + h_pt
        return bottom - grown_h, bottom
    center = top_pt + h_pt / 2.0
    return center - grown_h / 2.0, center + grown_h / 2.0


def check(path):
    prs = Presentation(path)
    rep = Report()

    for si, slide in enumerate(prs.slides, 1):
        for shape in slide.shapes:
            sid = shape.shape_id
            _check_bounds(rep, si, shape)
            if shape.has_table:
                _check_table(rep, si, shape)
                continue
            is_textbox = shape.shape_type == MSO_SHAPE_TYPE.TEXT_BOX
            if not shape.has_text_frame:
                _check_decor_bar(rep, si, shape)
                continue
            tf = shape.text_frame
            raw = tf.text
            # Auto-shapes (motif squares, bg rect, step circles) legitimately carry an
            # empty text_frame — only flag EMPTY_BOX on author-created text boxes.
            if not raw.strip():
                if is_textbox:
                    rep.add(si, sid, "ERROR", "EMPTY_BOX", "text box is empty",
                            "remove the empty box or fill it")
                continue
            _check_text_content(rep, si, sid, tf, raw)
            _check_overflow(rep, si, sid, shape, tf, is_textbox)
            _check_fonts(rep, si, sid, tf)
        _check_collisions(rep, si, slide)

    return rep


def _check_collisions(rep, si, slide):
    """Auto-fit boxes regrow to fit their text; a box that grows past where the next
    shape below it sits (and overlaps it horizontally) collides — the real failure
    mode the stored-height OVERFLOW_V check misses. Compare each text box's grown
    vertical span against the stored top of every horizontally-overlapping shape
    placed below it."""
    boxes = []
    for shape in slide.shapes:
        if not shape.has_text_frame or shape.left is None or shape.top is None:
            continue
        tf = shape.text_frame
        if not tf.text.strip():
            continue
        x0 = _emu_to_pt(shape.left)
        x1 = x0 + _emu_to_pt(shape.width)
        top = _emu_to_pt(shape.top)
        bot = top + _emu_to_pt(shape.height)
        if _is_autofit(tf):
            gtop, gbot = _grown_box(shape, tf)
        else:
            gtop, gbot = top, bot
        boxes.append(dict(sid=shape.shape_id, x0=x0, x1=x1, top=top, bot=bot,
                          gtop=gtop, gbot=gbot, text=tf.text.strip()))

    tol = 4.0  # pt — small slack so touching edges don't false-positive
    for a in boxes:
        for b in boxes:
            if a is b:
                continue
            if b["top"] <= a["top"]:  # only consider b sitting below a's origin
                continue
            x_overlap = min(a["x1"], b["x1"]) - max(a["x0"], b["x0"])
            if x_overlap <= 1.0:
                continue
            # Only flag overlap *caused by growth*: if a's stored box already overlaps
            # b, it's an intentional layered overlap (e.g. the section watermark number
            # or the statement quote sitting behind a title), not a regrowth collision.
            if a["bot"] > b["top"] + tol:
                continue
            if a["gbot"] > b["top"] + tol:
                over = a["gbot"] - b["top"]
                rep.add(si, a["sid"], "ERROR", "BOX_COLLISION",
                        f"auto-fit box grows {over:.0f}pt past its box into shape "
                        f"below (sid {b['sid']}) — text {a['text'][:24]!r}",
                        "cut text / fewer items, or split across slides; "
                        "do not hand-tune coordinates")
                break


def _check_bounds(rep, si, shape):
    if shape.left is None or shape.top is None:
        return
    l = shape.left / EMU_PER_IN
    t = shape.top / EMU_PER_IN
    w = (shape.width or 0) / EMU_PER_IN
    h = (shape.height or 0) / EMU_PER_IN
    tol = 0.02
    if l < -tol or t < -tol or l + w > SLIDE_W_IN + tol or t + h > SLIDE_H_IN + tol:
        rep.add(si, shape.shape_id, "ERROR", "OUT_OF_BOUNDS",
                f"shape at ({l:.2f},{t:.2f}) {w:.2f}x{h:.2f}in exceeds 13.33x7.5",
                "use a constrained layout fn; don't hand-write coordinates")
        return
    # margin (text only). Centered boxes (closing title, etc.) are intentionally
    # full-width and exempt.
    if shape.has_text_frame and shape.text_frame.text.strip():
        from pptx.enum.text import PP_ALIGN as _A
        centered = any(p.alignment == _A.CENTER for p in shape.text_frame.paragraphs)
        if not centered and (l < 0.5 - tol or l + w > 12.83 + tol):
            rep.add(si, shape.shape_id, "WARN", "MARGIN_VIOLATION",
                    f"text box left={l:.2f} right={l + w:.2f} outside 0.5-12.83in",
                    "keep page margins >= 0.5in")


def _check_text_content(rep, si, sid, tf, raw):
    if PLACEHOLDER_RE.search(raw):
        rep.add(si, sid, "ERROR", "PLACEHOLDER_LEFT",
                f"placeholder text: {raw[:40]!r}", "replace placeholder with real content")
    if "标题" == raw.strip() or "副标题" == raw.strip():
        rep.add(si, sid, "ERROR", "PLACEHOLDER_LEFT",
                f"untouched template text: {raw[:20]!r}", "replace with real content")
    for ch in raw:
        o = ord(ch)
        if ch == "�" or 0xE000 <= o <= 0xF8FF:
            rep.add(si, sid, "ERROR", "MOJIBAKE",
                    f"replacement/private-use char U+{o:04X} in {raw[:30]!r}",
                    "fix the source encoding")
            break
    if _has_cjk(raw) and ('"' in raw or "'" in raw):
        rep.add(si, sid, "WARN", "STRAIGHT_QUOTE",
                "ASCII quote in CJK text", "use curly quotes “ ” ‘ ’")


def _check_overflow(rep, si, sid, shape, tf, is_textbox=True):
    w_pt = _emu_to_pt(shape.width)
    h_pt = _emu_to_pt(shape.height)
    ml = _emu_to_pt(tf.margin_left)
    mr = _emu_to_pt(tf.margin_right)
    mt = _emu_to_pt(tf.margin_top)
    mb = _emu_to_pt(tf.margin_bottom)
    avail_w = max(1.0, w_pt - ml - mr)
    avail_h = max(1.0, h_pt - mt - mb)
    needed, widest = _frame_needed_h(tf, avail_w)

    if _word_wrap_off(tf) and widest > avail_w:
        rep.add(si, sid, "ERROR", "OVERFLOW_H",
                f"single line {widest:.0f}pt > box {avail_w:.0f}pt",
                "shorten the text or reduce font size")

    # An auto-fit (SHAPE_TO_FIT_TEXT) box regrows to fit its text on render, so its
    # stored height is not a binding constraint — comparing needed vs stored height
    # would measure the wrong thing. Vertical fit for those boxes is judged by
    # _check_collisions (the box grows and collides with the shape stacked below);
    # only fixed-height boxes get the needed-vs-height OVERFLOW_V/TIGHT check.
    if not _is_autofit(tf):
        ratio = needed / avail_h
        if ratio > 1.10:
            rep.add(si, sid, "ERROR", "OVERFLOW_V",
                    f"needs {needed:.0f}pt vs {avail_h:.0f}pt ({(ratio - 1) * 100:.0f}% over)",
                    "cut text, fewer bullets, or split across slides")
        elif ratio > 1.02:
            rep.add(si, sid, "WARN", "OVERFLOW_V",
                    f"needs {needed:.0f}pt vs {avail_h:.0f}pt ({(ratio - 1) * 100:.0f}% over)",
                    "trim slightly to be safe")
        elif ratio > 0.92:
            rep.add(si, sid, "WARN", "TIGHT",
                    f"needs {needed:.0f}pt vs {avail_h:.0f}pt (fills {ratio * 100:.0f}%)",
                    "consider trimming for breathing room")

    # font size sanity. Footers/page-numbers (bottom band) and captions/notes are
    # legitimately small; only judge the primary body zone.
    top_in = (shape.top or 0) / EMU_PER_IN
    if top_in >= 6.7:  # footer band
        return
    for para in tf.paragraphs:
        text, size, _ = _para_size_bold(para)
        if not text.strip():
            continue
        if 1.4 < top_in < 1.6 and 24 <= size < 28:
            rep.add(si, sid, "WARN", "FONT_TOO_SMALL",
                    f"title-area run {size:.0f}pt < 28pt", "titles should be 28-44pt")
        elif size < 11 and top_in >= 1.6:
            rep.add(si, sid, "WARN", "FONT_TOO_SMALL",
                    f"body run {size:.0f}pt is very small", "body text >= 14pt (CJK 15-18)")


def _check_fonts(rep, si, sid, tf):
    """MISSING_EA_FONT — the core regression guard. Every CJK-bearing run must carry
    a:ea = PingFang SC, else Chinese falls back to serif. Catches anyone bypassing
    _run (including table cells)."""
    from pptx.oxml.ns import qn
    for para in tf.paragraphs:
        for r in para.runs:
            if not _has_cjk(r.text):
                continue
            rPr = r._r.find(qn("a:rPr"))
            ea = None
            if rPr is not None:
                el = rPr.find(qn("a:ea"))
                if el is not None:
                    ea = el.get("typeface")
            if ea != "PingFang SC":
                rep.add(si, sid, "ERROR", "MISSING_EA_FONT",
                        f"CJK run missing a:ea PingFang SC (got {ea!r}): {r.text[:20]!r}",
                        "write text via _run/_runs_in, never raw add_run or cell.text")
                return


def _check_decor_bar(rep, si, shape):
    if shape.shape_type != MSO_SHAPE_TYPE.AUTO_SHAPE:
        return
    if shape.width is None or shape.height is None:
        return
    w = shape.width / EMU_PER_IN
    h = shape.height / EMU_PER_IN
    if h <= 0:
        return
    if h < 0.1 and w / h > 8:
        try:
            solid = shape.fill.type is not None
        except Exception:
            solid = False
        if solid:
            rep.add(si, shape.shape_id, "WARN", "DECOR_BAR_REGRESSION",
                    f"thin bar {w:.2f}x{h:.2f}in (aspect {w / h:.0f}:1)",
                    "v2 removed decorative bars; use the dot motif instead")


def _check_table(rep, si, shape):
    from pptx.oxml.ns import qn
    tbl = shape.table
    # estimate column width: total / ncol (python-pptx exposes per-col width)
    cols = list(tbl.columns)
    ncol = len(cols)
    rows = list(tbl.rows)
    for ri, row in enumerate(rows):
        row_h_pt = _emu_to_pt(row.height)
        for ci in range(ncol):
            cell = tbl.cell(ri, ci)
            col_w_pt = _emu_to_pt(cols[ci].width)
            ml = _emu_to_pt(cell.margin_left)
            mr = _emu_to_pt(cell.margin_right)
            avail_w = max(1.0, col_w_pt - ml - mr)
            tf = cell.text_frame
            raw = tf.text
            if PLACEHOLDER_RE.search(raw):
                rep.add(si, shape.shape_id, "ERROR", "PLACEHOLDER_LEFT",
                        f"cell({ri},{ci}) placeholder: {raw[:30]!r}", "replace placeholder")
            # font guard on cells
            for para in tf.paragraphs:
                for r in para.runs:
                    if not _has_cjk(r.text):
                        continue
                    rPr = r._r.find(qn("a:rPr"))
                    ea = rPr.find(qn("a:ea")).get("typeface") if (
                        rPr is not None and rPr.find(qn("a:ea")) is not None) else None
                    if ea != "PingFang SC":
                        rep.add(si, shape.shape_id, "ERROR", "MISSING_EA_FONT",
                                f"cell({ri},{ci}) CJK run missing PingFang SC ea-font",
                                "write cells via _runs_in")
            # estimate cell height need vs set row height (row height is a minimum)
            needed, widest = _frame_needed_h(tf, avail_w)
            mt = _emu_to_pt(cell.margin_top)
            mb = _emu_to_pt(cell.margin_bottom)
            if row_h_pt > 0 and needed + mt + mb > row_h_pt * 1.05:
                rep.add(si, shape.shape_id, "WARN", "TABLE_CELL_OVERFLOW",
                        f"cell({ri},{ci}) needs {needed:.0f}pt > row {row_h_pt:.0f}pt",
                        "shorten cell text; table rows auto-grow and break layout")


def _maybe_soffice_note():
    if shutil.which("soffice"):
        return ("note: soffice is available — you MAY render to images for an "
                "optional human eye-check (qa is already complete without it).")
    return None


def main():
    if len(sys.argv) < 2:
        print("usage: python qa.py deck.pptx")
        return 2
    path = sys.argv[1]
    rep = check(path)

    by_slide = {}
    for f in rep.findings:
        by_slide.setdefault(f["slide"], []).append(f)

    order = {"ERROR": 0, "WARN": 1, "INFO": 2}
    for si in sorted(by_slide):
        fs = sorted(by_slide[si], key=lambda f: order.get(f["level"], 3))
        print(f"\n— slide {si} —")
        for f in fs:
            print(f"  [{f['level']}] {f['code']}: {f['detail']}")
            if f["fix_hint"]:
                print(f"          fix: {f['fix_hint']}")

    n_err = len(rep.errors)
    n_warn = sum(1 for f in rep.findings if f["level"] == "WARN")
    n_info = sum(1 for f in rep.findings if f["level"] == "INFO")
    print()
    note = _maybe_soffice_note()
    if note:
        print(note)
    if not rep.findings:
        print("PASS — no issues found.")
        return 0
    if n_err == 0:
        print(f"PASS with warnings — 0 errors, {n_warn} warnings, {n_info} info.")
        return 0
    print(f"FAIL — {n_err} errors, {n_warn} warnings, {n_info} info.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
