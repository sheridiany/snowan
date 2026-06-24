# Snowan 剪藏 (Browser Extension)

A Manifest V3 Chromium extension (Chrome / Edge / Brave / Arc) that clips web articles,
AI chat transcripts (ChatGPT / Claude / Gemini / 豆包), and selected text into your local
**Snowan** desktop app, which stores them in your knowledge base and auto-classifies them.

Data is sent **only** to your local Snowan backend (`http://127.0.0.1:8787` by default).
Nothing is uploaded to any third-party server.

## Architecture

- **Pure MV3 + vanilla JS** — no bundler, no framework. Load the folder as-is.
- `manifest.json` — permissions, host permissions, action/popup, background worker, options.
- `src/background.js` — service worker. Context menus, popup messaging, on-demand injection
  of the right extractor via `chrome.scripting.executeScript`, POST to the backend.
- `src/lib/api.js` — backend client (`SnowanApi`), loaded into the worker via `importScripts`.
- `src/lib/extract.js` — self-contained article + selection extractors injected into pages.
- `src/content/aichat/*.js` — one self-contained scraper per AI site (chatgpt/claude/gemini/doubao).
- `src/popup.{html,js,css}` — toolbar popup UI.
- `src/options.{html,js}` — backend address, test-connection, capture-HTML toggle.
- `icons/` — `icon-16/48/128.png` plus `icon.svg` source.

## Permissions

We deliberately do **not** request `<all_urls>`. Web/selection capture uses `activeTab` +
`scripting` (only when you click), and AI-chat capture uses on-demand injection with
`host_permissions` limited to the four AI sites plus the local backend.

## Load locally (unpacked)

1. Make sure the **Snowan desktop app** is running (backend listening on `127.0.0.1:8787`).
2. Open `chrome://extensions` (or `edge://extensions`, `brave://extensions`, `arc://extensions`).
3. Toggle **Developer mode** on (top-right).
4. Click **Load unpacked** and select this `extension/` folder.
5. Pin the **Snowan 剪藏** icon to the toolbar.

## Usage

- Click the toolbar icon → **剪藏本页**. On an AI chat page it auto-detects and clips the
  conversation; on a normal page it extracts the article body. **剪藏选中内容** clips the
  current text selection.
- Or right-click → **用 Snowan 剪藏本页** / **用 Snowan 剪藏选中内容**.
- After a successful clip you'll see the AI-assigned **category** and **tags**.
- The footer shows the live connection status to Snowan. Change the backend address in
  **设置** (options) if you run Snowan on a non-default port.

## Icons

`icons/icon-{16,48,128}.png` are committed. To regenerate from a single source, edit
`icons/icon.svg` and convert (any of these works if installed):

```sh
# rsvg-convert
for s in 16 48 128; do rsvg-convert -w $s -h $s icons/icon.svg -o icons/icon-$s.png; done
# or ImageMagick
for s in 16 48 128; do magick -background none icons/icon.svg -resize ${s}x${s} icons/icon-$s.png; done
```

The committed PNGs were generated programmatically (orange disc + white snowflake) to match
`icon.svg` without requiring an SVG rasterizer.

## Package for the store

```sh
bash scripts/pack.sh
# -> dist/snowan-extension.zip
```

The zip excludes `scripts/`, `dist/`, `*.md`, and the `.svg` source — it contains only what
the browser needs to run.

## Cross-browser

Single Chromium MV3 package; works on Chrome, Edge, Brave, and Arc. Firefox is not targeted.
