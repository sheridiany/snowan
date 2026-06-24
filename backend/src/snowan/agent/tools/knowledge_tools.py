from ...knowledge import search_notes


def knowledge_search(query: str, max_results: int = 5) -> str:
    """检索用户的个人知识库(已保存的笔记),混合关键词 + 语义检索。

    当用户问到「我之前记过/存过什么」「我的笔记里有没有 X」「关于 X 我记了什么」这类
    问题时,先调用本工具检索,不要直接回答「我无法访问你的笔记」。确实查不到再如实说没找到。
    每条结果含标题、所在小节和片段;片段里已经有答案就直接据此回答,不要再去 read_file / grep_search。
    回答时注明引用了哪几篇笔记。

    只有带 note_id 的结果是「app 内可编辑笔记」,才能用 read_note / append_note / rewrite_note;
    标了「只读索引文件」的结果不能用这些工具(它们是外部 .md 文件,要改就用 read_file / edit_file
    按路径操作)。若没有可编辑笔记可补充,直接用 save_note 新建,不要反复检索同一目标。"""
    results = search_notes(query, max_results)
    if not results:
        return "知识库里没有找到相关内容。"
    blocks = [f"在知识库中找到 {len(results)} 条相关结果:"]
    for i, r in enumerate(results, 1):
        loc = f"《{r['title']}》" + (f" › {r['heading']}" if r["heading"] != r["title"] else "")
        # Only in-app notes are editable via the note tools; indexed files (file_*) are
        # read-only here, so DON'T hand their id back as a note_id — that sends the model
        # into an append_note→not-found→re-search loop.
        tag = (
            f"(note_id: {r['document_id']})"
            if r.get("source_type") == "note"
            else "(只读索引文件,不可 append_note)"
        )
        blocks.append(f"\n[{i}] {loc}{tag}\n{r['snippet']}")
    return "\n".join(blocks)
