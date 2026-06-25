---
name: make-slides
description: 生成幻灯片模式——把主题或内容做成结构清晰、每页一个要点、版式多样、设计现代的 PowerPoint(.pptx),可直接下载
---

# 生成幻灯片

目标:把用户的主题/内容做成一套**结构清晰、每页一个要点、版式多样、视觉现代**的 PowerPoint(原生 .pptx),看起来像精心排过版,而不是套模板。

**别裸写 python-pptx**——默认版式会得到惨白浅蓝底 + 衬线宋体的"办公模板脸",而且中文字体设不对(`font.name` 只管拉丁字体,中文会 fallback 成衬线宋体)。本技能自带一个主题化构建器 `deck.py`,已经把现代无衬线字体(含中文 ea typeface)、多套品牌配色、深浅三明治版式、点阵视觉母题、大数字 / 矩阵 / 序号步骤 / 对比表等多样版式都封装好。**用它,只调函数,别裸写坐标。**

并配有结构化质检脚本 `qa.py`(运行时无渲染器,纯几何 + 字数估算):查溢出 / 空框 / 占位符 / 乱码 / 缺中文字体 / 越界。**生成后必须跑 QA,有 ERROR 必修。**

## 流程

1. **定大纲**。把内容拆成 12–18 页:封面 → 分节 →(主体每页一个要点,**版式多样**)→ 金句/结论 → 收尾。先把提纲(每页标题 + 选用的版式 + 1–3 个要点)给用户看一眼;主题清楚的可直接做。素材不够就先 `web_search` / `web_fetch` 或读用户给的附件/笔记。**数据优先用大数字 / 并列指标 / 对比表 / 矩阵 / 序号步骤来表达,不要全塞进 bullet。**
2. **取构建器**。`read_skill_resource("make-slides", "deck.py")` 和 `read_skill_resource("make-slides", "qa.py")` 拿到代码,用 `write_file` 原样写到 workspace 的 `deck.py` / `qa.py`(**别改它们**)。
3. **写脚本**。`write_file` 写一个 `make_deck.py`:`from deck import Deck`,选一套配色,按大纲调下面的版式函数建每页,最后 `d.save("<主题>.pptx")`。
4. **生成**。`execute_shell_command` 跑 `python make_deck.py`;报错就读报错、改脚本、重跑,直到文件生成成功。
5. **QA(必做,只过一轮)**。
   - 跑 `python qa.py "<主题>.pptx"`,读结构化报告。
   - **有 ERROR 必修**:溢出(OVERFLOW_V/H)、框相撞(BOX_COLLISION,文字撑大后压到下方的框——文太长就减字 / 拆页 / 减条目)、越界(OUT_OF_BOUNDS)、空框(EMPTY_BOX)、乱码(MOJIBAKE)、缺中文字体(MISSING_EA_FONT)、占位符(PLACEHOLDER_LEFT)。改 `make_deck.py`(减字 / 拆页 / 换版式),重跑 `make_deck.py` 再跑 `qa.py`,**确认 ERROR 归零**。
   - **WARN 评估**:TIGHT / 略微溢出 / 字号偏小 / 直引号 / 页边距——能改则改,不改也要心里有数。
   - **退出码**:有 ERROR 时 `qa.py` 退出码非 0,可直接用于流程判定。
   - **可选人眼复核**:`qa.py` 会提示机器是否装了 `soffice`;装了才可额外 `soffice --headless --convert-to pdf` 渲染人眼看一遍;没装就**跳过**,结构化 QA 是唯一主路径,绝不依赖 soffice。
   - **兜底**:若环境缺 `python-pptx` 等导致 deck.py 始终跑不通,改用进程内的 `create_slides(title, slides)` 至少先产出可用 `.pptx`(样式较朴素,但稳),别让用户拿不到文件。
6. **展示**。deck.py 路径生成的用 `present_artifact(path, title)` 展示(`create_slides` 会自动展示);并在回复里用文字概述每页讲了什么。

## deck.py API

```python
from deck import Deck

# 选配色:teal(默认,蓝绿+金)/ warm(暖橙)/ slate(冷静深蓝灰+珊瑚)
d = Deck("页脚文字", palette="teal")
# 不确定配色时可让它按主题关键词自动选:
#   d = Deck("页脚", palette=Deck.palette_for("风险与合规审查"))   # -> slate

# —— 深色三明治页(封面/分节/金句/收尾)——
d.cover(title, subtitle="", kicker="")          # 封面:深色大标题 + 右上点阵母题。kicker 是 2–6 字栏目名
d.section(number, title, tone="")               # 分节页:深色 + 120pt 水印数字。tone="risk" 整页母题/水印切红
d.statement(text, attribution="")               # 金句页:深色 + 巨型弯引号。text 里成对的 ASCII " 会自动变弯引号
d.closing(title, subtitle="")                   # 收尾页:深色居中 + 点阵母题(与封面呼应)

# —— 浅色正文页(每页都自带一个视觉元素)——
d.bullets(title, points, kicker="")             # 要点:每条前置 accent 小方块 marker。points ≤ 5 条,短句
d.columns(title, cols, kicker="")               # 并列卡片:色头白卡(无描边)。cols=[(小标题,[行,...]),...],2–3 列

# —— 数据/结构页(把数据做成视觉主角)——
d.bignum(title, stat, caption, kicker="", note="")   # 单个大数字:如 "18→1"、"~1/10"。stat 是主角,caption 说明,note 注脚
d.stat_row(title, stats, kicker="")             # 2–4 个并列大指标:stats=[(值, 说明), ...]
d.matrix(title, axes, cells, highlight=None, kicker="")
        # 2×2 象限矩阵。axes=((x左,x右),(y上,y下));cells=[(小标题,[行,...]),...] 正好 4 个(读序 左上→右上→左下→右下)
        # highlight=格index → 该格深色高亮 + 反白 + ✓("先打这里")
d.steps(title, items, kicker="")                # 序号步骤:items=[(小标题, 描述), ...] 3–4 步,带 accent 序号圆圈
d.compare(title, headers, rows, kicker="", accent_cols=None)
        # 对比表:真表格,色头反白行 + 冷灰交替行。headers 是表头列表,rows 是二维列表,accent_cols 指定强调列

d.save("<主题>.pptx")                            # 相对路径 = 存进 workspace
```

