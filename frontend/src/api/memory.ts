import { api } from './base';

export type MemoryType = 'fact' | 'preference' | 'decision' | 'project' | 'todo' | 'person';

export type MemoryEntry = {
  id: string;
  content: string;
  type: MemoryType;
  importance: number;
  strength: number;
  confidence: number | null;
  valid: boolean;
  created_at: string;
  updated_at: string;
  last_recalled: string | null;
  source?: unknown;
};

// One proposed change from the consolidation pass. The agent never writes — it
// proposes; `approved` (default true) gates whether the apply step commits it.
export type DiffItem = {
  kind: 'add' | 'update' | 'deprecate' | 'promote';
  id?: string; // existing entry for update/deprecate; absent for add
  content?: string; // new/revised content for add/update/promote
  type?: MemoryType;
  importance?: number;
  reason: string; // why, with evidence (daily-log dates / entry ids)
  evidence?: string[];
  approved: boolean;
};

export type ConsolidationDiff = {
  items: DiffItem[];
  summary?: string;
};

const j = <T>(r: Response): Promise<T> => {
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
};

const send = <T>(method: string, path: string, body?: unknown): Promise<T> =>
  fetch(api(path), {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }).then((r) => j<T>(r));

export const listEntries = () =>
  fetch(api('/api/memory/entries')).then((r) => j<MemoryEntry[]>(r));

export const createEntry = (patch: {
  content: string;
  type?: MemoryType;
  importance?: number;
  confidence?: number | null;
}) => send<MemoryEntry>('POST', '/api/memory/entries', patch);

export const updateEntry = (
  id: string,
  patch: { content?: string; type?: MemoryType; importance?: number; valid?: boolean },
) => send<MemoryEntry>('PUT', `/api/memory/entries/${encodeURIComponent(id)}`, patch);

export const deleteEntry = (id: string) =>
  fetch(api(`/api/memory/entries/${encodeURIComponent(id)}`), { method: 'DELETE' });

export const clearAllMemory = () => fetch(api('/api/memory/all'), { method: 'DELETE' });

export const getProfile = () =>
  fetch(api('/api/memory/profile')).then((r) => j<{ text: string }>(r));

export const saveProfile = (text: string) =>
  send<{ text: string }>('PUT', '/api/memory/profile', { text });

export const getDaily = (date?: string) =>
  fetch(api(`/api/memory/daily${date ? `?date=${encodeURIComponent(date)}` : ''}`)).then((r) =>
    j<{ date: string; text: string }>(r),
  );

// Ask the LLM to propose a reviewable diff. Nothing is written here.
export const consolidate = () => send<ConsolidationDiff>('POST', '/api/memory/consolidate', {});

// Commit only the approved items from a (possibly edited) diff.
export const applyConsolidation = (diff: ConsolidationDiff) =>
  send<{ applied: number }>('POST', '/api/memory/consolidate/apply', diff);
