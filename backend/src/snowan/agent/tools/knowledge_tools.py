from ...knowledge import search_notes


def knowledge_search(query: str, max_results: int = 5) -> str:
    """检索用户的个人知识库(已保存的笔记)。

    当用户问到「我之前记过/存过什么」「我的笔记里有没有 X」「关于 X 我记了什么」这类
    问题时,先调用本工具检索,不要直接回答「我无法访问你的笔记」。确实查不到再如实说没找到。
    每条结果含标题和片段;片段里已经有答案就直接据此回答,不要再去 read_file / grep_search。
    回答时注明引用了哪几篇笔记。"""
    results = search_notes(query, max_results)
    if not results:
        return "知识库里没有找到相关内容。"
    blocks = [f"在知识库中找到 {len(results)} 条相关笔记:"]
    for i, r in enumerate(results, 1):
        blocks.append(f"\n[{i}] 《{r['title']}》\n{r['snippet']}")
    return "\n".join(blocks)
