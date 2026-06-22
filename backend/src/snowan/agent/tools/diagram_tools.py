"""Render a clean inline SVG diagram (flowchart / structural / illustrative) directly
in the chat. The chat layer turns a successful call into a `diagram` SSE event the
frontend renders inline, themed by the pre-built `t/ts/box/c-*` CSS classes."""


def render_diagram(svg: str, title: str = "") -> str:
    """画一张干净的内联 SVG 图示(结构图/流程图/架构图/概念图),直接渲染给用户。svg 是完整 <svg> 源码,title 是图标题。第一次画前先 load_skill("make-diagram") 读完整规范。

    必守硬规则(违反就会重叠/溢出/糊):
    - 一次只画一个 <svg>,用 `<svg width="100%" viewBox="0 0 680 H">`(680 固定不可改;H = 内容最底边 + 20)。坐标全部 ≥0,内容留在 x=40..640。
    - 文字必须带 class:`t`(14px 主)、`th`(14px 中黑)、`ts`(12px 次)——只用这两种字号,别的一律不用。
    - 方框用 class `box`;上色用 `c-blue / c-teal / c-amber / c-green / c-red / c-purple / c-gray`(放在形状或它的直接父 <g> 上,别隔层)。颜色一旦编码含义,就配一行图例。≤2 个色阶。
    - 字宽估算:14px≈每字 8px、12px≈每字 7px。放字前先算 (字宽 + 2×24padding) 是否塞得进框;塞不下就缩短标签或加宽框。SVG 文字不会自动换行。
    - 连线/箭头的 <path>/<polyline> 必须 fill="none";描边 0.5px;箭头统一用文末 marker。框内文字 `dominant-baseline="central"`。
    - 同排框间距 ≥20px,任何线不得穿过别的框(会穿就走 L 形折线)。一排 ≤4 框、整图 ≤5 节点;超了拆成多张(每张之间用正文一句话过渡)。
    - 扁平:无渐变、阴影、图标、装饰大数字。标签简洁、副标题 ≤5 词。环形流程不要画成圈,用一条返回箭头表示。
    """
    s = (svg or "").strip()
    if not s.startswith("<svg"):
        return "error: svg 必须是完整的 <svg ...>…</svg> 源码"
    if "viewBox" not in s[:200]:
        return "error: <svg> 需带 viewBox=\"0 0 680 H\""
    return f"已把图示「{title or '图'}」渲染给用户。"
