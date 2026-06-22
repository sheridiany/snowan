"""Render a clean inline SVG diagram (flowchart / structural / illustrative) directly
in the chat. The chat layer turns a successful call into a `diagram` SSE event the
frontend renders inline, themed by the pre-built `t/ts/box/c-*` CSS classes."""


def render_diagram(svg: str, title: str = "") -> str:
    """画一张干净专业的内联 SVG 图示(架构/流程/结构/概念图),直接渲染给用户。**内容全用中文**(产品名/协议/缩写保留原文)。svg 是完整 <svg> 源码,title 是中文图标题。第一次画前先 load_skill("make-diagram") 读完整规范(分层/泳道布局 + 范例)。

    必守硬规则(违反就会重叠/溢出/糊):
    - 一次只画一个 <svg>,用 `<svg width="100%" viewBox="0 0 680 H">`(680 固定不可改;H = 内容最底边 + 20)。坐标全部 ≥0,内容留在 x=40..640。
    - 文字必须带 class:`t`(14px 主)、`th`(14px 中黑)、`ts`(12px 次)——只用这两种字号,别的一律不用。
    - 上色:中性/结构件用 `box`/`c-gray`;一般类别优先 `c-purple/c-teal/c-coral/c-pink`,`c-blue/c-green/c-amber/c-red` 留给"信息/成功/警告/错误"语义(class 放形状或它直接父 <g>,别隔层)。**颜色编码类别:同类同色,整图 2-3 色**;别每盒一色(彩虹),编码含义就配一行图例。
    - 字宽估算:中文/全角算满宽(14px≈每字 14px、12px≈每字 12px),英文数字≈0.55em(14px≈8px、12px≈7px)。放字前算 (估宽 + 2×20padding) 是否塞得进框;塞不下就缩短或加宽。SVG 文字不会自动换行。
    - 连线/箭头的 <path>/<polyline> 必须 fill="none";描边 0.5px;箭头统一用文末 marker。框内文字 `dominant-baseline="central"`。
    - 信息保真别坍缩:源里多少组件就画多少,用分层/泳道组织进同一张(别压成几个大盒子)。一排 ≤4 框;框间距 ≥20px;错位的框用三次贝塞尔曲线连;任何线不得穿过别的框(会穿就绕)。
    - 扁平:无渐变、阴影、图标、装饰大数字。标签简洁、副标题 ≤5 词。环形流程不要画成圈,用一条返回箭头表示。
    """
    s = (svg or "").strip()
    if not s.startswith("<svg"):
        return "error: svg 必须是完整的 <svg ...>…</svg> 源码"
    if "viewBox" not in s[:200]:
        return "error: <svg> 需带 viewBox=\"0 0 680 H\""
    return f"已把图示「{title or '图'}」渲染给用户。"
