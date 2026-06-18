# Snowan Roadmap

Local-first AI assistant **+** knowledge workbench. Single user, single agent,
local only. Clean-room rewrite of the QwenPaw prototype onto PydanticAI +
FastAPI (backend) and React 19 / antd 6 / lobe-ui / Tauri (frontend).

Grounded in a full survey of QwenPaw's real feature set (`src/qwenpaw`,
`console/src`) mapped against Snowan's scope decisions. Each phase cites the
QwenPaw modules it mirrors so we build from the real design, not guesses. Phases
are ordered by dependency, then product value. Every phase ends GREEN (backend
runs, `npm run build` passes, smoke ok) then commits.

---

## Scope — what Snowan deliberately does NOT build

Dropped from QwenPaw on purpose (don't let these creep back in):

- **The entire proactive layer**: heartbeat, daily-ritual auto-notes, cron jobs,
  inbox, messaging channels (Telegram/WhatsApp/Slack/email), proactive memory.
- **Local LLM** + model routing. Cloud OpenAI-compatible providers only.
- **Multi-workspace / multi-agent**. One workspace (`~/.snowan`), one agent.
- **Auth, tunnel, voice/transcription, workspace backups, token analytics**,
  AnalyticDB (ADBPG) memory backend, skill pool / external hub, OAuth MCP (later).

---

## ✅ Done (foundation)

- **Shell/UI**: 3-pane floating layout (icon rail · list · content), sections
  会话/知识库/技能/设置, 6 named themes light+dark, warm flat aesthetic.
- **Desktop**: Tauri v2, app icon, overlay titlebar, packaged app reaches the
  backend (absolute API base + CORS).
- **Agent core**: PydanticAI agent; tools = read/write/edit/append file,
  grep/glob, shell, time; approval gating (`DeferredToolRequests` +
  `/api/chat/approve`); SSE (delta/tool_call/tool_result/approval_required/done).
  _≈ QwenPaw `agents/react_agent.py`, `app/approvals`, `app/channels/console`._
- **AI engine**: providers (Anthropic/OpenAI/Google/custom OpenAI-compatible),
  per-provider model lists, `/v1/models` discovery, connection/model test,
  vision auto-detect (heuristic + red-image probe), model aliases, composer model
  picker (configured-only). Store `~/.snowan/config.json`. _≈ QwenPaw `providers/`._
- **Session persistence**: agent history on disk (`~/.snowan/sessions/<id>.json`,
  `ModelMessagesTypeAdapter`) + UI list/transcripts in localStorage.
  _≈ QwenPaw `app/runner/repo/json_repo`._

---

## ⬜ Phase 1 — Chat solidification  (S–M)

Connect pieces that already half-exist; make the chat feel complete.

- **探索/执行 mode → tool guard**: `探索` = read-only tools, no approval;
  `执行` = mutating/shell enabled, approval required. _QwenPaw approval levels in
  `AgentsRunningConfig`, `security/tool_guard`._
- **Session management**: rename / delete / set status+tags from the list;
  stop-generation. _QwenPaw `/chats` CRUD, `pages/Control/Sessions`._
- **Attachments**: paperclip → upload a file into the turn. _QwenPaw
  `/console/upload`._

## ⬜ Phase 2 — Knowledge base  (M — the KM half, highest product value)

Wire the empty 知识库 tabs to a real backend and give the agent a
`knowledge_search` tool. Build sub-features in order:

- **2a Notes**: CRUD + store `~/.snowan/knowledge/notes.json`. _QwenPaw
  `app/knowledge_notes.py`._
- **2b `knowledge_search` tool + `/api/knowledge/search`**: keyword + recency +
  intent (list-vs-keyword) over notes; composer 数据源 chip scopes it. _QwenPaw
  `knowledge_service.py`, `knowledge_query.py`._ Embeddings = optional later boost.
- **2c Local folders + embeddings**: register folders, markdown-aware chunking,
  SQLite chunk+embedding store, hybrid search; embedding model derived from the
  active endpoint. _QwenPaw `knowledge_index.py`, `knowledge_embeddings.py`._
- **2d Web / AI-chat capture**: 网页 + AI 对话 tabs — fetch URL → extract text +
  metadata (httpx + readability), dedupe; import AI-chat transcripts. _QwenPaw
  `browser_capture.py` (store only, no headless browser)._
- **2e Calendar**: ICS import + macOS Calendar sync (AppleScript). _QwenPaw
  `calendar_sources.py`._
- **2f Mermaid**: render mermaid blocks in chat + notes.

## ⬜ Phase 3 — Long-term memory  (M — personalization)

- `MEMORY.md` + `PROFILE.md` in `~/.snowan/memory/`; a `memory_search` tool;
  auto-retrieve relevant memory each turn (threshold-gated); summarize on
  compaction; a manual "consolidate" action (not the dropped nightly cron).
  _QwenPaw `agents/memory/reme_light_memory_manager.py`._ Wrap `reme-ai` or a
  lean home-grown markdown+embedding store.

## ⬜ Phase 4 — Skills  (M)

- `SKILL.md` (md + YAML frontmatter) store in `~/.snowan/skills/`; CRUD,
  enable/disable, tags; enabled skills inject into the agent instructions; ship a
  small built-in set. (No pool / hub.) _QwenPaw `agents/skill_system/`,
  `routers/skills.py`._

## ⬜ Phase 5 — MCP  (M)

- Add/configure MCP servers (stdio + streamable-http); paste-JSON import; live
  tool discovery; agent loads them as PydanticAI toolsets (`MCPServerStdio` /
  `FastMCPToolset`). OAuth deferred. _QwenPaw `app/mcp/`, `routers/mcp.py`._

## ⬜ Phase 6 — Permissions & polish  (S–M)

- Configurable, persisted tool-guard rules (which tools need approval; sensitive
  path guard) wiring the 权限 page; persist 偏好/workspace settings. _QwenPaw
  `security/tool_guard`._
- Make the right "详情" panel useful (sources/context for the active chat).

## ⬜ Phase 7 — Engineering / real desktop  (M–L)

- **Backend as a Tauri sidecar** — auto-launch on app start, no manual `uvicorn`.
- **Compaction** for long chats (`ProcessHistory`).
- **Plugins** (hot-loaded extensions) — lowest priority for single-user. _QwenPaw
  `plugins/`._

---

## Suggested path

`Phase 1` (quick, chat feels done) → `Phase 2` (the knowledge half — the
product's reason to exist) → `Phase 3` (memory) → `4/5` (skills, MCP) →
`6/7` (control + real desktop). Phase 2 is the highest-value chunk; jump
straight to it after Phase 1 if preferred.
