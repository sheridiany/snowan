# Reading (阅读) — Design Spec

Date: 2026-06-20 · Status: approved (scope locked) · Snowan

Replaces the 新闻/news coming-soon placeholder with a local-first reader: RSS/Atom
feeds + paste-any-URL, a 3-pane reading UI, and AI (summarize / ask / translate).
Inspired by **l0ng-ai/papr** (MIT, a native Rust RSS reader) but re-implemented on
Snowan's stack (Python / FastAPI / PydanticAI · React 19 / antd 6 / lobe-ui ·
`.md` vault + SQLite hybrid index + on-device fastembed embeddings).

## Locked decisions
1. **Ingestion**: RSS/Atom/JSON feeds **+ paste-any-URL** (read-it-later).
2. **AI**: per-article **summarize** (cached) · **ask-your-reading** (hybrid RAG) ·
   full-article **translate** (cached). Reuse the existing provider config + model factory.
3. **KB**: reading articles live only in `reading.db`; only an explicit **存为笔记**
   promotes an article into the `.md` vault → unified KB. Feed churn never pollutes
   the chat agent's knowledge.
4. **Refresh**: manual ("刷新") + on-view-open. **No background scheduler/cron**
   (Snowan deliberately dropped the proactive layer).
5. Cloud LLM only (per provider config); everything else local.

## What to take from papr (mechanics), what to invert
- Pipeline: **discover → fetch (conditional GET: ETag/Last-Modified → 304) → parse
  (feedparser) → extract full text (trafilatura) → sanitize (nh3) → store → index.**
- **Store three bodies**: `content_html` (feed body, sanitized) · `extracted_html`
  (trafilatura full text, sanitized) · `body_text` (plain → FTS + embeddings + AI).
- **One sanitize chokepoint** (`nh3`): feed HTML, extracted HTML, AND translated HTML
  all pass through it before store/render. rel="noopener noreferrer nofollow".
- **Two-mode retrieval**: AND-join FTS for explicit search; OR-join + embedding recall
  for RAG.
- **Cache derived AI on the row with an invalidation key**: `ai_summary` only on
  completion; `translated_html` paired with `translated_lang` (changing target = miss).
- Sort `datetime(COALESCE(published_at, fetched_at)) DESC`; clamp future dates to now+24h.
- **Invert vs papr**: keep semantic search (on-device fastembed — papr deleted it);
  reuse Snowan provider config + model factory; no scheduler; no FreshRSS/IMAP.

## Backend

New `~/.snowan/reading.db` (SQLite, WAL — same convention as `knowledge` `index.db`).
New `server/reading.py` (router) + `reading.py` (pipeline logic). Reuse `embeddings.py`
(fastembed `bge-small-zh`), `config`, and the model factory for AI.

New deps: **feedparser**, **nh3** (`trafilatura`, `httpx` already present).

### Schema
```sql
CREATE TABLE feeds(
  id INTEGER PRIMARY KEY, feed_url TEXT UNIQUE NOT NULL, site_url TEXT, title TEXT,
  description TEXT, favicon_url TEXT, etag TEXT, last_modified TEXT,
  last_fetched_at TEXT, fetch_error TEXT, created_at TEXT NOT NULL);

CREATE TABLE articles(
  id TEXT PRIMARY KEY,
  feed_id INTEGER REFERENCES feeds(id) ON DELETE CASCADE,  -- NULL = pasted/saved URL
  guid TEXT, url TEXT, title TEXT, author TEXT, summary TEXT,
  content_html TEXT, extracted_html TEXT, body_text TEXT, image_url TEXT,
  ai_summary TEXT, translated_html TEXT, translated_lang TEXT,
  published_at TEXT, fetched_at TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0, is_starred INTEGER NOT NULL DEFAULT 0,
  read_later INTEGER NOT NULL DEFAULT 0,
  note_id TEXT,                       -- set when promoted to the vault
  UNIQUE(feed_id, guid));

CREATE VIRTUAL TABLE articles_fts USING fts5(
  title, body, content='', tokenize='porter unicode61');

CREATE TABLE article_embeddings(
  article_id TEXT PRIMARY KEY REFERENCES articles(id) ON DELETE CASCADE,
  vector BLOB NOT NULL);
-- + indexes: articles(feed_id); partial WHERE is_read=0 / is_starred=1 / read_later=1;
--   expression index on datetime(COALESCE(published_at, fetched_at)).
```

### Endpoints (`/api/reading/*`)
Feeds:
- `POST /feeds {url}` → discover `<link rel=alternate>` if needed, subscribe, initial fetch → FeedOut
- `GET /feeds` → FeedOut[] (with `unread_count`)
- `PATCH /feeds/{id} {title?}` (rename)
- `DELETE /feeds/{id}` → unsubscribe (cascade articles)
- `POST /refresh` → refresh all (conditional GET) → `{new: int}`
- `POST /feeds/{id}/refresh` → refresh one

Articles:
- `GET /articles?view=all|unread|starred|later&feed_id=&q=&limit=&before=` → ArticleListItem[]
  (sorted by date; when `q` present, FTS AND-join)
