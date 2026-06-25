---
name: make-slides
description: 生成幻灯片模式——把主题或内容做成结构清晰、每页一个要点、设计现代的 PowerPoint(.pptx),可直接下载
---

# 生成幻灯片

目标:把用户的主题/内容做成一套**结构清晰、每页一个要点、视觉现代**的 PowerPoint(原生 .pptx)。

**别裸写 python-pptx**——默认版式会得到惨白浅蓝底 + 衬线宋体的"办公模板脸",而且中文字体设不对(`font.name` 只管拉丁字体,中文会 fallback 成衬线)。本技能自带一个主题化构建器 `deck.py`,已经把现代无衬线字体(含中文 ea typeface)、精致暖色配色、封面/分节/正文/金句版式都封装好。**用它,只调函数。**

## 流程

1. **定大纲**。把内容拆成 8–16 页:封面 → 分节 →(主体每页一个要点)→ 金句/结论 → 收尾。先把提纲(每页标题 + 1–3 个要点)给用户看一眼;主题清楚的可直接做。素材不够就先 `web_search` / `web_fetch` 或读用户给的附件/笔记。
2. **取构建器**。`read_skill_resource("make-slides", "deck.py")` 拿到代码,用 `write_file` 原样写到 workspace 的 `deck.py`(**别改它**)。
3. **写脚本**。`write_file` 写一个 `make_deck.py`:`from deck import Deck`,按大纲调下面的版式函数建每页,最后 `d.save("<主题>.pptx")`。
4. **生成 + 自查**。`execute_shell_command` 跑 `python make_deck.py`;报错就读报错、改脚本、重跑,直到文件生成成功。生成后**回看一遍**:页数是否合理、有没有一页塞太多、深浅页是否交替、标题是否写成了观点。
   - **兜底**:若环境缺 `python-pptx` 等导致 deck.py 始终跑不通,改用进程内的 `create_slides(title, slides)` 至少先产出可用 `.pptx`(样式较朴素,但稳),别让用户拿不到文件。
5. **展示**。deck.py 路径生成的用 `present_artifact(path, title)` 展示(`create_slides` 会自动展示);并在回复里用文字概述每页讲了什么。

## deck.py API

```python
from deck import Deck
d = Deck("页脚文字")                                   # 页脚品牌/主题,出现在每页底部 + 自动页码

d.cover(title, subtitle="", kicker="")               # 封面:深色大标题页。kicker 是 2–6 字栏目名
d.section(number, title)                             # 分节页(深色):number 如 "01" / "02"
d.bullets(title, points, kicker="")                  # 正文(浅色):points 是字符串列表,3–5 条
d.columns(title, cols, kicker="")                    # 并列卡片(浅色):cols = [(小标题, [行, ...]), ...],2–3 列
d.statement(text, attribution="")                    # 金句页(深色):放一句关键结论
d.closing(title, subtitle="")                        # 收尾页(深色)

d.save("<主题>.pptx")                                 # 相对路径 = 存进 workspace
```

每页函数返回该 slide;无需手动设字体/颜色/坐标——构建器全包了。

## 设计纪律(决定好不好看)

- **一页一个要点**。别把整段塞进一页。`bullets` 每页 ≤ 5 条,每条尽量 ≤ 24 字、是短句不是段落。
- **用对版式**:并列/对比(如"可用 · 可信 · 可控")用 `columns`;一句关键结论用 `statement`;章节切换用 `section`。
- **节奏感**:封面/分节/金句/收尾是深色页,正文是浅色页——深浅交替本身就是结构。一套 12 页通常 4–5 个深色页 + 7–8 个浅色页。
- **kicker** 放栏目名(如"定位""核心目标""落地路线"),让正文页有眉头、成体系。
- 标题写**观点**而不是名词(写"不是聊天机器人,而是工作台",别写"产品定位")。

## 质量底线

- 结构完整:有封面、有分节主线、有结论、有收尾。
- 一定用 `deck.py` 的函数生成,别回退去裸写 python-pptx 或套默认 `slide_layouts`。
- 生成后**一定** `present_artifact` 让用户能下载——别只描述不给文件。
- 脚本报错就改了重跑,别把报错丢给用户。
