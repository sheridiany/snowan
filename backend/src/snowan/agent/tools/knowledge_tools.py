from ...knowledge import search_notes


def knowledge_search(query: str, max_results: int = 5) -> str:
    """检索用户的个人知识库(已保存的笔记),混合关键词 + 语义检索。

    当用户问到「我之前记过/存过什么」「我的笔记里有没有 X」「关于 X 我记了什么」这类
    问题时,先调用本工具检索,不要直接回答「我无法访问你的笔记」。确实查不到再如实说没找到。
    每条结果含标题、所在小节和片段;片段里已经有答案就直接据此回答,不要再去 read_file / grep_search。
    回答时注明引用了哪几篇笔记。需要补充 / 整理某篇笔记时,用结果里的 note_id 配合
    read_note / append_note / rewrite_note,而不是新开一篇重复笔记。"""
    results = search_notes(query, max_results)
    if not results:
        return "知识库里没有找到相关内容。"
    blocks = [f"在知识库中找到 {len(results)} 条相关笔记:"]
    for i, r in enumerate(results, 1):
        loc = f"《{r['title']}》" + (f" › {r['heading']}" if r["heading"] != r["title"] else "")
        blocks.append(f"\n[{i}] {loc}(note_id: {r['document_id']})\n{r['snippet']}")
    return "\n".join(blocks)
