"""Surface a generated workspace file (a .pptx deck, a chart .png, an .html) to the
user as a downloadable / previewable artifact. The chat layer turns a successful
call into an `artifact` SSE event the frontend renders as a card."""
from ...workspace import resolve_in_workspace


def present_artifact(path: str, title: str = "") -> str:
    """把 workspace 里生成的文件(.pptx 演示稿 / 图表 .png / .html 等)作为可下载成果展示给用户。path 是 workspace 内的文件路径,title 是给用户看的名字。"""
    try:
        p = resolve_in_workspace(path)
    except ValueError as e:
        return f"error: {e}"
    if not p.is_file():
        return f"error: 文件不存在:{path}"
    return f"已把「{title or p.name}」作为可下载成果展示给用户。"
