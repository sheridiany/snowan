# Snowan

Local-first personal AI assistant + knowledge workbench.

See [PLAN.md](./PLAN.md) for scope, stack, and phases.

## Dev

```bash
# backend  (http://localhost:8787)
cd backend
uv sync
uv run uvicorn snowan.server.app:app --reload --port 8787
# runs offline with a TestModel; set SNOWAN_PROVIDER / SNOWAN_API_KEY for a real model

# frontend (http://localhost:5173)
cd frontend
npm install
npm run dev
```
