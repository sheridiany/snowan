from ... import memory


def remember(content: str, type: str = "fact", importance: int = 3) -> str:
    """记录一条关于用户或其工作的长期记忆(偏好、决定、身份、项目事实、待办)。

    当用户说「记一下/帮我记住/以后别忘了」或主动陈述一条值得长期保留的事实时调用本工具。
    type 必须是 fact/preference/decision/project/todo/person 之一;importance 取 1-5(默认 3)。
    每条记忆会同时写入当天的日志,便于后续整理。一次只记一条原子事实,不要把多件事塞进一条。"""
    if type not in memory.TYPES:
        return f"type 必须是 {'/'.join(memory.TYPES)} 之一,收到的是「{type}」。"
    m = memory.create_entry(content, type=type, importance=importance)
    memory.append_daily(f"记忆: {content}")
    return f"已记住[{m['type']}]:{m['content']}"


def recall_memory(query: str) -> str:
    """查询用户的长期记忆(偏好、过往决定、身份、项目事实)。

    当用户问到「我之前定下/说过/喜欢什么」「关于 X 我们决定了什么」这类涉及个人记忆的问题时调用,
    不要直接回答「我不记得」。本工具按相关度召回并会强化命中的记忆;查不到再如实说没有。"""
    hits = memory.recall(query, 5, reinforce=True)
    if not hits:
        return "长期记忆里没有找到相关内容。"
    blocks = [f"在长期记忆中找到 {len(hits)} 条相关记忆:"]
    for i, m in enumerate(hits, 1):
        blocks.append(f"\n[{i}] [{m['type']}] {m['content']}")
    return "\n".join(blocks)
