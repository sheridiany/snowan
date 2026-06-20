// Reading (阅读) client for /api/reading. Articles + feeds live server-side in
// ~/.snowan/reading.db; this module is the only place that talks to the backend.
// All HTML bodies returned here are already sanitized by nh3 on the server.
import { api } from './base';

export type FeedOut = {
  id: number;
  feed_url: string;
  site_url: string | null;
  title: string | null;
  description: string | null;
  favicon_url: string | null;
  unread_count: number;
  fetch_error: string | null;
};

export type ArticleView = 'all' | 'unread' | 'starred' | 'later';

export type ArticleListItem = {
  id: string;
  feed_id: number | null;
  title: string | null;
  url: string | null;
  summary: string | null;
  image_url: string | null;
  published_at: string | null;
  fetched_at: string;
  is_read: boolean;
  is_starred: boolean;
  read_later: boolean;
};

export type ArticleOut = ArticleListItem & {
  feed_title: string | null;
  author: string | null;
  content_html: string | null;
  extracted_html: string | null;
  ai_summary: string | null;
  translated_html: string | null;
  translated_lang: string | null;
  note_id: string | null;
};

export type AskSource = { id: string; title: string };
export type AskResult = { answer: string; sources: AskSource[] };

const j = <T>(r: Response): Promise<T> => {
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
};

const post = <T>(path: string, body?: unknown): Promise<T> =>
  fetch(api(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  }).then((r) => j<T>(r));

const patch = <T>(path: string, body: unknown): Promise<T> =>
  fetch(api(path), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then((r) => j<T>(r));

const del = (path: string): Promise<void> =>
  fetch(api(path), { method: 'DELETE' }).then((r) => {
    if (!r.ok) throw new Error(`${r.status}`);
  });

// --- Feeds ---
export const listFeeds = () => fetch(api('/api/reading/feeds')).then((r) => j<FeedOut[]>(r));

export const addFeed = (url: string) => post<FeedOut>('/api/reading/feeds', { url });

export const renameFeed = (id: number, title: string) =>
  patch<FeedOut>(`/api/reading/feeds/${id}`, { title });

export const deleteFeed = (id: number) => del(`/api/reading/feeds/${id}`);

export const refreshAll = () => post<{ new: number }>('/api/reading/refresh');

export const refreshFeed = (id: number) =>
  post<{ new: number }>(`/api/reading/feeds/${id}/refresh`);

// --- Articles ---
export const listArticles = (params: {
  view?: ArticleView;
  feed_id?: number | null;
  q?: string;
  limit?: number;
  before?: string;
}) => {
  const qs = new URLSearchParams();
  if (params.view) qs.set('view', params.view);
  if (params.feed_id != null) qs.set('feed_id', String(params.feed_id));
  if (params.q) qs.set('q', params.q);
  if (params.limit != null) qs.set('limit', String(params.limit));
  if (params.before) qs.set('before', params.before);
  const s = qs.toString();
  return fetch(api(`/api/reading/articles${s ? `?${s}` : ''}`)).then((r) => j<ArticleListItem[]>(r));
};

export const getArticle = (id: string) =>
  fetch(api(`/api/reading/articles/${id}`)).then((r) => j<ArticleOut>(r));

export const updateArticle = (
  id: string,
  patchBody: { is_read?: boolean; is_starred?: boolean; read_later?: boolean },
) => patch<ArticleOut>(`/api/reading/articles/${id}`, patchBody);

export const saveUrl = (url: string) => post<ArticleOut>('/api/reading/articles/url', { url });

// --- AI ---
export const summarizeArticle = (id: string) =>
  post<{ summary: string }>(`/api/reading/articles/${id}/summarize`);

export const translateArticle = (id: string, lang: string) =>
  post<{ html: string }>(`/api/reading/articles/${id}/translate`, { lang });

export const ask = (question: string) =>
  post<AskResult>('/api/reading/ask', { question });

// --- KB bridge ---
export const saveArticleNote = (id: string) =>
  post<{ note_id: string }>(`/api/reading/articles/${id}/save-note`);
