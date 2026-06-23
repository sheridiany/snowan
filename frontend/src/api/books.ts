// Books (书架) client for /api/books. Books + chapters live server-side in
// ~/.snowan/books.db; this module is the only place that talks to the backend.
// Chapter HTML returned here is already sanitized at parse time on the server.
import { api } from './base';
import type { Note } from './knowledge';

// List/detail rows from books._book_row. `language` is added only by get_book
// (the detail endpoint), so it lives on BookDetail, not BookOut.
export type BookOut = {
  id: string;
  title: string | null;
  author: string | null;
  format: string;
  cover_url: string | null;
  n_chapters: number;
  added_at: string;
};

export type ChapterMeta = { num: number; title: string | null };

export type BookDetail = BookOut & {
  language: string | null;
  chapters: ChapterMeta[];
};

export type ChapterOut = { num: number; title: string | null; html: string | null };

// Book ask sources differ from reading's {id,title}: the backend cites a chapter
// title plus the retrieved snippet (see books.py ask()).
export type AskSource = { chapter: string; snippet: string };
export type AskResult = { answer: string; sources: AskSource[] };

// 主题阅读 (syntopical / cross-book): one synthesized answer over a SET of books.
// sources reuse AskSource's {chapter, snippet}; books_used lists the distinct
// books the answer actually drew from, with each book's hit count.
export type SyntopicalResult = {
  answer: string;
  sources: AskSource[];
  books_used: { book_id: string; book_title: string; n_hits: number }[];
};

// The 伴读 has three grounded modes. qa answers; socratic poses probing questions;
// feynman plays a curious beginner the user explains a concept to.
export type CompanionMode = 'qa' | 'socratic' | 'feynman';

// History threaded into mode-aware asks: each prior chat turn as {role, text}.
// 'ai' is normalized to 'assistant' for the backend prompt (see books.py).
export type AskTurn = { role: 'user' | 'assistant'; text: string };

export type AskBody = {
  question: string;
  mode?: CompanionMode;
  history?: AskTurn[];
  passage?: string; // a 划词 selection the user is asking about, force-included
};

const j = <T>(r: Response): Promise<T> => {
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
};

// AI generations can take a while, but a stalled provider must not spin forever:
// abort after timeoutMs so the caller's .catch surfaces a real error instead.
const post = <T>(path: string, body?: unknown, timeoutMs = 180000): Promise<T> => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  return fetch(api(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
    signal: ctrl.signal,
  })
    .then((r) => j<T>(r))
    .finally(() => clearTimeout(timer));
};

const del = (path: string): Promise<void> =>
  fetch(api(path), { method: 'DELETE' }).then((r) => {
    if (!r.ok) throw new Error(`${r.status}`);
  });

// --- CRUD ---
// Trailing slash matches the FastAPI route (@router.get("/")).
export const listBooks = () => fetch(api('/api/books/')).then((r) => j<BookOut[]>(r));

export const getBook = (id: string) =>
  fetch(api(`/api/books/${id}`)).then((r) => j<BookDetail>(r));

export const deleteBook = (id: string) => del(`/api/books/${id}`);

// Cover is served as image/png bytes; use the URL directly in <img src>.
export const coverUrl = (id: string) => api(`/api/books/${id}/cover`);

// --- upload ---
// The backend wants JSON { filename, data } where data is base64-encoded bytes
// (NOT multipart). Accepts a File (read+encode here) or a pre-encoded base64 string.
export const uploadBook = (filename: string, fileOrBase64: File | string) => {
  const encoded =
    typeof fileOrBase64 === 'string' ? Promise.resolve(fileOrBase64) : fileToBase64(fileOrBase64);
  return encoded.then((data) => post<BookDetail>('/api/books/upload', { filename, data }));
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    // strip the "data:...;base64," prefix the backend doesn't expect
    reader.onload = () => resolve(String(reader.result).split(',', 2)[1] ?? '');
    reader.readAsDataURL(file);
  });
}

// --- AI ---
export const overview = (id: string) =>
  post<{ overview: string }>(`/api/books/${id}/overview`);

export const skeleton = (id: string) =>
  post<{ skeleton: string }>(`/api/books/${id}/skeleton`);

export const ask = (id: string, body: AskBody) =>
  post<AskResult>(`/api/books/${id}/ask`, {
    question: body.question,
    mode: body.mode ?? 'qa',
    history: body.history ?? [],
    passage: body.passage,
  });

// 主题阅读: synthesize an answer across the selected books ([] = whole shelf).
// Shelf-level route (no {book_id}); the backend retrieves over all given books.
export const syntopical = (question: string, bookIds: string[]) =>
  post<SyntopicalResult>('/api/books/syntopical', { question, book_ids: bookIds });

// The AI's opening turn for a mode (socratic: a first probing question; feynman:
// the "讲给我听" prompt; qa returns "").
export const startMode = (id: string, mode: CompanionMode) =>
  post<{ answer: string }>(`/api/books/${id}/start-mode`, { mode });

// Save a companion insight/answer into the vault; returns the created KB note.
export const saveInsight = (id: string, payload: { text: string; chapter?: string }) =>
  post<Note>(`/api/books/${id}/save-insight`, payload);

export const generateCover = (id: string) =>
  post<{ cover_url: string }>(`/api/books/${id}/cover/generate`);

// --- 学习物料 (study artifacts) ---
// Three book-grounded artifacts cached server-side per (book, kind): a glossary
// (术语表), a nested-outline mindmap (思维导图), and per-chapter summaries (章节摘要).
export type ArtifactKind = 'glossary' | 'mindmap' | 'summary';

export const generateArtifact = (id: string, kind: ArtifactKind) =>
  post<{ kind: ArtifactKind; content: string; updated_at: string }>(
    `/api/books/${id}/artifact/${kind}`,
  );

export const getArtifacts = (id: string) =>
  fetch(api(`/api/books/${id}/artifacts`)).then((r) =>
    j<Partial<Record<ArtifactKind, string>>>(r),
  );
