import threading  # noqa: E402
from contextlib import asynccontextmanager  # noqa: E402

from dotenv import load_dotenv

load_dotenv()  # before the agent reads provider settings

from fastapi import FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

from .calendar import router as calendar_router  # noqa: E402
from .chat import router  # noqa: E402
from .imagegen import router as imagegen_router  # noqa: E402
from .knowledge import router as knowledge_router  # noqa: E402
from .mcp import router as mcp_router  # noqa: E402
from .memory import router as memory_router  # noqa: E402
from .persona import router as persona_router  # noqa: E402
from .providers import router as providers_router  # noqa: E402
from .recordings import router as recordings_router  # noqa: E402
from .skills import router as skills_router  # noqa: E402
from .system import router as system_router  # noqa: E402
from .workspace import router as workspace_router  # noqa: E402


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Reconcile the index with the note vault in the background. This stays
    # keyword-only until the user downloads the embedding model from Settings —
    # it never triggers the download itself.
    def _bootstrap() -> None:
        from .. import knowledge, memory

        knowledge.sync_index()
        memory.sync_index()

    threading.Thread(target=_bootstrap, daemon=True).start()
    yield


app = FastAPI(title="Snowan", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    # Local single-user app: the dev server and the packaged Tauri webview
    # (tauri://localhost / *.tauri.localhost) hit this on localhost.
    allow_origin_regex=(
        r"^(http://localhost(:\d+)?|http://127\.0\.0\.1(:\d+)?"
        r"|tauri://localhost|https?://[a-z.]*tauri\.localhost)$"
    ),
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router)
app.include_router(providers_router)
app.include_router(system_router)
app.include_router(knowledge_router)
app.include_router(mcp_router)
app.include_router(memory_router)
app.include_router(persona_router)
app.include_router(skills_router)
app.include_router(imagegen_router)
app.include_router(recordings_router)
app.include_router(calendar_router)
app.include_router(workspace_router)


@app.get("/health")
def health() -> dict:
    return {"ok": True}
