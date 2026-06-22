"""Headless-browser fetch: render a JS-heavy page with Playwright and return clean
Markdown, optionally with a full-page screenshot saved to the workspace (surface it
with present_artifact). Read-only — no clicking or form-filling; interactive
computer-use is a deliberately separate, heavier capability. Reuses the web_fetch
SSRF guard, so only public hosts are reachable (re-checked after redirects)."""
import re
import time

from ...workspace import workspace_root
from .web_tools import _MAX_CHARS, _UA, _is_public


async def browse(url: str, screenshot: bool = False) -> str:
    """用无头浏览器渲染网页(适合 web_fetch 抓不到的 JS 重页面 / 单页应用),返回正文 Markdown。screenshot=True 时把整页截图存进 workspace 并提示用 present_artifact 展示给用户。只读——不点击、不填表。"""
    if not re.match(r"^https?://", url):
        url = "https://" + url
    if not _is_public(url):
        return "拒绝浏览:目标不是公网地址。"
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        return "浏览器引擎未安装。请在后端运行:uv run playwright install chromium"

    html = ""
    shot_name: str | None = None
    try:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=True)
            try:
                page = await browser.new_page(user_agent=_UA)
                await page.goto(url, wait_until="networkidle", timeout=30_000)
                if not _is_public(page.url):  # a redirect may have left the public web
                    return "拒绝浏览:页面跳转到了非公网地址。"
                html = await page.content()
                if screenshot:
                    (workspace_root() / "screenshots").mkdir(parents=True, exist_ok=True)
                    shot_name = f"screenshots/browse-{int(time.time())}.png"
                    await page.screenshot(path=str(workspace_root() / shot_name), full_page=True)
            finally:
                await browser.close()
    except Exception as e:  # noqa: BLE001 — surface to the model, don't crash the turn
        return f"浏览失败:{type(e).__name__}: {e}"

    import trafilatura

    text = trafilatura.extract(html, output_format="markdown", include_links=False) or ""
    if not text.strip():
        text = "(页面已渲染,但没有提取到可读正文)"
    if len(text) > _MAX_CHARS:
        text = text[:_MAX_CHARS].rstrip() + "\n\n…(内容已截断)"
    if shot_name:
        text += f"\n\n[整页截图已存到 workspace:{shot_name} —— 用 present_artifact 展示给用户]"
    return text
