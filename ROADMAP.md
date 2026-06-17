# Snowan — Build Roadmap (autonomous iteration)

Each iteration ends GREEN: backend imports + runs, frontend `npm run build` passes,
a runtime smoke check succeeds, then a commit. No iteration is committed broken.

Status legend: ✅ done · 🛠 in progress · ⬜ todo

## ✅ Phase 0 — Skeleton + minimal loop
PydanticAI agent + 1 tool + streaming SSE; React19/antd6/lobe-ui builds & renders.

## ✅ Phase 1 — Multi-turn + read-only tools
Session-keyed history; `read_file` / `grep_search` / `glob_search` (workspace-scoped).

## 🛠 Phase 2 — Real chat UI + tool visibility
- ⬜ Frontend layout with lobe-ui: sessions sider · chat canvas · composer · warm+dark theme
- ⬜ Richer SSE: emit tool-call events (name/args/result), not just text deltas
- ⬜ Frontend: tool-call chips (the "agent is doing things" feel)

## ⬜ Phase 3 — Tool-guard approval + mutating tools + MCP
- write_file / edit_file / append_file / execute_shell_command, gated by `requires_approval`
- approval bridge: `ApprovalRequired` / `DeferredToolRequests` → resume endpoint → UI approval card
- MCP toolsets: `MCPServerStdio` / `MCPServerStreamableHTTP` / `FastMCPToolset` + config

## ⬜ Phase 4 — Knowledge layer
- notes store (JSON) + CRUD routes + notes UI (lobe-ui Markdown/Mermaid)
- `knowledge_search` tool (keyword first, embeddings/semantic next) + index
- later: web capture · calendar · local folders · external-AI-chat capture

## ⬜ Phase 5 — Memory + persistence
- session persistence to disk via `ModelMessagesTypeAdapter`
- context compaction via `ProcessHistory`
- ReMe long-term memory (auto-memory + retrieval)

## ⬜ Phase 6 — Skills + plugins
- SKILL.md parsing → dynamic `FunctionToolset`; plugin registry

## ⬜ Phase 7 — Desktop packaging (Tauri)

## Parallelization rule
Within a phase, fan out agents only over DISJOINT new files. Shared integration
points (`agent/build.py`, `server/app.py`, `App.tsx`) are edited by the orchestrator
after, then verified. Keep the build green at every commit.
