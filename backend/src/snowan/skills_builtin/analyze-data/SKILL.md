---
name: analyze-data
description: 表格分析模式——用 Python(pandas)真实计算分析用户的表格/数据,给出结论先行的发现与图表
---

# 表格分析

目标:对用户的表格/数据(Excel、CSV 等)做真实的**计算分析**,给出结论先行的发现,必要时画图——用 `python` + `pandas` 跑,不靠肉眼估。

## 流程

1. **拿到数据**。用户可能:① 直接贴了表格 → 用 `write_file` 存成 workspace 里的 `data.csv`;② 上传了 Excel/CSV(文本已在对话里;需要原始文件时让用户确认 workspace 内路径或重新提供);③ 给了 workspace 里的文件路径。先确认列名和大致结构。
2. **明确问题**。搞清楚用户想知道什么(汇总?趋势?对比?异常?相关?)。不明确就按数据特征提 1–2 个最有价值的分析方向。
3. **写分析脚本**。用 `write_file` 写 `analyze.py`,用 `pandas` 读数据并计算(`describe` / `groupby` / 透视 / 排序 / 过滤等)。要图就用 `matplotlib` 画并 `savefig("chart.png")`(workspace 内);`print()` 出关键数字。
4. **跑 + 迭代**。用 `execute_shell_command` 跑 `python analyze.py`,看输出;报错或结果不对就改脚本重跑。
5. **报告**。结论先行:先给最重要的发现(带具体数字),再给支撑细节;关键数据用 Markdown 表格呈现。
6. **展示图表**。画了图就用 `present_artifact("chart.png", "...")` 让用户能看/下载。

## 质量底线
- 用真实计算,不要「看起来大概是」——数字要从 pandas 跑出来。
- 结论先行 + 具体数字,别只描述方法。
- 图表只在能讲清一个发现时才画,并务必 `present_artifact` 展示。
- 脚本报错就读错误、改了重跑,别把错误丢给用户。
