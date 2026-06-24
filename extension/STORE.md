# Snowan 剪藏 — Store Listing Material

Material for the Chrome Web Store (and Edge Add-ons). All copy is provided in Chinese and English.

---

## Store description (中文)

**Snowan 剪藏 — 把网页、AI 对话、划词内容一键存进你本地的知识库**

Snowan 剪藏让你在浏览时一键收藏值得保留的内容,直接存入运行在你自己电脑上的 Snowan 桌面端,
由本地 AI 自动分类、打标签,与你的笔记一起可被搜索。

支持三种抓取:
- 网页正文:智能抽取文章主体,去掉导航、广告、评论。
- AI 对话:在 ChatGPT、Claude、Gemini、豆包 的对话页一键保存整段问答。
- 划词收藏:选中任意文字,右键即可剪藏。

隐私优先:所有内容只发送到你本机的 Snowan(默认 127.0.0.1:8787),不上传任何第三方服务器,
不收集任何个人信息。需要先安装并运行 Snowan 桌面端。

## Store description (English)

**Snowan Clipper — save web pages, AI chats, and selected text into your local knowledge base**

Snowan Clipper lets you capture anything worth keeping while you browse, straight into the
Snowan desktop app running on your own machine, where a local AI auto-classifies and tags it
alongside your notes — all searchable.

Three capture modes:
- Web article: smart main-content extraction, stripping nav, ads, and comments.
- AI chat: one click saves a full conversation on ChatGPT, Claude, Gemini, or Doubao.
- Selection: highlight any text and clip it from the right-click menu.

Privacy first: everything is sent only to your local Snowan (default 127.0.0.1:8787). Nothing
is uploaded to any third-party server, and no personal data is collected. Requires the Snowan
desktop app to be installed and running.

---

## Permission justifications

Reviewers: this extension intentionally does **not** request `<all_urls>`.

| Permission | Why it is needed |
| --- | --- |
| `activeTab` | Grants temporary access to the current tab **only when the user clicks** the toolbar button or a context-menu item, so the extractor can read that page's content. No standing access to browsing. |
| `scripting` | Used with `chrome.scripting.executeScript` to inject the self-contained article/selection/AI-chat extractor into the active tab **on demand** at the moment of capture. No persistent content scripts. |
| `contextMenus` | Adds "用 Snowan 剪藏本页" and "用 Snowan 剪藏选中内容" right-click entries. |
| `storage` | Persists user settings (local backend address, capture-HTML toggle) via `chrome.storage.sync`. |
| `notifications` | Shows a success notification with the AI-assigned category after a clip, or an error if the local app is not running. |

### Host permissions

| Host | Why |
| --- | --- |
| `http://127.0.0.1:8787/*`, `http://localhost:8787/*` | The local Snowan desktop backend the extension POSTs captures to. This is the **only** network destination. Port is user-configurable. |
| `https://chatgpt.com/*`, `https://chat.openai.com/*` | To inject the on-demand ChatGPT transcript extractor when the user clips an AI chat. |
| `https://claude.ai/*` | On-demand Claude transcript extractor. |
| `https://gemini.google.com/*` | On-demand Gemini transcript extractor. |
| `https://www.doubao.com/*`, `https://doubao.com/*` | On-demand 豆包 transcript extractor. |

For all other sites, capture relies solely on `activeTab` (user-initiated), with no host
permission and no persistent access.

---

## Privacy policy

**Snowan 剪藏 Privacy Policy**

Snowan 剪藏 does not collect, transmit, or sell any personal information.

- **What it does:** When you explicitly click to clip, the extension reads the content of the
  current page (article text, an AI chat transcript, or your text selection) and sends it to
  the Snowan desktop application running locally on **your own computer** (default
  `http://127.0.0.1:8787`, configurable to another local port).
- **Where data goes:** Captured content is sent **only** to that local address on your machine.
  It is **never** sent to the extension's authors or to any third-party server. The extension
  makes no other network requests.
- **What is stored by the extension:** Only your settings (the local backend address and the
  capture-HTML toggle), stored via the browser's `chrome.storage.sync`. No browsing history,
  no analytics, no tracking, no cookies.
- **Permissions:** Page access is requested per-click via `activeTab`/`scripting` (and the four
  AI-chat host permissions), not as standing access to your browsing.

Because all data stays on your machine inside Snowan, deletion is fully under your control via
the Snowan desktop app.

Contact: (fill in maintainer email before publishing).

---

## Store assets checklist

- [ ] **Icon** 128×128 PNG — `icons/icon-128.png` (already in package).
- [ ] **Small promo tile** 440×280 PNG (optional but recommended).
- [ ] **Marquee promo** 1400×560 PNG (optional).
- [ ] **Screenshots** 1280×800 or 640×400 PNG/JPEG, 1–5 images:
  1. Popup on a normal article showing the returned category + tags.
  2. Popup on an AI chat page ("识别为 ChatGPT 对话页").
  3. Right-click context menu with the two Snowan entries.
  4. Options page (backend address + 测试连接 success state).
  5. The captured item showing up inside the Snowan desktop app (context shot).
- [ ] **Category:** Productivity.
- [ ] **Language:** Chinese (Simplified) primary; English supported.
- [ ] **Privacy policy URL** — host the policy above and link it in the listing.
- [ ] **Single purpose statement:** "Clip web content and AI conversations into the user's
  local Snowan knowledge base."
