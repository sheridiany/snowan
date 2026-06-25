"""Snowan deck builder — a small themed wrapper over python-pptx that makes clean,
modern slides (one idea per slide) that look hand-crafted, not template-generated.

Two things most hand-written python-pptx gets wrong are fixed here:
 (1) the East-Asian typeface is set on every run, so Chinese renders in a real
     sans-serif (PingFang SC) instead of the ugly default serif; and
 (2) slides are built on the BLANK layout, so there are no default template fonts /
     bullets / pale-blue master to fight.

Design language (v2):
 - A dark/light "sandwich": cover / section / statement / closing are dark; body
   pages are light (white, never beige).
 - ONE visual motif — a small dot grid (`_motif`) — repeated everywhere. No
   decorative bars, stripes, underlines, or single-side card borders (all AI slop).
 - Every content page carries a visual element: square bullet markers, a big number,
   numbered step circles, a 2x2 matrix, color-headed cards, or a real table.
 - Constrained layout functions: you pass data, the function computes coordinates.
   Never hand-write coordinates from the calling deck script.

Usage (write a make_deck.py next to this file, then run it):

    from deck import Deck
    d = Deck("PI Agent 设计方案", palette="teal")
    d.cover("PI Agent:个人智能体设计方案", "从对话助手到可控的个人知识工作台", kicker="设计方案")
    d.section("01", "定位")
    d.bullets("不是聊天机器人,而是个人智能工作台", [
        "本地优先 — 数据留在你的机器上",
        "会用工具 — 文件 / 搜索 / Shell / 网页 / 知识库",
        "可控 — 工具门控 + 审批 + 全程可见",
    ], kicker="定位")
    d.bignum("规模压缩", "18→1", "把 18 个分散步骤收敛成 1 条主线", kicker="效率")
    d.statement("把架构搭稳,让 AI 成为你持续放大产能的队友。")
    d.closing("谢谢", "PI Agent · 个人智能工作台")
    d.save("PI Agent 设计方案.pptx")

Then QA it:  python qa.py "PI Agent 设计方案.pptx"
"""
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE
from pptx.oxml.ns import qn


def _c(hexstr):
    return RGBColor(int(hexstr[0:2], 16), int(hexstr[2:4], 16), int(hexstr[4:6], 16))


# --- color palettes -------------------------------------------------------
# Keys: ink/muted/faint/paper/line/dark/on_dark/on_dark_muted
#       main/aux1/accent/motif/motif_alt/risk/header
# Principle: one color dominates 60-70%, 1-2 support, one sharp accent.
# Never default to bright blue; paper is white or near-white, never beige.
PALETTES = {
    "teal": {
        "ink": _c("1A2B33"), "muted": _c("5B6B70"), "faint": _c("9AA7AB"),
        "paper": _c("FFFFFF"), "line": _c("E4ECEC"),
        "dark": _c("13233F"), "on_dark": _c("F4F0EA"), "on_dark_muted": _c("9FB0B5"),
        "main": _c("2BA39A"), "aux1": _c("1E3A5F"), "accent": _c("E8A33D"),
        "motif": _c("2BA39A"), "motif_alt": _c("E8A33D"),
        "risk": _c("D9636B"), "header": _c("13233F"),
        # low-contrast watermark tone (sits just above the dark bg)
        "watermark": _c("24375A"),
    },
    "warm": {
        "ink": _c("1C1B19"), "muted": _c("6B6359"), "faint": _c("A89E90"),
        "paper": _c("FCFBFA"), "line": _c("ECE5DA"),
        "dark": _c("171411"), "on_dark": _c("F4F0EA"), "on_dark_muted": _c("B7ADA0"),
        "main": _c("D9521E"), "aux1": _c("5A3A2A"), "accent": _c("E8A33D"),
        "motif": _c("D9521E"), "motif_alt": _c("E0A458"),
        "risk": _c("C2452E"), "header": _c("171411"),
        "watermark": _c("2A241E"),
    },
    "slate": {
        "ink": _c("1E2A30"), "muted": _c("5C6B72"), "faint": _c("96A4AB"),
        "paper": _c("FFFFFF"), "line": _c("E3E9EC"),
        "dark": _c("1B2A33"), "on_dark": _c("EEF2F4"), "on_dark_muted": _c("9AAAB2"),
        "main": _c("33566B"), "aux1": _c("5E7A88"), "accent": _c("E5634C"),
        "motif": _c("33566B"), "motif_alt": _c("E5634C"),
        "risk": _c("D9636B"), "header": _c("1B2A33"),
        "watermark": _c("2A3D48"),
    },
}

