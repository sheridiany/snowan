"""Hybrid retrieval over the knowledge index: keyword recall (CJK n-gram, the
same battle-tested tokenizer as before) fused with local-embedding semantic recall
via Reciprocal Rank Fusion. Pure vector misses exact tokens (ids, paths, names);
pure keyword misses paraphrase — both legs, fused, cover each other.

Brute-force over chunks: correct and instant at single-user scale. If a corpus
ever outgrows it, the legs map cleanly onto SQLite FTS5 (keyword) + sqlite-vec
(vector) without changing this interface."""
import re

import numpy as np

from . import embeddings, knowledge_index

_RRF_K = 60

# A deliberately-saved/generated note is higher-signal than an indexed file, so
# notes outrank other sources at equal relevance. Weighting is by source_type
# (manual vs chat-generated notes both rank as notes — provenance, not weight,
# distinguishes them). Future sources slot in here.
_SOURCE_WEIGHTS = {
    "memory": 1.1,  # long-term memory outranks everything at equal relevance
    "note": 1.0,
    "file": 0.85,
    "calendar": 0.6,
    "email": 0.6,
}

_STOPWORDS = {
    "一下", "什么", "怎么", "如何", "我的", "这个", "那个", "可以", "需要", "没有",
    "知道", "告诉", "帮我", "看看", "关于", "记得", "之前", "现在", "哪些", "一些",
    "the", "and", "for", "with", "what", "how", "about", "show", "list", "note", "notes",
}
_STOP_CHARS = set("的了吗呢吧啊呀和与或在是有我你他她它们这那")
_TOKEN_RE = re.compile(r"[a-z0-9]+|[一-鿿]+", re.IGNORECASE)


def _normalize(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip().lower()


def keywords(query: str) -> list[str]:
    """Tokenize a query into search terms; CJK runs >3 chars expand to 2/3-grams."""
    terms: set[str] = set()
    for tok in _TOKEN_RE.findall(_normalize(query)):
        if tok.isascii():
            if len(tok) >= 2 and tok not in _STOPWORDS:
                terms.add(tok)
        elif len(tok) <= 3:
            if len(tok) >= 2 and tok not in _STOPWORDS and tok not in _STOP_CHARS:
                terms.add(tok)
        else:
            for n in (2, 3):
                for i in range(len(tok) - n + 1):
                    g = tok[i : i + n]
                    if g not in _STOPWORDS:
                        terms.add(g)
    return sorted(terms, key=len, reverse=True)


# Per-query, search() used to reload every chunk, b"".join + frombuffer + reshape
# the whole embedding matrix, and recompute per-row L2 norms — on every keystroke.
# Cache the rows + the stacked, ALREADY-unit-normalized matrix (+ the embedded row
# indices) here; the (version, DIM, ready) key invalidates the instant a write bumps
# knowledge_index.version() or the model/its dimension changes, keeping results exact.
_cache: dict | None = None


def _load() -> tuple[list[dict], list[int], np.ndarray | None]:
    global _cache
    ready = embeddings.is_ready()
    key = (knowledge_index.version(), embeddings.DIM, ready)
    if _cache is not None and _cache["key"] == key:
        return _cache["rows"], _cache["embedded"], _cache["matrix"]

    rows = [dict(r) for r in knowledge_index.all_chunks()]
    # Only stack blobs of the exact current dimension — a truncated write or a vector
    # from an old model/DIM would make the reshape raise and fail the whole search.
    want = embeddings.DIM * 4  # float32
    embedded = [i for i, r in enumerate(rows) if r["embedding"] and len(r["embedding"]) == want]
    matrix: np.ndarray | None = None
    if embedded and ready:
        mat = np.frombuffer(
            b"".join(rows[i]["embedding"] for i in embedded), dtype=np.float32
        ).reshape(len(embedded), embeddings.DIM)
        matrix = mat / (np.linalg.norm(mat, axis=1, keepdims=True) + 1e-9)

    _cache = {"key": key, "rows": rows, "embedded": embedded, "matrix": matrix}
    return rows, embedded, matrix


def _hit_count(text: str, terms: list[str]) -> int:
    t = text.lower()
    return sum(t.count(term) for term in terms)


def _excerpt(text: str, max_chars: int = 300) -> str:
    t = text.strip()
    return t if len(t) <= max_chars else t[: max_chars - 1].rstrip() + "…"


def search(query: str, limit: int = 8, reinforce: bool = False,
           exclude_sources: set[str] | None = None) -> list[dict]:
    """Top documents for a query, one best chunk each, fused keyword+semantic.
    Memory rows get a soft-forgetting decay (recency × importance); set reinforce=True
    when this recall represents real usage so surfaced memories are strengthened.
    exclude_sources drops whole source types (the notes browse excludes 'memory')."""
    rows, embedded, matrix = _load()
    keep = (
        {i for i, r in enumerate(rows) if r["source_type"] not in exclude_sources}
        if exclude_sources else None
    )
    if not rows or (keep is not None and not keep):
        return []

    # keyword leg
    terms = keywords(query)
    kw_ranked: list[int] = []
    if terms:
        scored = [
            (i, _hit_count(f"{r['text']} {r['title']} {r['heading']}", terms))
            for i, r in enumerate(rows)
            if keep is None or i in keep
        ]
        kw_ranked = [i for i, s in sorted(scored, key=lambda x: x[1], reverse=True) if s > 0][:50]

    # semantic leg — only when the model is downloaded and some chunks are embedded
    # (chunks saved before the download carry no vector); otherwise keyword-only. The
    # matrix is cached pre-unit-normalized, so per query we only embed + dot the query.
    vec_ranked: list[int] = []
    if matrix is not None:
        qv = embeddings.embed_query(query)
        qn = qv / (np.linalg.norm(qv) + 1e-9)
        sims = matrix @ qn
        vec_ranked = [
            embedded[int(k)] for k in np.argsort(-sims)
            if keep is None or embedded[int(k)] in keep
        ][:50]

    # Reciprocal Rank Fusion, then weight by source so notes outrank other sources.
    fused: dict[int, float] = {}
    for rank, i in enumerate(kw_ranked):
        fused[i] = fused.get(i, 0.0) + 1.0 / (_RRF_K + rank + 1)
    for rank, i in enumerate(vec_ranked):
        fused[i] = fused.get(i, 0.0) + 1.0 / (_RRF_K + rank + 1)
    for i in fused:
        fused[i] *= _SOURCE_WEIGHTS.get(rows[i]["source_type"], 0.6)

    # Soft forgetting: scale memory rows by recency × importance (decay) so stale,
    # low-importance memories sink. Lazy import — memory depends on this module.
    mem_ids = {rows[i]["document_id"] for i in fused if rows[i]["source_type"] == "memory"}
    if mem_ids:
        from . import memory
        factors = memory.recency_factors(list(mem_ids))
        for i in fused:
            if rows[i]["source_type"] == "memory":
                fused[i] *= factors.get(rows[i]["document_id"], 1.0)

    results: list[dict] = []
    seen: set[str] = set()
    for i in sorted(fused, key=fused.get, reverse=True):
        r = rows[i]
        if r["document_id"] in seen:
            continue
        seen.add(r["document_id"])
        results.append(
            {
                "document_id": r["document_id"],
                "title": r["title"],
                "heading": r["heading"],
                "snippet": _excerpt(r["text"]),
                "source_type": r["source_type"],
                "score": round(fused[i], 4),
            }
        )
        if len(results) >= limit:
            break

    if reinforce:
        hits = [r["document_id"] for r in results if r["source_type"] == "memory"]
        if hits:
            from . import memory
            memory.reinforce(hits)
    return results
