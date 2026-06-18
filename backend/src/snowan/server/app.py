import threading  # noqa: E402
from contextlib import asynccontextmanager  # noqa: E402

from dotenv import load_dotenv

load_dotenv()  # before the agent reads provider settings

from fastapi import FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

from .chat import router  # noqa: E402
from .knowledge import router as knowledge_router  # noqa: E402
from .providers import router as providers_router  # noqa: E402
from .system import router as system_router  # noqa: E402


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Warm the local embedding model and reconcile the index with the note vault
    # in the background, so startup is not blocked by the model load/download.
    def _bootstrap() -> None:
        from .. import embeddings, knowledge

        embeddings.warm()
        knowledge.sync_index()

    threading.Thread(target=_bootstrap, daemon=True).start()
    yield


app = FastAPI(title="Snowan", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    # Local single-user app: the dev server, the packaged Tauri webview
    # (tauri://localhost / *.tauri.localhost), all hit this on localhost.
    allow_origin_regex=r"^(http://localhost:5173|tauri://localhost|https?://[a-z.]*tauri\.localhost)$",
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router)
app.include_router(providers_router)
app.include_router(system_router)
app.include_router(knowledge_router)


@app.get("/health")
def health() -> dict:
    return {"ok": True}
