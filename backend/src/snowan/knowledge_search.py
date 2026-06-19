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

# A deliberately-saved/generated note is higher-signal than a passively captured
# page or chat, so notes outrank other sources at equal relevance. Weighting is by
# source_type (manual vs chat-generated notes both rank as notes — provenance, not
# weight, distinguishes them). Future sources slot in here.
_SOURCE_WEIGHTS = {
    "note": 1.0,
    "file": 0.85,
    "ai_chat": 0.7,
    "web_page": 0.7,
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


def _hit_count(text: str, terms: list[str]) -> int:
    t = text.lower()
    return sum(t.count(term) for term in terms)


def _excerpt(text: str, max_chars: int = 300) -> str:
    t = text.strip()
    return t if len(t) <= max_chars else t[: max_chars - 1].rstrip() + "…"


def search(query: str, limit: int = 8) -> list[dict]:
    """Top documents for a query, one best chunk each, fused keyword+semantic."""
    rows = knowledge_index.all_chunks()
    if not rows:
        return []

    # keyword leg
    terms = keywords(query)
    kw_ranked: list[int] = []
    if terms:
        scored = [
            (i, _hit_count(f"{r['text']} {r['title']} {r['heading']}", terms))
            for i, r in enumerate(rows)
        ]
        kw_ranked = [i for i, s in sorted(scored, key=lambda x: x[1], reverse=True) if s > 0][:50]

    # semantic leg — only when the model is downloaded and some chunks are embedded
    # (chunks saved before the download carry no vector); otherwise keyword-only.
    vec_ranked: list[int] = []
    # Only stack blobs of the exact current dimension — a truncated write or a vector
    # from an old model/DIM would make the reshape raise and fail the whole search.
    _want = embeddings.DIM * 4  # float32
    embedded = [i for i, r in enumerate(rows) if r["embedding"] and len(r["embedding"]) == _want]
    if embedded and embeddings.is_ready():
        mat = np.frombuffer(
            b"".join(rows[i]["embedding"] for i in embedded), dtype=np.float32
        ).reshape(len(embedded), embeddings.DIM)
        qv = embeddings.embed_query(query)
        qn = qv / (np.linalg.norm(qv) + 1e-9)
        sims = (mat / (np.linalg.norm(mat, axis=1, keepdims=True) + 1e-9)) @ qn
        vec_ranked = [embedded[int(k)] for k in np.argsort(-sims)[:50]]

    # Reciprocal Rank Fusion, then weight by source so notes outrank other sources.
    fused: dict[int, float] = {}
    for rank, i in enumerate(kw_ranked):
        fused[i] = fused.get(i, 0.0) + 1.0 / (_RRF_K + rank + 1)
    for rank, i in enumerate(vec_ranked):
        fused[i] = fused.get(i, 0.0) + 1.0 / (_RRF_K + rank + 1)
    for i in fused:
        fused[i] *= _SOURCE_WEIGHTS.get(rows[i]["source_type"], 0.6)

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
                "score": round(fused[i], 4),
            }
        )
        if len(results) >= limit:
            break
    return results
