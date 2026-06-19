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

## ✅ Phase 1 — Chat solidification

- **Session management**: rename (inline) + delete (hover ⋯ menu) + status cycle
  from the list; the on-disk history is deleted too.
- **Stop generation**: send button becomes a stop button mid-stream (AbortController).
- **Attachments**: composer paperclip picks files (chips, 8MB cap); images go to the
  model as vision (`BinaryContent`), text files are inlined.
- _Dropped: the 探索/执行 mode distinction — it was a placeholder, not a real
  read-only/execute switch; the composer is now plain chat (all tools available,
  mutating/shell still gated by approval)._

## ✅ Settings made real

Replaced the placeholder panels with working, agent-backed settings (grounded in
QwenPaw + Craft's control surface): **工具** (real tool list w/ 只读/可写),
**权限** (global approval mode auto/ask/strict — the correct form of the dropped
探索/执行), **运行** (max-iterations, timezone, auto-title, extra system prompt),
**个人档案** (name/location/notes injected into instructions), **关于** (version /
model / backend / data dir). Prefs persist in `~/.snowan`. Removed empty
Workspace + Preferences panels. _Deferred to later phases: per-tool enable/disable,
fine-grained permission rules, shortcuts editor._

## 🟡 Phase 2 — Knowledge base  (M — the KM half, highest product value)

Foundation laid (researched against REMIO + the AI-PKM field + OSS Khoj/Reor/Onyx
+ 2026 retrieval practice): **everything local except the final LLM answer**;
portable Markdown vault as source of truth; a derived SQLite index; hybrid
(keyword + on-device-embedding) retrieval. Build sub-features in order:

- **2a Notes** — _backend ✅_: portable Markdown **vault** — one `.md` + YAML
  frontmatter per note under `~/.snowan/knowledge/notes/` (Obsidian/git-able),
  source of truth; CRUD at `/api/knowledge/notes`; one-time migration from the old
  notes.json; title-change renames the file. `backend/src/snowan/knowledge.py`.
  _Frontend 笔记 tab wiring pending the shell refactor._
- **2b `knowledge_search` (hybrid) + `/api/knowledge/search`** — _backend ✅_:
  derived SQLite index (`documents` + `chunks`, markdown chunking, sha256
  hash-incremental) with **on-device embeddings** (fastembed `bge-small-zh-v1.5`,
  512d — the active cloud endpoint serves no embeddings, and local is more private
  anyway). Retrieval = CJK-n-gram keyword recall + semantic cosine fused by RRF,
  deduped per note; read-only agent tool, auto-lists in Settings 工具. Brute-force
  at single-user scale; FTS5/sqlite-vec are the drop-in scale-up path. `documents`
  is source-typed so files/web/chat reuse the same index.
  `embeddings.py` · `knowledge_index.py` · `knowledge_search.py`.
- **2c Local folders / file import**: ingest a chosen folder's files (reuse the
  attachment doc-parsers) as `source_type='file'` documents into the SAME index —
  embeddings + chunking + hybrid search already done in 2b. _QwenPaw
  `knowledge_index.py`._
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

## 🟡 Agent capabilities — current focus

Grounded in a survey of QwenPaw + Claude Code / current practice (web search &
fetch, pydantic-ai MCP, the SKILL.md pattern). Build in this order; each ships
then a desktop build for testing. **Plugins deferred** — MCP + skills cover
single-user extensibility (don't add QwenPaw's PluginRegistry framework yet).

- **C1 Web tools** — _done ✅_. `web_search` + `web_fetch` (Claude Code's split). Search:
  Tavily (BYO key, 1k free/mo, agent-tuned) default, keyless DuckDuckGo (`ddgs`)
  fallback, Brave optional. Fetch: local `trafilatura`, `r.jina.ai` for JS pages
  (no headless browser). ≤5 results / ~100KB cap / 15-min URL cache / same-host
  redirects / SSRF guard. pydantic-ai `@agent.tool` returning compact typed
  objects; provider + key in Settings. _≈ QwenPaw web tools, leaner._
- **C2 MCP** — _done ✅_. store `~/.snowan/mcp.json` in the Claude Code `{"mcpServers":{…}}`
  shape; `load_mcp_servers()` → `Agent(toolsets=[…])`, per-run `async with agent:`.
  Paste-JSON / form add, per-server enable, live probe (connected · N tools).
  stdio confirm-before-spawn, only explicit env, MCP tools gated by approval_mode,
  static Bearer only (OAuth deferred). _QwenPaw `app/mcp/`; pydantic-ai `load_mcp_servers`._
- **C3 Skills** — _done ✅_. `SKILL.md` (YAML frontmatter name+description) + `skills.json`
  manifest in `~/.snowan/skills/`; 3-level progressive disclosure via
  `pydantic-ai-skills` (or a ~150-line clone); enabled meta injected via
  `@agent.instructions`; `load_skill` / `read_skill_resource` tools; starter set;
  `create_skill` authoring. Keep the SKILL.md format portable; DROP QwenPaw's
  hub / pool / channel machinery (~6000 → ~200 lines). _QwenPaw `agents/skill_system/`._
- **C4 Tool control + audit** — _done ✅_. Per-tool enable/disable (disabled_tools
  pref filters the agent + 工具 toggles); every tool call (native + MCP) appended to
  `~/.snowan/audit.jsonl`, shown as a recent-calls list in 权限. _Deferred: ToolGuard
  pattern rules (rm -rf / DROP TABLE / shell-evasion)._ _QwenPaw `security/tool_guard`._

Adjacent high-value (from the gap analysis; after the capability track):
`update_todos` — long-task plan rendered in the 详情 panel (S, best value/effort);
per-session scratch dir `~/.snowan/scratch/` as the shell/file tools' cwd (unlocks
code/file/image gen + skill scripts, M); `delegate(task)` read-only subagent for
context isolation (M). **Out of scope:** scheduled / proactive / cron tasks.

## ⬜ Phase — polish

- Make the right "详情" panel useful (sources/context, todos, audit for the
  active chat); persist 偏好/workspace settings.

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
