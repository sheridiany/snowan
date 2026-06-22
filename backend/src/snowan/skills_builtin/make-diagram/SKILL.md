---
name: make-diagram
description: 画图示模式——把架构 / 流程 / 结构 / 概念画成一张干净、专业、信息完整的内联中文 SVG 图(用 render_diagram 渲染)
---

# 画一张专业的内联 SVG 图示

目标:**一张图把事情讲清楚——干净、专业、信息完整**,像认真画给同事看的白板图,不是简笔画。用 `render_diagram(svg, title)` 直接内联渲染。下面每条都为"不重叠、不溢出、不坍缩"服务,逐条遵守。

## 0. 三条铁律(其余都为它们服务)

1. **信息保真,绝不坍缩**。源里有 12 个组件就画 12 个——用**分层**或**泳道**把它们组织进**同一张**画布。把十几个东西压成 5 个大盒子,是这套图最严重的失败。装得下就别拆;真要拆是因为它是两个独立主题,而不是因为"东西多"。
2. **内容用中文**。所有标签中文;产品名 / 协议 / 缩写保留原文(PostgreSQL、Redis、Firecracker、Docker、Kafka、BOM、ECN、MCP、LLM…)。
3. **颜色编码类别,不编码顺序**。把节点**按类别分组、同类同色**(如:客户端=teal、服务=purple、数据/基础设施=gray);**一张图 2-3 色**,别 6+,更**别像彩虹那样每步 / 每盒换色**(那是把颜色当装饰,最廉价)。颜色一旦编码含义,底部加一行图例。

## 1. 先定布局(决定一切)

数清源里的名词和角色,选一种骨架,再动笔:

- **分层图(最常用)**——系统架构、技术栈、"它怎么分层"。横向分若干带(band),自上而下:客户端 → 网关 → 服务 → 数据。每带左侧一个**层标签**(`ts` 灰字),带内 1–4 个等宽盒子,带与带之间竖直向下箭头。见第 7 节完整范例。
- **泳道图**——跨角色 / 跨部门流程,"谁负责什么""流程怎么流转"。纵向分 2–3 条泳道(每条=一个角色:设计 / PM / 采购),顶部泳道标题(`th`),泳道间用**竖直虚线**(`leader` 类)分隔;盒子按流程在泳道内 / 跨泳道排布,用**曲线箭头**连。需要时加**第二条强调色流**(回流 / 变更 / 异常)。
- **简单流程 / 结构图**——步骤不多、无角色无分层。框 + 箭头一条线走下来,或嵌套框表达"谁包含谁"。
- **示意图**——让人"感觉"机制怎么运作("注意力怎么 work")。画隐喻,不要怂回流程图。
- **数据库 ERD / 时序图 / 状态机 / 甘特**:不要硬用 SVG 画,改让用户用 mermaid(`load_skill("mermaid-diagram")`)。

## 2. 画布

- 永远 `<svg width="100%" viewBox="0 0 680 H">`。**680 写死**(对齐渲染容器宽度,字宽计算才准,绝不改)。渲染面会把它放大到约 760px 宽。
- `H` = 所有元素最底边(含图例)+ 20。**排完版再算 H**,下方不留大片空白。
- 安全区 x=40..640、y=40..(H-40),坐标**全部 ≥0**。
- 背景透明,**直接输出裸 `<svg>`**(渲染面已有卡片背景,别再套带背景的 `<div>`)。
- **一次只含一个 `<svg>`**;第一版不对就整段重画,别追加修正版。

## 3. 文字与配色(用预置 class)

