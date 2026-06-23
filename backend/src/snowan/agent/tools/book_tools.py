def book_search(query: str, book_id: str = "", max_results: int = 5) -> str:
    """搜索用户已上传的书。问到某本书/书里的内容、或'我读过的书里有没有讲…'时调用。book_id 留空=跨所有书,否则限定一本。"""
    from .. import books

    results = books.retrieve(book_id or None, query, k=max_results)
    if not results:
        return "书架里没有找到相关内容。"
    blocks = [f"在书中找到 {len(results)} 条相关内容:"]
    for i, r in enumerate(results, 1):
        blocks.append(f"\n[{i}] 《{r['chapter_title']}》\n{r['snippet']}")
    return "\n".join(blocks)
