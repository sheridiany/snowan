---
name: make-slides
description: 生成幻灯片模式——把主题或内容做成结构清晰、每页一个要点的 PowerPoint(.pptx),可直接下载
---

# 生成幻灯片

目标:把用户的主题/内容做成一套**结构清晰、每页一个要点**的 PowerPoint(原生 .pptx),用 `python-pptx` 生成到 workspace,再作为可下载成果展示。

## 流程

1. **定大纲**。把内容拆成 8–16 页:封面 → 概览/目录 →(主体每页一个要点)→ 结论/下一步。先把提纲(每页标题 + 1–3 个要点)给用户看一眼;主题清楚的可直接做。素材不够就先 `web_search`/`web_fetch` 或读用户给的附件/笔记。
2. **生成 .pptx**。用 `write_file` 写一个 `make_deck.py`,用 `python-pptx` 按提纲建每页(标题 + 要点);封面用大标题页。然后用 `execute_shell_command` 跑 `python make_deck.py`,文件存成 workspace 里的 `<主题>.pptx`。
3. **检查**。脚本报错就读报错、改脚本、重跑,直到生成成功(确认文件存在)。
4. **展示**。用 `present_artifact(path, title)` 把 `.pptx` 作为可下载成果展示给用户,并在回复里用文字概述每页讲了什么。

## python-pptx 写法要点
- `from pptx import Presentation` ; `from pptx.util import Inches, Pt`
- 封面用 `prs.slide_layouts[0]`(标题+副标题);内容页用 `slide_layouts[1]`(标题+正文)。
- 要点写进正文占位符的 `text_frame`:第一个要点用 `tf.text = ...`,其余 `tf.add_paragraph().text = ...`。
- 字号:标题约 32–40pt,要点约 18–24pt;一页不超过约 6 个要点。
- 保存:`prs.save("<主题>.pptx")`(相对路径即 workspace 内)。

## 质量底线
- 每页一个清晰要点,别把整段文字塞进一页。
- 结构完整:有封面、有主线、有结论。
- 生成后**一定** `present_artifact` 让用户能下载——别只描述不给文件。
- 脚本报错就改了重跑,别把报错丢给用户。