- 每个 `<text>` 带 class:`th`(14px 中黑,盒子主标题)、`t`(14px 常规)、`ts`(12px,副描述 / 层标签 / 箭头标签)。**只用 14 和 12 两种字号**。
- 上色:中性 / 结构件用 `box` 或 `c-gray`;**一般类别优先 `c-purple / c-teal / c-coral / c-pink`**;`c-blue / c-green / c-amber / c-red` **留给真正的"信息 / 成功 / 警告 / 错误"语义**。class 放在形状或它**直接父 `<g>`** 上(隔层会失效变黑)。
- **同类同色,2-3 色**:按节点**类别**上色(如 客户端 / 服务 / 数据 各一色),同一类所有节点同色;别每盒一色(彩虹),整图别超过 3 色。"另一种流向"(回流 / 变更 / 异常)可单独占一色,用虚线 + `c-amber`/`c-coral`。一旦用颜色编码含义,底部加一行图例。
- 副描述 `ts` ≤ 8 字,真有信息,不凑字。框内只放文字,不放图标 / 插画 / 装饰大数字。无渐变、无阴影。

## 4. 字宽(中文防溢出的关键)

SVG 文字**不换行**。放字前估宽:
- **中文 / 全角符号:满宽**——14px 字号 ≈ 每字 **14px**,12px ≈ 每字 **12px**。
- 英文 / 数字 / 空格 / 半角:≈ 0.55em——14px ≈ **8px**/字,12px ≈ **7px**/字。
- 判断 `估算宽度 + 2×20(padding)` 是否 ≤ 框宽;塞不下 → 缩短标签**或**加宽框。
- 框内文字垂直居中:`text-anchor="middle"` + `dominant-baseline="central"`(缺 `dominant-baseline` 字会偏上)。

## 5. 连接线(带这段 defs,优先用曲线)

每张图开头放一次:

```
<defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>
```

- 连线 class `arr` + `marker-end="url(#arrow)"`;**所有当连线的 `<path>`/`<polyline>` 必须 `fill="none"`**(否则黑色填充糊成一团)。
- 对齐的框之间走**直线**;错位的框之间走**三次贝塞尔曲线**更专业:`<path class="arr" d="M x1 y1 C x1 my x2 my x2 y2" .../>`(`my` 取两端 y 的中点,得到平滑的 S 弯)。需要绕开别的框时才走 L 形折线。
- 箭头标签用 `ts`,放在线的中点旁(别压在线上);标签能省则省,箭头含义自明就不写。
- 第二条流向(回流 / 变更)用虚线:在该 `<path>` 上加 `stroke-dasharray="5 4"` 并配强调色描边。

## 6. 布局数学(画每个框 / 线前先算)

- **排内等分**:一排 n 个框、间距 g,框宽 w = (600 − (n−1)·g) / n。例:3 框、g=20 → w=186.7,起点 x=40,依次 +(w+g)。一排 ≤4 框。
- **箭头不穿框**:每条线坐标和已放的每个框比一遍,会穿就改走曲线 / 折线绕开。
- **间距**:层 / 行间距 ≥28px,同排框间 ≥20px,框内 padding 20px,箭头头距框 ≥4px。两行框(标题+副描述)高 ≥48px。
- **单方向**:整图统一上→下 **或** 左→右,别混。
- **环形别画成圈**(事件循环 / GC / 重传):用一条返回箭头表示"回到开头"即可,别画satellite圈。

## 7. 完整范例(分层架构——三类三色,照着这个改,别坍缩成 5 个盒子)

