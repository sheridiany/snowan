from ... import skills as store


def load_skill(name: str) -> str:
    """读取某个技能的完整说明(操作流程)。可用技能会以「名称: 说明」列在你的指令里;当某个
    技能和当前任务相关时,先调用本工具拿到它的完整步骤,再按步骤执行。"""
    s = store.get_skill(name)
    return s["body"] if s else f"没有名为「{name}」的技能。"


def read_skill_resource(skill: str, path: str) -> str:
    """读取某个技能附带的引用文件(path 为相对该技能目录的路径)。技能正文里若提到某个文件,用本工具读它。"""
    r = store.read_resource(skill, path)
    return r if r is not None else "未找到该文件。"


def create_skill(name: str, description: str, body: str) -> str:
    """把一套可复用的做法保存成新技能。name 用简短英文标识(如 weekly-report);description 一句话
    说明「什么时候该用它」;body 是 Markdown 写的操作步骤。存好后以后遇到类似任务就能复用。"""
    store.create_skill(name, description, body)
    return f"已创建技能「{name}」。"
