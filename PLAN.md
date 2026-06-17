# Snowan — Build Plan

Local-first personal AI assistant + knowledge workbench. Clean-room rewrite of the
QwenPaw prototype: the agent core and product are ours, built on widely-adopted,
permissively-licensed infrastructure only.

## Stack (decided)

- **Backend**: Python 3.13 · FastAPI · **PydanticAI** (agent core) · uv
  - No AgentScope, no vendored framework. PydanticAI is replaceable scaffolding;
    the assembly, tools, and domain logic are ours.
  - Cloud providers only: OpenAI / Anthropic / Gemini / OpenRouter. **No local LLM.**
- **Frontend**: Vite · **React 19** · **antd 6** · **@lobehub/ui** (lobe-ui) · Tauri
  - lobe-ui is built on antd + antd-style — continuous with the prototype, not a re-platform.
  - Warm `--snowan-*` theme carried over via antd-style theme tokens.

## In scope (carried over)

- Core: multi-provider, ReAct loop (native to PydanticAI), streaming, structured output,
  MCP client, tool-guard approval, context compaction, session persistence.
- Tools: shell · python · file io · grep/glob · browser_use · desktop_screenshot ·
  view_image/video · send_file · time/timezone · knowledge_search.
- Knowledge: notes CRUD + draft gen · semantic search · web capture · external-AI-chat
  capture · calendar · local folders · Mermaid.
- Memory: ReMe long-term memory.
- Extensibility: skills system · plugins system.

## Out of scope (dropped from prototype)

local/cloud routing · local LLM · token-usage tool & analytics · agent stats ·
materialize_skill · daily ritual (morning plan / scratch / evening review) ·
heartbeat · inbox cards · notification channels · proactive memory · cron ·
voice transcription · backups · multi-workspace · multi-agent · remote tunnel · auth.

→ The entire proactive/scheduled layer is gone. Single user, single agent, local only.

## Mapping to PydanticAI (verified APIs)

- Agent loop → `Agent.run` / `agent.iter` (native — we don't write the loop)
- Providers → `OpenAIChatModel` / `AnthropicModel` / `GoogleModel` + `OpenAIProvider(base_url=)`
- Tools → `@agent.tool` / `FunctionToolset`
- Approval (tool-guard) → `requires_approval` / `ApprovalRequired` / `DeferredToolRequests` / `HandleDeferredToolCalls`
- Context compaction → `ProcessHistory(callback)` capability
- Session persistence → `ModelMessagesTypeAdapter` JSON
- MCP → `MCPServerStdio` / `MCPServerStreamableHTTP` / `FastMCPToolset`
- Structured output → `output_type=PydanticModel`
- Streaming → `run_stream` / `agent.iter`

## Phases

- **0 — Skeleton + minimal loop** *(this)*: project scaffold; PydanticAI agent + 1 tool +
  streaming SSE; lobe-ui chat view on React 19 / antd 6; runs end to end.
- **1 — Provider factory + tools**: 4 cloud providers from config; port the tool set.
- **2 — Seams**: approval bridge · MCP toolsets · compaction processor · knowledge_search.
- **3 — Memory + persistence**: ReMe wiring · ModelMessage session store · skills/plugins.
