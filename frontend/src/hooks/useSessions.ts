import { useEffect, useState } from 'react';
import { deleteSession } from '../api/chat';
import type { Session, SessionStatus } from '../components/types';

const LS = { sessions: 'snowan.sessions', active: 'snowan.activeId' };

// Tiny localStorage reader, shared with useChat (which imports it from here).
export function readLS<T>(key: string, fallback: T): T {
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const s = localStorage.getItem(key);
    return s ? (JSON.parse(s) as T) : fallback;
  } catch {
    return fallback;
  }
}

const newSession = (): Session => ({
  id: crypto.randomUUID(),
  title: '新对话',
  status: 'active',
  tags: [],
  updatedAt: Date.now(),
});

// The session list + active id, mirrored to localStorage so the list survives a
// reload. The backend separately persists each session's agent history.
export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>(() => {
    const stored = readLS<Session[]>(LS.sessions, []);
    return stored.length ? stored : [newSession()];
  });
  const [activeId, setActiveId] = useState(() => {
    const stored = readLS<string>(LS.active, '');
    return sessions.some((s) => s.id === stored) ? stored : sessions[0].id;
  });

  useEffect(() => {
    localStorage.setItem(LS.sessions, JSON.stringify(sessions));
  }, [sessions]);
  useEffect(() => {
    localStorage.setItem(LS.active, activeId);
  }, [activeId]);

  // Keep the active id pointing at a session that still exists (e.g. after delete).
  useEffect(() => {
    if (sessions.length && !sessions.some((s) => s.id === activeId)) {
      setActiveId(sessions[0].id);
    }
  }, [sessions, activeId]);

  const addSession = () => {
    const s = newSession();
    setSessions((prev) => [s, ...prev]);
    setActiveId(s.id);
    return s;
  };
  const rename = (id: string, title: string) =>
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, title } : s)));
  const setStatus = (id: string, status: SessionStatus) =>
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status, updatedAt: Date.now() } : s)),
    );
  const remove = (id: string) => {
    deleteSession(id).catch(() => {});
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      return next.length ? next : [newSession()];
    });
  };

  const activeTitle = sessions.find((s) => s.id === activeId)?.title;

  return { sessions, activeId, setActiveId, addSession, rename, setStatus, remove, activeTitle };
}