- `GET /articles/{id}` → ArticleOut (full bodies; does not auto-mark read)
- `PATCH /articles/{id} {is_read?, is_starred?, read_later?}`
- `POST /articles/url {url}` → fetch + extract + sanitize, store as a saved article
  (`feed_id` NULL) → ArticleOut

AI (reuse active model from provider config):
- `POST /articles/{id}/summarize` → `{summary}` (caches `ai_summary`; v1 synchronous + spinner)
- `POST /ask {question}` → `{answer, sources:[{id,title}]}` — hybrid RAG: keyword(FTS OR-join)
  + embedding recall, top ~6, truncate each body to ~1200 chars, "answer only from these,
  cite titles, say so if absent" prompt.
- `POST /articles/{id}/translate {lang}` → `{html}` (caches `translated_html`/`translated_lang`;
  re-sanitize the model output)

KB bridge:
- `POST /articles/{id}/save-note` → reuse `knowledge.create_note(body, title, origin='reading',
  source={url})`; set `articles.note_id` → `{note_id}`

Follow `server/providers.py` + `server/knowledge.py` conventions (APIRouter, pydantic
models, snake_case JSON). Register the router in `server/app.py`.

### Pipeline notes
- **fetch** (`httpx`): send `If-None-Match`/`If-Modified-Since`; handle 304; store
  `etag`/`last_modified`; cap body size; record `fetch_error` on failure (never raise to
  the whole refresh — one bad feed must not break the others).
- **parse** (`feedparser`): `guid` = entry id or link; `published_at` from entry (clamp
  future → now+24h); `content_html` from content/summary; `image_url` from media
  thumbnail → media content → first body `<img>`.
- **extract** (`trafilatura`): `extracted_html` + `body_text`; if a feed only ships a
  summary, fetch the article URL and extract; fall back to `content_html` text if empty.
- **sanitize** (`nh3`): clean `content_html`, `extracted_html`, and any `translated_html`
  before storing/rendering.
- **index**: `body_text` → `articles_fts`; compute embedding via `embeddings.embed()` →
  `article_embeddings` **only if** the embedding model is ready (degrade to keyword-only).

## Frontend

Rename nav: `View` `'news'` → `'reading'`; `ListPane` SECTIONS `'新闻'` → `'阅读'`,
icon `Newspaper` → `BookOpen`; `ComingSoonView` drops the `'news'` entry (narrow
`PlaceholderView` to `'design'`); `App.tsx` routes `nav.view==='reading'` → `<ReadingView>`
and suppresses the knowledge `RightPanel` for `'reading'` (like Draw).

New `components/views/ReadingView.tsx` — internal 3-column layout:
- **Left** = `ListPane`(reading): smart views (全部 / 未读 / 星标 / 稍后读 with counts) +
  feed list (unread counts) + add (paste a feed **or** article URL) + 刷新.
- **Middle** = article-list column (title · feed · time · unread dot · star toggle).
- **Reader** = reader column: title/meta + rendered `extracted_html` + action bar
  (已读 / 星标 / 稍后读 / 摘要 / 翻译 / 存为笔记) + inline AI summary (rendered markdown) +
  a 问阅读 (Q&A) entry.
  (Middle + reader live in the `DetailPane` area; `ReadingView` renders `ListPane` + a flex
  of [article-list, reader].)

New `components/reading/`: `FeedList`, `ArticleList`, `Reader`, `AddFeed`, `AskPanel`.
New `api/reading.ts` + types. Articles are **server-backed** (in `reading.db`) — no
localStorage for article state; a thin view-local hook holds current feed/view/selection
and fetches via the api module (mirror the existing fetch + useState patterns).

AI UX: 摘要 → calls summarize, renders the cached markdown summary in the reader
(existing `Markdown`); 翻译 → toggles `translated_html`; 问阅读 → small panel: question →
answer (markdown) + cited article links; 存为笔记 → save-note → toast (reuse the note flow).

Strings: hardcoded Chinese, matching every existing view — the app currently has
no i18n framework (Chat / Draw / Settings all hardcode zh). An i18n layer, if ever
wanted, is a separate app-wide task.

## Phasing (both built on `feat/reading`)
- **P1**: schema · feeds CRUD · refresh · pipeline · article list · reader · read/star/later ·
  keyword search · paste-URL · nav rename.
- **P2**: summarize · ask (hybrid RAG) · translate · save-note bridge · embedding indexing.

## Verification
- Backend: `uv run python -c "import snowan.server.app; from snowan.server.reading import router"`
  + unit tests (parse a feed fixture, sanitize, FTS + filter roundtrip) on a tmp
  `SNOWAN_HOME`, **no network** (mock `httpx`).
- Frontend: `npx tsc -b`.
- Scope: edit only `backend/src/snowan` (+ `backend/tests`) and `frontend/src`; never
  `src-tauri`; no formatters/full builds (Snowan has no eslint/ruff).

## Non-goals (v1)
FreshRSS/Miniflux sync · IMAP newsletters · podcasts/audio player · browser extension ·
OPML import (P3) · folders/tags (P3) · highlights (P3) · background auto-refresh/cron.
