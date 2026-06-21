import { readLS } from '../../hooks/useSessions';
import type { Session } from '../types';
import type { ImgSession, ImgTurn } from '../../hooks/useImagegen';
import { localDate } from '../../api/daily';

// Today's chats and generated images are owned by the frontend localStorage stores
// (the backend has no "created today" query — direction §10 forbids building one).
// We read those stores directly and filter by the session's updatedAt landing on
// the given local date. Snapshot reads, not reactive — the band refreshes on open.

export type ChatCapture = { id: string; title: string };
export type ImageCapture = { sessionId: string; title: string; previewId: string };

function sameLocalDate(ts: number, date: string): boolean {
  return localDate(new Date(ts)) === date;
}

export function todaysChats(date: string): ChatCapture[] {
  const sessions = readLS<Session[]>('snowan.sessions', []);
  return sessions
    .filter((s) => sameLocalDate(s.updatedAt, date))
    .map((s) => ({ id: s.id, title: s.title || '新对话' }));
}

export function todaysImages(date: string): ImageCapture[] {
  const sessions = readLS<ImgSession[]>('snowan.imagegen.sessions', []);
  const threads = readLS<Record<string, ImgTurn[]>>('snowan.imagegen.threads', {});
  return sessions
    .filter((s) => sameLocalDate(s.updatedAt, date))
    .map((s) => {
      const firstImage = (threads[s.id] ?? []).flatMap((t) => t.images)[0];
      return { sessionId: s.id, title: s.title || '新画图', previewId: firstImage?.id ?? '' };
    })
    .filter((c) => c.previewId);
}
