"""Snowan deck builder — a small themed wrapper over python-pptx that makes clean,
modern slides (one idea per slide). Two things most hand-written python-pptx gets
wrong are fixed here: (1) the East-Asian typeface is set on every run, so Chinese
renders in a real sans-serif (PingFang SC) instead of the ugly default serif; and
(2) slides are built on the BLANK layout, so there are no default template fonts /
bullets / pale-blue master to fight.

Usage (write a make_deck.py next to this file, then run it):

    from deck import Deck
    d = Deck("PI Agent 设计方案")                      # footer label
    d.cover("PI Agent:个人智能体设计方案",
            "从对话助手到可控的个人知识工作台", kicker="设计方案")
    d.section("01", "定位")
    d.bullets("不是聊天机器人,而是个人智能工作台", [
        "本地优先 — 数据留在你的机器上",
        "会用工具 — 文件 / 搜索 / Shell / 网页 / 知识库",
        "可控 — 工具门控 + 审批 + 全程可见",
    ], kicker="定位")
    d.columns("核心目标", [
        ("可用", ["能真的把活干完", "成果物可下载"]),
        ("可信", ["来源可溯", "记忆可查"]),
        ("可控", ["审批门控", "过程透明"]),
    ])
    d.statement("把架构搭稳,让 AI 成为你持续放大产能的队友。")
    d.closing("谢谢", "PI Agent · 个人智能工作台")
    d.save("PI Agent 设计方案.pptx")
"""
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE
from pptx.oxml.ns import qn

# --- theme ----------------------------------------------------------------
INK = RGBColor(0x1C, 0x1B, 0x19)     # primary text
MUTED = RGBColor(0x6B, 0x63, 0x59)   # secondary text
FAINT = RGBColor(0xA8, 0x9E, 0x90)   # footer / tertiary
PAPER = RGBColor(0xFB, 0xFA, 0xF7)   # warm off-white content bg
LINE = RGBColor(0xEC, 0xE5, 0xDA)    # hairline / card border
ACCENT = RGBColor(0xD9, 0x52, 0x1E)  # warm vivid accent
ACCENT_SOFT = RGBColor(0xF3, 0xE6, 0xDD)  # accent tint for cards
DARK = RGBColor(0x17, 0x14, 0x11)    # cover / section bg
ON_DARK = RGBColor(0xF4, 0xF0, 0xEA)
ON_DARK_MUTED = RGBColor(0xB7, 0xAD, 0xA0)

FONT_LAT = "Helvetica Neue"          # latin
FONT_CJK = "PingFang SC"             # east-asian (macOS); the whole point of this file

W, H = Inches(13.333), Inches(7.5)
MX = Inches(0.92)                    # left/right margin
TOP = Inches(0.82)


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
    r = p.add_run()
    r.text = text
    r.font.size = Pt(size)
    r.font.bold = bold
    r.font.color.rgb = color
    _typeface(r)
    if tracking is not None:  # letter-spacing in 1/100 pt
        r._r.get_or_add_rPr().set("spc", str(tracking))
    return r