# keyword -> palette autodetect (cheap, optional)
_PALETTE_HINTS = {
    "warm": ("品牌", "营销", "创意", "温度", "故事", "文化"),
    "slate": ("风险", "合规", "安全", "财务", "审计", "治理", "严肃"),
}

FONT_LAT = "Helvetica Neue"          # latin
FONT_CJK = "PingFang SC"             # east-asian (macOS); the whole point of this file

W, H = Inches(13.333), Inches(7.5)
MX = Inches(0.92)                    # left/right margin (>= 0.5")
TOP = Inches(0.82)
WHITE = _c("FFFFFF")


def _typeface(run):
    """Set latin + east-asian + complex-script typefaces. python-pptx's font.name
    only touches latin, leaving CJK on the default serif — this fixes that."""
    rPr = run._r.get_or_add_rPr()
    for tag, face in (("a:latin", FONT_LAT), ("a:ea", FONT_CJK), ("a:cs", FONT_CJK)):
        el = rPr.find(qn(tag))
        if el is None:
            el = rPr.makeelement(qn(tag), {})
            rPr.append(el)
        el.set("typeface", face)


def _run(p, text, size, color, bold=False, tracking=None):
    """The single entry point for writing text. Always sets the EA typeface."""
    r = p.add_run()
    r.text = text
    r.font.size = Pt(size)
    r.font.bold = bold
    r.font.color.rgb = color
    _typeface(r)
    if tracking is not None:  # letter-spacing in 1/100 pt
        r._r.get_or_add_rPr().set("spc", str(tracking))
    return r


def _runs_in(tf, text, size, color, bold=False):
    """Write a single run into a fresh text_frame (e.g. a table cell), via _run so
    the EA typeface is set. Table cells are text_frames too — never use the raw
    cell.text setter, that bypasses _typeface and Chinese falls back to serif."""
    p = tf.paragraphs[0]
    _run(p, text, size, color, bold=bold)
    return p


