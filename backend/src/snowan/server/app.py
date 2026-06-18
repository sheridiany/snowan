from dotenv import load_dotenv

load_dotenv()  # before the agent reads provider settings

from fastapi import FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

from .chat import router  # noqa: E402
from .providers import router as providers_router  # noqa: E402

app = FastAPI(title="Snowan")
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


@app.get("/health")
def health() -> dict:
    return {"ok": True}