每页函数返回该 slide;无需手动设字体/颜色/坐标——构建器全包了。**绝不在调用脚本里裸写坐标或自己 add_shape**:受约束的版式函数是"不溢出、字体对"的可靠性前提。

### 调用示例

```python
d = Deck("产品设计方案", palette="teal")
d.cover("不是聊天机器人,而是个人智能工作台", "本地优先 · 可控 · 成果可下载", kicker="设计方案")
d.section("01", "为什么是现在")
d.bignum("把复杂度压下去", "18→1", "把 18 个分散步骤收敛成 1 条可复用主线", kicker="效率", note="基于 12 个真实任务中位数")
d.stat_row("三个硬指标", [("99.2%","审批门控覆盖"), ("0","运行时渲染器依赖"), ("3×","成果产出提速")], kicker="量化")
d.steps("从想法到成果", [("定大纲","先列骨架"),("选版式","每页一个视觉元素"),("跑 QA","结构化查溢出"),("演示","ERROR 归零再 present")], kicker="流程")
d.matrix("先打哪里", (("低难度","高难度"),("高影响","低影响")),
         [("先打这里",["高影响+低难度"]),("排期",["高影响+难"]),("顺手",["低影响+易"]),("先别碰",["低影响+难"])],
         highlight=0, kicker="优先级")
d.columns("三条底线", [("可用",["把活干完","可下载"]),("可信",["来源可溯","记忆可查"]),("可控",["审批门控","过程透明"])], kicker="原则")
d.compare("旧流程 vs 新方案", ["维度","旧","新"], [["数据","散在云端","本地优先"],["工具","黑盒","门控可见"]], accent_cols=[2])
d.section("03", "风险与边界", tone="risk")
d.statement("把架构搭稳,让 AI 成为你持续放大产能的队友。", "— 设计原则")
d.closing("谢谢", "产品 · 个人智能工作台")
d.save("产品设计方案.pptx")
```

## 设计纪律(决定好不好看)

- **配色**:从 `PALETTES` 选 1 套(默认 teal),选与主题相关、有主次的配色——一色占 60–70% 主导 + 1–2 辅助 + 1 个锐利强调色。**别默认蓝,别在脚本里硬编码单一颜色。**
- **深/浅三明治**:封面/分节/金句/收尾深色,正文浅色。深浅交替本身就是结构。一套 14 页通常 5–6 个深色页 + 8–9 个浅色页。
- **唯一母题**:认准并重复**一个**点阵母题(`_motif`,deck.py 内部已在各页布好)。**绝不**用色条 / 装饰条 / 竖边条 / 标题下横线 / 卡片单边描边当母题——这些都是 AI slop 的标志(v2 已全删,`qa.py` 的 `DECOR_BAR_REGRESSION` 会兜底防回归)。
- **每页一个视觉元素**:禁止纯标题 + bullet 的同构页。数据优先用大数字(`bignum`/`stat_row`)、并列对比(`compare`)、时间线步骤(`steps`)、象限矩阵(`matrix`)、色头卡(`columns`);bullet 的方块 marker 也算视觉元素,但别整套都用 bullets。
- **排版**:正文左对齐,只有标题/收尾居中;标题写成**观点句**不是名词(写"不是聊天机器人,而是工作台",别写"产品定位")。字号:标题 36–44 / 分节头 38–40 / 正文 15–18(中文) / 注释 10–12;页边距 ≥ 0.5",块间距固定 0.3–0.5"(都由版式函数保证)。
- **kicker** 放栏目名(如"定位""量化""落地路线"),让正文页有眉头、成体系。
- **禁忌**:绝不米色底(用白 / 品牌色);绝不让文字溢出框;中文引号用弯引号 `“ ”`(`statement` 会自动转,其余文本你自己写弯引号)。

## 质量底线

- 结构完整:有封面、有分节主线、有数据/结论页、有收尾;版式多样不同构。
- 一定用 `deck.py` 的版式函数生成,别回退去裸写 python-pptx 或套默认 `slide_layouts`,别在脚本里手写坐标。
- **生成后一定跑 `qa.py`,ERROR 必修、修一轮、复跑确认归零**;不要把溢出/越界/占位符的稿子交给用户。
- 一定 `present_artifact` 让用户能下载——别只描述不给文件。
- 脚本报错就改了重跑,别把报错丢给用户。
