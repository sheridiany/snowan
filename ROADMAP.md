# Snowan — Build Roadmap

Each iteration ends GREEN (backend runs, `npm run build` passes, runtime smoke ok) then commits.
Status: ✅ done · 🛠 in progress · ⬜ todo

## ✅ Phase 0 — Skeleton + minimal loop  ·  `6a3ce17`
PydanticAI agent + 1 tool + streaming SSE; React19/antd6/lobe-ui builds & renders.

## ✅ Phase 1 — Multi-turn + read-only tools  ·  `6e4d8d6`
Session history; read_file / grep_search / glob_search (workspace-scoped).

## ✅ Phase 2 — Chat UI + tool visibility  ·  `45fa003`
agent.iter streaming → typed SSE (delta/tool_call/tool_result/done). lobe-ui chat:
inline tool-call cards, warm theme, working dark mode.

## ✅ App shell (Craft-style)  ·  `9465138`
Nav rail (会话/数据源/技能/设置) + master-detail settings (外观/AI/Workspace/权限/
快捷键/偏好); permissions panel mirrors Craft; sources/skills views.

## ✅ Desktop + detail  ·  `a5ca44c`
Tauri v2 wrapper (macOS Overlay titlebar, `cargo check` passes); draggable TitleBar;
settings polished to Craft detail via a shared Section/Row kit.

## ✅ Phase 3 — Mutating tools + interactive approval  ·  `0ef575a`
write/edit/append/shell tools gated by requires_approval; approval_required SSE +
/api/chat/approve resume (DeferredToolRequests); inline ApprovalCard (允许/拒绝).
Verified end-to-end: approve writes the file, deny is refused.

## ⬜ Phase 4 — Knowledge layer
notes store (JSON) + CRUD routes + notes UI (lobe-ui Markdown/Mermaid);
knowledge_search tool (keyword → embeddings); later: web capture / calendar / folders.

## ⬜ Phase 5 — Memory + persistence
disk session persistence (ModelMessagesTypeAdapter); context compaction
(ProcessHistory); ReMe long-term memory.

## ⬜ Phase 6 — Skills + plugins
SKILL.md → dynamic FunctionToolset; plugin registry.

## ⬜ Phase 7 — MCP toolsets + Tauri native run
FastMCPToolset / MCPServerStdio/HTTP; `npm run tauri dev` native window verify.

## Open items / notes
- Set a real provider to chat for real: backend/.env → SNOWAN_PROVIDER + SNOWAN_API_KEY
  (offline default is a TestModel that just calls every tool — hence the noisy demos).
- Parallelization rule: fan out over DISJOINT new files; orchestrator integrates
  shared files (App.tsx, build.py, chat.py) + runs the green build before commit.
