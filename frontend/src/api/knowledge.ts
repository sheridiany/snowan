import { api } from './base';

export type Note = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
  origin: string; // "manual" | "chat"
  source?: Record<string, unknown>;
};

export type NoteDraft = {
  title: string;
  body: string;
  used_model: boolean;
  fallback_reason: string | null;
};

export type DraftEntry = { role: 'user' | 'assistant'; text: string };

const j = <T>(r: Response): Promise<T> => {
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
};

const post = <T>(path: string, body: unknown): Promise<T> =>
  fetch(api(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then((r) => j<T>(r));

export const listNotes = () => fetch(api('/api/knowledge/notes')).then((r) => j<Note[]>(r));

export const draftNote = (entries: DraftEntry[], topic = '') =>
  post<NoteDraft>('/api/knowledge/notes/draft', { entries, topic });

export const createNote = (payload: {
  body: string;
  title?: string;
  origin?: string;
  source?: Record<string, unknown>;
}) => post<Note>('/api/knowledge/notes', payload);

export type EmbeddingStatus = {
  model: string;
  size_mb: number;
  ready: boolean;
  downloading: boolean;
};

export const getEmbeddingStatus = () =>
  fetch(api('/api/knowledge/embedding')).then((r) => j<EmbeddingStatus>(r));

export const downloadEmbedding = () =>
  post<{ ready: boolean; downloading: boolean }>('/api/knowledge/embedding/download', {});

export type KbFolder = { id: string; path: string; file_count: number; added_at?: string };
export type FoldersState = { folders: KbFolder[]; indexing: boolean };

export const listFolders = () =>
  fetch(api('/api/knowledge/folders')).then((r) => j<FoldersState>(r));

export const addFolder = (path: string) =>
  post<FoldersState>('/api/knowledge/folders', { path });

export const removeFolder = (id: string) =>
  fetch(api(`/api/knowledge/folders/${id}`), { method: 'DELETE' }).then((r) => j<FoldersState>(r));

export const reindexFolders = () =>
  post<FoldersState>('/api/knowledge/folders/reindex', {});