class Deck:
    def __init__(self, footer="", palette="teal"):
        self.prs = Presentation()
        self.prs.slide_width = W
        self.prs.slide_height = H
        self.footer = footer
        self._n = 0
        self.p = PALETTES.get(palette, PALETTES["teal"])
        # the blank layout (no placeholders) — escape the default template entirely
        self._blank = self.prs.slide_layouts[6]

    @staticmethod
    def palette_for(text):
        """Cheap keyword autodetect; defaults to teal."""
        t = text or ""
        for name, hints in _PALETTE_HINTS.items():
            if any(h in t for h in hints):
                return name
        return "teal"

    # --- primitives -------------------------------------------------------
    def _slide(self, bg):
        s = self.prs.slides.add_slide(self._blank)
        r = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, W, H)
        r.fill.solid()
        r.fill.fore_color.rgb = bg
        r.line.fill.background()
        r.shadow.inherit = False
        return s

    def _box(self, s, x, y, w, h, anchor=MSO_ANCHOR.TOP):
        tb = s.shapes.add_textbox(x, y, w, h)
        tf = tb.text_frame
        tf.word_wrap = True
        tf.vertical_anchor = anchor
        tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
        return tf

    def _rect(self, s, x, y, w, h, color, shape=MSO_SHAPE.RECTANGLE):
        r = s.shapes.add_shape(shape, x, y, w, h)
        r.fill.solid()
        r.fill.fore_color.rgb = color
        r.line.fill.background()
        r.shadow.inherit = False
        return r

    # --- the one motif ----------------------------------------------------
    def _motif(self, s, x, y, cols=6, rows=4, color=None, alt=None, alt_idx=None,
               size=Inches(0.1), gap=Inches(0.16)):
        """The single repeated visual motif: a grid of small solid squares. A couple
        of accent squares (alt_idx, default the two diagonal corners) catch the eye.
        This replaces ALL decorative bars/stripes/underlines that v1 used."""
        color = color or self.p["motif"]
        alt = alt or self.p["motif_alt"]
        if alt_idx is None:
            alt_idx = {0, cols * rows - 1}
        step = size + gap
        k = 0
        for rr in range(rows):
            for cc in range(cols):
                cx = x + cc * step
                cy = y + rr * step
                col = alt if k in alt_idx else color
                self._rect(s, cx, cy, size, size, col)
                k += 1

    def _circle(self, s, x, y, d, num, fill, fg):
        """Solid circle with a centered reversed-out number; for steps()."""
        self._rect(s, x, y, d, d, fill, shape=MSO_SHAPE.OVAL)
        tf = self._box(s, x, y, d, d, anchor=MSO_ANCHOR.MIDDLE)
        p = tf.paragraphs[0]
        p.alignment = PP_ALIGN.CENTER
        _run(p, str(num), 18, fg, bold=True)

    # --- kicker / footer --------------------------------------------------
    def _kicker(self, s, text, x, y, color=None):
        color = color or self.p["accent"]
        tf = self._box(s, x, y, Inches(8), Inches(0.35))
        p = tf.paragraphs[0]
        _run(p, (text or "").upper(), 12.5, color, bold=True, tracking=220)

    def _footer(self, s, dark=False):
        self._n += 1
        col = self.p["on_dark_muted"] if dark else self.p["faint"]
        tf = self._box(s, MX, H - Inches(0.62), W - 2 * MX, Inches(0.3))
        _run(tf.paragraphs[0], self.footer, 10, col)
        tf2 = self._box(s, W - Inches(1.6), H - Inches(0.62), Inches(0.68), Inches(0.3))
        p2 = tf2.paragraphs[0]
        p2.alignment = PP_ALIGN.RIGHT
        _run(p2, str(self._n).zfill(2), 10, col)

    # --- dark sandwich pages ---------------------------------------------
    def cover(self, title, subtitle="", kicker=""):
        s = self._slide(self.p["dark"])
        if kicker:
            self._kicker(s, kicker, MX, Inches(2.1), self.p["accent"])
        tf = self._box(s, MX, Inches(2.65), Inches(9.6), Inches(2.6))
        _run(tf.paragraphs[0], title, 44, self.p["on_dark"], bold=True)
        if subtitle:
            p = tf.add_paragraph()
            p.space_before = Pt(16)
            _run(p, subtitle, 21, self.p["on_dark_muted"])
        # motif cluster, top-right corner
        self._motif(s, Inches(10.55), Inches(0.95), cols=6, rows=4)
        self._footer(s, dark=True)
        return s

    def section(self, number, title, tone=""):
        s = self._slide(self.p["dark"])
        risk = tone == "risk"
        wm = self.p["risk"] if risk else self.p["watermark"]
        mcol = self.p["risk"] if risk else self.p["motif"]
        malt = self.p["risk"] if risk else self.p["motif_alt"]
        # giant low-contrast watermark number, right side
        wtf = self._box(s, Inches(7.4), Inches(2.4), Inches(5.4), Inches(2.8),
                        anchor=MSO_ANCHOR.MIDDLE)
        wp = wtf.paragraphs[0]
        wp.alignment = PP_ALIGN.RIGHT
        _run(wp, str(number).zfill(2), 120, wm, bold=True)
        # number + title, left
        tf = self._box(s, MX, Inches(2.85), Inches(7.0), Inches(0.7))
        _run(tf.paragraphs[0], str(number), 22, self.p["accent"], bold=True, tracking=200)
        tf2 = self._box(s, MX, Inches(3.45), Inches(7.0), Inches(1.7))
        _run(tf2.paragraphs[0], title, 40, self.p["on_dark"], bold=True)
        # small motif cluster, bottom-left corner
        self._motif(s, MX, Inches(5.9), cols=5, rows=2, color=mcol, alt=malt,
                    alt_idx={0, 9})
        self._footer(s, dark=True)
        return s

    def statement(self, text, attribution=""):
        s = self._slide(self.p["dark"])
        # curl ASCII straight quotes in the text itself
        text = self._curl(text)
        # giant low-contrast opening quote, top-left (the motif's "enlarged variant")
        qtf = self._box(s, Inches(0.6), Inches(1.0), Inches(3.0), Inches(2.4))
        _run(qtf.paragraphs[0], "“", 150, self.p["watermark"], bold=True)
        tf = self._box(s, MX, Inches(3.0), W - 2 * MX, Inches(2.6))
        _run(tf.paragraphs[0], text, 33, self.p["on_dark"], bold=True)
        if attribution:
            p = tf.add_paragraph()
            p.space_before = Pt(18)
            _run(p, attribution, 16, self.p["on_dark_muted"])
        self._footer(s, dark=True)
        return s

    def closing(self, title, subtitle=""):
        s = self._slide(self.p["dark"])
        tf = self._box(s, 0, Inches(2.7), W, Inches(1.2), anchor=MSO_ANCHOR.TOP)
        p = tf.paragraphs[0]
        p.alignment = PP_ALIGN.CENTER
        _run(p, title, 44, self.p["on_dark"], bold=True)
        if subtitle:
            tf2 = self._box(s, 0, Inches(4.0), W, Inches(0.6))
            p2 = tf2.paragraphs[0]
            p2.alignment = PP_ALIGN.CENTER
            _run(p2, subtitle, 18, self.p["on_dark_muted"])
        # centered motif cluster echoing the cover (book-end)
        mw = 6 * (Inches(0.1) + Inches(0.16)) - Inches(0.16)
        self._motif(s, int(W / 2 - mw / 2), Inches(4.85), cols=6, rows=2,
                    alt_idx={0, 11})
        self._footer(s, dark=True)
        return s

    # --- light body pages -------------------------------------------------
    def _head(self, s, title, kicker=""):
        """Kicker + opinion-statement title (36pt). No underline. Returns body y."""
        if kicker:
            self._kicker(s, kicker, MX, TOP)
        y = TOP + (Inches(0.4) if kicker else Inches(0))
        tf = self._box(s, MX, y, W - 2 * MX, Inches(1.0))
        _run(tf.paragraphs[0], title, 36, self.p["ink"], bold=True)
        return y + Inches(1.15)

    def bullets(self, title, points, kicker=""):
        s = self._slide(self.p["paper"])
        y = self._head(s, title, kicker)
        if isinstance(points, str):
            points = points.split("\n")
        top = y + Inches(0.2)
        avail = H - top - Inches(0.9)
        n = max(1, len(points))
        sq = Inches(0.12)
        for i, pt in enumerate(points):
            row_y = top + int(avail * i / n)
            # square marker — a fragment of the motif, replaces the em-dash
            self._rect(s, MX, row_y + Inches(0.07), sq, sq, self.p["accent"])
            tf = self._box(s, MX + Inches(0.34), row_y, W - 2 * MX - Inches(0.34),
                           int(avail / n))
            p = tf.paragraphs[0]
            p.line_spacing = 1.25
            _run(p, pt, 18, self.p["ink"])
        self._footer(s)
        return s

    def columns(self, title, cols, kicker=""):
        """cols: list of (heading, [lines]); evenly-spaced cards with a color header
        band (no border). heading sits reversed-out in the band."""
        s = self._slide(self.p["paper"])
        y = self._head(s, title, kicker)
        n = max(1, len(cols))
        gap = Inches(0.3)
        total = W - 2 * MX
        cw = int((total - gap * (n - 1)) / n)
        top = y + Inches(0.2)
        ch = H - top - Inches(0.95)
        band_h = Inches(0.6)
        band_cols = [self.p["main"], self.p["aux1"], self.p["accent"]]
        for i, (heading, lines) in enumerate(cols):
            x = MX + i * (cw + gap)
            card = self._rect(s, x, top, cw, ch, WHITE, shape=MSO_SHAPE.ROUNDED_RECTANGLE)
            try:
                card.adjustments[0] = 0.05
            except Exception:
                pass
            band = self._rect(s, x, top, cw, band_h, band_cols[i % len(band_cols)],
                              shape=MSO_SHAPE.ROUND_2_SAME_RECTANGLE)
            try:
                band.adjustments[0] = 0.16
            except Exception:
                pass
            htf = self._box(s, x + Inches(0.24), top, cw - Inches(0.48), band_h,
                            anchor=MSO_ANCHOR.MIDDLE)
            _run(htf.paragraphs[0], heading, 17, self.p["on_dark"], bold=True)
            tf = self._box(s, x + Inches(0.24), top + band_h + Inches(0.18),
                           cw - Inches(0.48), ch - band_h - Inches(0.36))
            if isinstance(lines, str):
                lines = lines.split("\n")
            for j, ln in enumerate(lines):
                p = tf.paragraphs[0] if j == 0 else tf.add_paragraph()
                if j:
                    p.space_before = Pt(10)
                p.line_spacing = 1.2
                _run(p, ln, 15, self.p["muted"])
        self._footer(s)
        return s

    # --- data / structure pages ------------------------------------------
    def bignum(self, title, stat, caption, kicker="", note=""):
        """One key number as the visual hero (e.g. 18→1, ~1/10)."""
        s = self._slide(self.p["paper"])
        y = self._head(s, title, kicker)
        # giant number, single-line (horizontal overflow guarded)
        ntf = self._box(s, MX, y + Inches(0.55), Inches(9.5), Inches(1.8))
        _run(ntf.paragraphs[0], stat, 84, self.p["accent"], bold=True)
        ctf = self._box(s, MX, y + Inches(2.55), Inches(9.5), Inches(0.9))
        _run(ctf.paragraphs[0], caption, 16, self.p["ink"])
        if note:
            p = ctf.add_paragraph()
            p.space_before = Pt(8)
            _run(p, note, 11, self.p["muted"])
        # small motif cluster, bottom-right corner
        self._motif(s, Inches(11.0), Inches(5.4), cols=4, rows=3, size=Inches(0.09),
                    gap=Inches(0.14), alt_idx={0, 11})
        self._footer(s)
        return s

    def stat_row(self, title, stats, kicker=""):
        """2-4 parallel big metrics: stats=[(value, label), ...]. No vertical rules."""
        s = self._slide(self.p["paper"])
        y = self._head(s, title, kicker)
        n = max(1, len(stats))
        gap = Inches(0.4)
        total = W - 2 * MX
        cw = int((total - gap * (n - 1)) / n)
        top = y + Inches(0.6)
        cols = [self.p["main"], self.p["aux1"], self.p["accent"], self.p["main"]]
        for i, (value, label) in enumerate(stats):
            x = MX + i * (cw + gap)
            vtf = self._box(s, x, top, cw, Inches(1.3))
            _run(vtf.paragraphs[0], str(value), 50, cols[i % len(cols)], bold=True)
            ltf = self._box(s, x, top + Inches(1.4), cw, Inches(1.6))
            p = ltf.paragraphs[0]
            p.line_spacing = 1.2
            _run(p, label, 14, self.p["muted"])
        self._footer(s)
        return s

    def matrix(self, title, axes, cells, highlight=None, kicker=""):
        """2x2 quadrant matrix.
        axes = ((x_left, x_right), (y_top, y_bottom)) — axis labels.
        cells = [(heading, [lines]), ...] exactly 4, reading order TL, TR, BL, BR.
        highlight = cell index to fill dark + reverse out (the "fire here" cell)."""
        s = self._slide(self.p["paper"])
        y = self._head(s, title, kicker)
        (xl, xr), (yt, yb) = axes
        grid_x = MX + Inches(0.7)
        grid_y = y + Inches(0.55)
        grid_w = W - grid_x - MX
        grid_h = H - grid_y - Inches(0.95)
        gap = Inches(0.3)
        cw = int((grid_w - gap) / 2)
        chh = int((grid_h - gap) / 2)
        # axis labels
        for txt, bx, by, bw, bh, align in (
            (yt, MX - Inches(0.1), grid_y, Inches(0.75), chh, PP_ALIGN.LEFT),
            (yb, MX - Inches(0.1), grid_y + chh + gap, Inches(0.75), chh, PP_ALIGN.LEFT),
            (xl, grid_x, grid_y - Inches(0.4), cw, Inches(0.35), PP_ALIGN.LEFT),
            (xr, grid_x + cw + gap, grid_y - Inches(0.4), cw, Inches(0.35), PP_ALIGN.LEFT),
        ):
            if not txt:
                continue
            atf = self._box(s, bx, by, bw, bh, anchor=MSO_ANCHOR.MIDDLE)
            ap = atf.paragraphs[0]
            ap.alignment = align
            _run(ap, txt, 11, self.p["muted"], bold=True)
        for idx, (heading, lines) in enumerate(cells[:4]):
            r, c = divmod(idx, 2)
            x = grid_x + c * (cw + gap)
            cy = grid_y + r * (chh + gap)
            hot = highlight is not None and idx == highlight
            fill = self.p["dark"] if hot else WHITE
            fg = self.p["on_dark"] if hot else self.p["ink"]
            sub = self.p["on_dark_muted"] if hot else self.p["muted"]
            card = self._rect(s, x, cy, cw, chh, fill, shape=MSO_SHAPE.ROUNDED_RECTANGLE)
            try:
                card.adjustments[0] = 0.05
            except Exception:
                pass
            tf = self._box(s, x + Inches(0.26), cy + Inches(0.2), cw - Inches(0.52),
                           chh - Inches(0.4))
            head_txt = ("✓ " + heading) if hot else heading
            _run(tf.paragraphs[0], head_txt, 17, fg, bold=True)
            if isinstance(lines, str):
                lines = lines.split("\n")
            for ln in lines:
                p = tf.add_paragraph()
                p.space_before = Pt(7)
                p.line_spacing = 1.15
                _run(p, ln, 13, sub)
        self._footer(s)
        return s

    def steps(self, title, items, kicker=""):
        """Numbered steps: items=[(heading, desc), ...] (3-4). Accent circle + text."""
        s = self._slide(self.p["paper"])
        y = self._head(s, title, kicker)
        n = max(1, len(items))
        top = y + Inches(0.3)
        avail = H - top - Inches(0.9)
        d = Inches(0.6)
        for i, (heading, desc) in enumerate(items):
            row_y = top + int(avail * i / n)
            self._circle(s, MX, row_y, d, i + 1, self.p["accent"], WHITE)
            tx = MX + d + Inches(0.3)
            tw = W - tx - MX
            htf = self._box(s, tx, row_y - Inches(0.02), tw, Inches(0.45))
            _run(htf.paragraphs[0], heading, 18, self.p["ink"], bold=True)
            dtf = self._box(s, tx, row_y + Inches(0.42), tw, int(avail / n) - Inches(0.45))
            p = dtf.paragraphs[0]
            p.line_spacing = 1.2
            _run(p, desc, 14, self.p["muted"])
        self._footer(s)
        return s

    def compare(self, title, headers, rows, kicker="", accent_cols=None):
        """Color-header comparison table. headers: list; rows: 2D list.
        Real add_table — every cell written via _run so CJK keeps PingFang SC."""
        s = self._slide(self.p["paper"])
        y = self._head(s, title, kicker)
        accent_cols = set(accent_cols or [])
        ncol = len(headers)
        nrow = len(rows) + 1
        top = y + Inches(0.3)
        tw = W - 2 * MX
        th = H - top - Inches(0.95)
        gframe = s.shapes.add_table(nrow, ncol, MX, top, tw, th)
        # disable PowerPoint's banded-row style; we color rows ourselves
        tbl = gframe.table
        tbl.first_row = False
        tbl.horz_banding = False
        # header row
        for c in range(ncol):
            cell = tbl.cell(0, c)
            cell.fill.solid()
            cell.fill.fore_color.rgb = self.p["header"]
            cell.margin_left = cell.margin_right = Inches(0.12)
            cell.margin_top = cell.margin_bottom = Inches(0.06)
            cell.vertical_anchor = MSO_ANCHOR.MIDDLE
            _runs_in(cell.text_frame, str(headers[c]), 14, self.p["on_dark"], bold=True)
        # data rows: white / faint cool-grey alternating (never beige)
        alt = _c("F2F6F7")
        for ri, row in enumerate(rows):
            bg = WHITE if ri % 2 == 0 else alt
            for c in range(ncol):
                cell = tbl.cell(ri + 1, c)
                cell.fill.solid()
                cell.fill.fore_color.rgb = bg
                cell.margin_left = cell.margin_right = Inches(0.12)
                cell.margin_top = cell.margin_bottom = Inches(0.06)
                cell.vertical_anchor = MSO_ANCHOR.MIDDLE
                col = self.p["accent"] if c in accent_cols else self.p["ink"]
                bold = c in accent_cols
                _runs_in(cell.text_frame, str(row[c]), 13, col, bold=bold)
        self._footer(s)
        return s

    @staticmethod
    def _curl(text):
        """Replace paired ASCII double-quotes with CJK curly quotes."""
        out = []
        open_q = True
        for ch in text:
            if ch == '"':
                out.append("“" if open_q else "”")
                open_q = not open_q
            else:
                out.append(ch)
        return "".join(out)

    def save(self, path):
        self.prs.save(path)
        return path
