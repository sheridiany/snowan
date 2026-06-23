import { readLS } from '../../hooks/useSessions';
import type { Session } from '../types';
import { localDate } from '../../api/daily';

// Today's chats are owned by the frontend localStorage store (the backend has no
// "created today" query — direction §10 forbids building one). We read it directly
// and filter by updatedAt landing on the given local date. Snapshot, not reactive —
// the band refreshes on open.

export type ChatCapture = { id: string; title: string };

function sameLocalDate(ts: number, date: string): boolean {
  return localDate(new Date(ts)) === date;
}

export function todaysChats(date: string): ChatCapture[] {
  const sessions = readLS<Session[]>('snowan.sessions', []);
  return sessions
    .filter((s) => sameLocalDate(s.updatedAt, date))
    .map((s) => ({ id: s.id, title: s.title || '新对话' }));
}