```
<svg width="100%" viewBox="0 0 680 384" xmlns="http://www.w3.org/2000/svg">
  <defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>

  <text class="ts" x="40" y="46">客户端</text>
  <g class="node c-teal"><rect x="40" y="54" width="186" height="50" rx="9"/><text class="th" x="133" y="74" text-anchor="middle" dominant-baseline="central">桌面端</text><text class="ts" x="133" y="91" text-anchor="middle" dominant-baseline="central">Electron + Go</text></g>
  <g class="node c-teal"><rect x="246" y="54" width="186" height="50" rx="9"/><text class="th" x="339" y="74" text-anchor="middle" dominant-baseline="central">网页端</text><text class="ts" x="339" y="91" text-anchor="middle" dominant-baseline="central">React + TypeScript</text></g>
  <g class="node c-teal"><rect x="452" y="54" width="186" height="50" rx="9"/><text class="th" x="545" y="74" text-anchor="middle" dominant-baseline="central">控制台</text><text class="ts" x="545" y="91" text-anchor="middle" dominant-baseline="central">管理后台</text></g>
  <path class="arr" d="M133 106 L133 130" marker-end="url(#arrow)"/>
  <path class="arr" d="M339 106 L339 130" marker-end="url(#arrow)"/>
  <path class="arr" d="M545 106 L545 130" marker-end="url(#arrow)"/>

  <text class="ts" x="40" y="124">网关</text>
  <g class="node c-purple"><rect x="40" y="132" width="598" height="50" rx="9"/><text class="th" x="339" y="152" text-anchor="middle" dominant-baseline="central">API 网关</text><text class="ts" x="339" y="169" text-anchor="middle" dominant-baseline="central">反向代理 · 鉴权 · 限流 · 风险扫描</text></g>
  <path class="arr" d="M339 184 L339 206" marker-end="url(#arrow)"/>

  <text class="ts" x="40" y="200">核心服务</text>
  <g class="node c-purple"><rect x="40" y="208" width="289" height="50" rx="9"/><text class="th" x="184" y="228" text-anchor="middle" dominant-baseline="central">API 服务</text><text class="ts" x="184" y="245" text-anchor="middle" dominant-baseline="central">鉴权 · 权限 · 审计 · 资源</text></g>
  <g class="node c-purple"><rect x="349" y="208" width="289" height="50" rx="9"/><text class="th" x="493" y="228" text-anchor="middle" dominant-baseline="central">Worker</text><text class="ts" x="493" y="245" text-anchor="middle" dominant-baseline="central">agent 循环 · LLM 路由 · 工具</text></g>
  <path class="arr" d="M184 260 L184 282" marker-end="url(#arrow)"/>
  <text class="ts" x="196" y="274">数据访问</text>

  <text class="ts" x="40" y="276">数据与基础设施</text>
  <g class="node c-gray"><rect x="40" y="284" width="186" height="50" rx="9"/><text class="th" x="133" y="304" text-anchor="middle" dominant-baseline="central">PostgreSQL</text><text class="ts" x="133" y="321" text-anchor="middle" dominant-baseline="central">关系数据</text></g>
  <g class="node c-gray"><rect x="246" y="284" width="186" height="50" rx="9"/><text class="th" x="339" y="304" text-anchor="middle" dominant-baseline="central">Redis</text><text class="ts" x="339" y="321" text-anchor="middle" dominant-baseline="central">缓存 · 队列</text></g>
  <g class="node c-gray"><rect x="452" y="284" width="186" height="50" rx="9"/><text class="th" x="545" y="304" text-anchor="middle" dominant-baseline="central">向量库</text><text class="ts" x="545" y="321" text-anchor="middle" dominant-baseline="central">向量记忆</text></g>

  <g class="c-teal"><rect x="40" y="351" width="13" height="13" rx="3"/></g>
  <text class="ts" x="60" y="358" dominant-baseline="central">客户端</text>
  <g class="c-purple"><rect x="140" y="351" width="13" height="13" rx="3"/></g>
  <text class="ts" x="160" y="358" dominant-baseline="central">服务</text>
  <g class="c-gray"><rect x="226" y="351" width="13" height="13" rx="3"/></g>
  <text class="ts" x="246" y="358" dominant-baseline="central">基础设施</text>
</svg>
```

注意它怎么做到的:**12 个组件全保留**、分 4 层、每层左侧标签、盒子等宽对齐、竖直箭头、**按类别三色**(客户端 teal · 服务 purple · 基础设施 gray)+ 底部图例、全中文。颜色编码的是**类别**而不是顺序——这就是"信息完整且专业"。换成泳道图时同理:把"层"换成"角色纵列",竖直箭头换成跨列曲线。

## 8. 收尾

- 干净优先,但**干净 ≠ 删内容**——靠布局组织信息,而不是砍掉信息。
- 画前在心里把坐标过一遍(框宽够不够装中文、排宽、箭头是否穿框、H 够不够)。
- 调用 `render_diagram(svg, title)`(title 用中文),并在正文里用一两句话说这张图讲清了什么。