class Deck:
    def __init__(self, footer=""):
        self.prs = Presentation()
        self.prs.slide_width = W
        self.prs.slide_height = H
        self.footer = footer
        self._n = 0
        # the blank layout (no placeholders) — escape the default template entirely
        self._blank = self.prs.slide_layouts[6]

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

    def _line(self, s, x, y, w, color=ACCENT, h=Pt(3)):
        r = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, x, y, w, h)
        r.fill.solid()
        r.fill.fore_color.rgb = color
        r.line.fill.background()
        r.shadow.inherit = False
        return r

    def _kicker(self, s, text, x, y, color=ACCENT):
        tf = self._box(s, x, y, Inches(8), Inches(0.35))
        p = tf.paragraphs[0]
        _run(p, (text or "").upper(), 12.5, color, bold=True, tracking=220)

    def _footer(self, s, dark=False):
        self._n += 1
        tf = self._box(s, MX, H - Inches(0.62), W - 2 * MX, Inches(0.3))
        p = tf.paragraphs[0]
        col = ON_DARK_MUTED if dark else FAINT
        _run(p, self.footer, 10, col)
        # page number, right-aligned
        tf2 = self._box(s, W - Inches(1.6), H - Inches(0.62), Inches(0.68), Inches(0.3))
        p2 = tf2.paragraphs[0]
        p2.alignment = PP_ALIGN.RIGHT
        _run(p2, str(self._n).zfill(2), 10, col)

    # --- layouts ----------------------------------------------------------
    def cover(self, title, subtitle="", kicker=""):
        s = self._slide(DARK)
        self._line(s, MX, Inches(2.55), Inches(0.62), ACCENT, h=Pt(4))
        if kicker:
            self._kicker(s, kicker, MX, Inches(2.05), ACCENT)
        tf = self._box(s, MX, Inches(2.8), Inches(10.6), Inches(2.4))
        _run(tf.paragraphs[0], title, 46, ON_DARK, bold=True)
        if subtitle:
            p = tf.add_paragraph()
            p.space_before = Pt(16)
            _run(p, subtitle, 21, ON_DARK_MUTED)
        self._footer(s, dark=True)
        return s

    def section(self, number, title):
        s = self._slide(DARK)
        tf = self._box(s, MX, Inches(2.3), Inches(11), Inches(0.9))
        _run(tf.paragraphs[0], str(number), 22, ACCENT, bold=True, tracking=200)
        self._line(s, MX, Inches(3.05), Inches(0.62), ACCENT, h=Pt(4))
        tf2 = self._box(s, MX, Inches(3.35), Inches(11), Inches(1.6))
        _run(tf2.paragraphs[0], title, 40, ON_DARK, bold=True)
        self._footer(s, dark=True)
        return s

    def _head(self, s, title, kicker=""):
        if kicker:
            self._kicker(s, kicker, MX, TOP)
        y = TOP + (Inches(0.4) if kicker else Inches(0))
        tf = self._box(s, MX, y, W - 2 * MX, Inches(1.0))
        _run(tf.paragraphs[0], title, 29, INK, bold=True)
        self._line(s, MX, y + Inches(0.85), Inches(0.55), ACCENT, h=Pt(3))
        return y + Inches(1.2)

    def bullets(self, title, points, kicker=""):
        s = self._slide(PAPER)
        y = self._head(s, title, kicker)
        tf = self._box(s, MX, y + Inches(0.15), W - 2 * MX, H - y - Inches(1.0))
        for i, pt in enumerate(points):
            p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
            p.space_after = Pt(14)
            p.line_spacing = 1.25
            _run(p, "—  ", 19, ACCENT, bold=True)
            _run(p, pt, 19, INK)
        self._footer(s)
        return s

    def columns(self, title, cols, kicker=""):
        """cols: list of (heading, [lines]); rendered as evenly-spaced cards."""
        s = self._slide(PAPER)
        y = self._head(s, title, kicker)
        n = max(1, len(cols))
        gap = Inches(0.3)
        total = W - 2 * MX
        cw = int((total - gap * (n - 1)) / n)
        top = y + Inches(0.25)
        ch = H - top - Inches(1.0)
        for i, (heading, lines) in enumerate(cols):
            x = MX + i * (cw + gap)
            card = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, top, cw, ch)
            card.fill.solid()
            card.fill.fore_color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
            card.line.color.rgb = LINE
            card.line.width = Pt(1)
            card.shadow.inherit = False
            try:
                card.adjustments[0] = 0.06
            except Exception:
                pass
            tf = self._box(s, x + Inches(0.28), top + Inches(0.28), cw - Inches(0.56), ch - Inches(0.5))
            _run(tf.paragraphs[0], heading, 19, ACCENT, bold=True)
            for ln in lines:
                p = tf.add_paragraph()
                p.space_before = Pt(10)
                p.line_spacing = 1.2
                _run(p, ln, 15, MUTED)
        self._footer(s)
        return s

    def statement(self, text, attribution=""):
        s = self._slide(DARK)
        self._line(s, MX, Inches(2.55), Inches(0.62), ACCENT, h=Pt(4))
        tf = self._box(s, MX, Inches(2.85), W - 2 * MX, Inches(2.6), anchor=MSO_ANCHOR.TOP)
        _run(tf.paragraphs[0], text, 33, ON_DARK, bold=True)
        if attribution:
            p = tf.add_paragraph()
            p.space_before = Pt(18)
            _run(p, attribution, 16, ON_DARK_MUTED)
        self._footer(s, dark=True)
        return s

    def closing(self, title, subtitle=""):
        s = self._slide(DARK)
        tf = self._box(s, 0, Inches(2.9), W, Inches(1.5), anchor=MSO_ANCHOR.TOP)
        p = tf.paragraphs[0]
        p.alignment = PP_ALIGN.CENTER
        _run(p, title, 44, ON_DARK, bold=True)
        if subtitle:
            tf2 = self._box(s, 0, Inches(4.35), W, Inches(0.6))
            p2 = tf2.paragraphs[0]
            p2.alignment = PP_ALIGN.CENTER
            _run(p2, subtitle, 18, ON_DARK_MUTED)
        self._footer(s, dark=True)
        return s

    def save(self, path):
        self.prs.save(path)
        return path
