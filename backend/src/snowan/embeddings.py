"""Local CPU embeddings via fastembed. Note content is embedded ON-DEVICE — it
never leaves the machine to be indexed; only the final answer prompt goes to the
cloud LLM ("everything local except AI Q&A").

The model (~95MB) is a deliberate, user-controlled download from Settings — never
fetched implicitly. Callers gate embedding on `is_ready()`; the only place that
triggers a download is the explicit `download()`. MODEL_ID is exported so the index
can re-embed itself after the model lands (or when the model changes)."""
import threading
from functools import lru_cache

import numpy as np

from .config import SNOWAN_HOME

MODEL_ID = "BAAI/bge-small-zh-v1.5"  # 512-dim, strong on Chinese
DIM = 512
SIZE_MB = 95
CACHE_DIR = SNOWAN_HOME / "models"  # the model lives in the app data dir, user-visible

_downloading = False
_lock = threading.Lock()


@lru_cache(maxsize=1)
def _model():
    from fastembed import TextEmbedding

    return TextEmbedding(model_name=MODEL_ID, cache_dir=str(CACHE_DIR))


def is_ready() -> bool:
    """Whether the model is present locally — checked WITHOUT any network call."""
    return CACHE_DIR.exists() and any(CACHE_DIR.rglob("*.onnx"))


def is_downloading() -> bool:
    return _downloading


def download() -> None:
    """Explicitly fetch the model (blocks until done). Safe to call when ready."""
    global _downloading
    with _lock:
        if _downloading:
            return
        _downloading = True
    try:
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        # Instantiating + one embed forces the full download and load.
        next(iter(_model().embed(["warmup"])))
    finally:
        _downloading = False


def embed_passages(texts: list[str]) -> list[bytes]:
    """Embed documents/chunks; returns packed float32 blobs. Caller must ensure
    is_ready() — this will otherwise trigger a (blocking) download."""
    return [np.asarray(v, dtype=np.float32).tobytes() for v in _model().embed(texts)]


def embed_query(text: str) -> np.ndarray:
    """Embed a search query (bge applies a query-side instruction prefix)."""
    return np.asarray(next(iter(_model().query_embed([text]))), dtype=np.float32)
