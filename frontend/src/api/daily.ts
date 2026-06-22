// Daily note (「今天」) client for /api/knowledge/daily. A daily note is an ordinary
// vault note keyed by date (notes/daily/YYYY-MM-DD.md); the assembly band is queried
// live and is NEVER written into the .md — only the user's prose persists.
//
// "today" is ALWAYS the client's local date: the backend never computes its own
// today (avoids tz drift). localDate() is the single source for that string and
// drives both the filename and the events_on query.
import { api } from './base';
import type { CalendarEvent } from './calendar';

export type DailyNote = {
  id: string;
  date: string;
  title: string;
  body: string;
  updated_at: string;
};

export type AssemblyReading = { id: string; title: string; url: string; feedTitle: string };
export type AssemblyMemory = { id: string; title: string; snippet: string };
export type Assembly = {
  events: CalendarEvent[];
  reading: AssemblyReading[];
  memory: AssemblyMemory[];
};

export type CarryoverItem = { line: string; fromDate: string };

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

// The client's local calendar date as YYYY-MM-DD — the canonical "today".
export function localDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

// GET /daily/{date} — find-or-create, applying the template on first create.
export const getDaily = (date: string) =>
  fetch(api(`/api/knowledge/daily/${date}`)).then((r) => j<DailyNote>(r));

// PUT /daily/{date} — save the body. base_updated_at lets the backend 409 when the
// file changed on disk under the open buffer; the caller resolves the conflict.
export const saveDaily = (date: string, body: string, baseUpdatedAt?: string) =>
  fetch(api(`/api/knowledge/daily/${date}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body, base_updated_at: baseUpdatedAt }),
  }).then((r) => {
    if (r.status === 409) throw new ConflictError();
    return j<DailyNote>(r);
  });

export class ConflictError extends Error {
  constructor() {
    super('409');
    this.name = 'ConflictError';
  }
}

// GET /daily/dates — dates that have a daily note (for calendar dots).
export const listDailyDates = () =>
  fetch(api('/api/knowledge/daily/dates')).then((r) => j<string[]>(r));

// GET /daily/{date}/assembly — read-only live context (events + reading + memory).
export const getAssembly = (date: string) =>
  fetch(api(`/api/knowledge/daily/${date}/assembly`)).then((r) => j<Assembly>(r));

// GET /daily/{date}/carryover — unchecked "- [ ]" items from recent daily notes.
export const getCarryover = (date: string) =>
  fetch(api(`/api/knowledge/daily/${date}/carryover`)).then((r) => j<CarryoverItem[]>(r));

// POST /daily/{date}/suggest — exactly 3 KB-grounded suggestions (advice, not tasks).
export const suggestDay = (date: string) =>
  post<{ draft: string }>(`/api/knowledge/daily/${date}/suggest`);

// POST /daily/{date}/summarize — one-shot agent → an editable evening-review draft.
export const summarizeDay = (date: string) =>
  post<{ draft: string }>(`/api/knowledge/daily/${date}/summarize`);
