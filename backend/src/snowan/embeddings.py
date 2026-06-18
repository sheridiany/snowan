"""Local CPU embeddings via fastembed. Note content is embedded ON-DEVICE — it
never leaves the machine to be indexed; only the final answer prompt goes to the
cloud LLM ("everything local except AI Q&A"). MODEL_ID is exported so the index
can invalidate and re-embed itself when the model changes."""
from functools import lru_cache

import numpy as np

MODEL_ID = "BAAI/bge-small-zh-v1.5"  # 512-dim, strong on Chinese, ~95MB ONNX
DIM = 512


@lru_cache(maxsize=1)
def _model():
    from fastembed import TextEmbedding

    return TextEmbedding(model_name=MODEL_ID)


def embed_passages(texts: list[str]) -> list[bytes]:
    """Embed documents/chunks; returns packed float32 blobs for SQLite storage."""
    return [np.asarray(v, dtype=np.float32).tobytes() for v in _model().embed(texts)]


def embed_query(text: str) -> np.ndarray:
    """Embed a search query (bge applies a query-side instruction prefix)."""
    vec = next(iter(_model().query_embed([text])))
    return np.asarray(vec, dtype=np.float32)


def warm() -> None:
    """Force model load (and the one-time download) ahead of first use."""
    _model()
