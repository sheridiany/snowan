import { useEffect, useState } from 'react';
import {
  generateImage,
  deleteImage,
  deleteImages,
  copyToLibrary,
  type GenerateRequest,
} from '../api/imagegen';
import { readLS } from './useSessions';

const LS = {
  sessions: 'snowan.imagegen.sessions',
  active: 'snowan.imagegen.activeId',
  threads: 'snowan.imagegen.threads',
  library: 'snowan.imagegen.library',
};

export type ImgSession = { id: string; title: string; updatedAt: number };
export type ImgParams = { size: string; n: number };
export type ImgTurn = {
  id: string;
  prompt: string;
  params: ImgParams;
  provider: string | null;
  model: string | null;
  status: 'pending' | 'done' | 'error';
  error?: string;
  images: { id: string }[];
};
export type LibraryEntry = { id: string; prompt: string; params: ImgParams; previewId: string };

const newSession = (): ImgSession => ({
  id: crypto.randomUUID(),
  title: '新画图',
  updatedAt: Date.now(),
});

// Mirrors useSessions/useChat: the session list, per-session turns, and a global
// library all mirror to localStorage. The backend separately owns the image bytes,
// so deletions cascade through it before we drop local references.
export function useImagegen() {
  const [sessions, setSessions] = useState<ImgSession[]>(() => {
    const stored = readLS<ImgSession[]>(LS.sessions, []);
    return stored.length ? stored : [newSession()];
  });
  const [activeId, setActiveId] = useState(() => {
    const stored = readLS<string>(LS.active, '');
    return sessions.some((s) => s.id === stored) ? stored : sessions[0].id;
  });
  const [threads, setThreads] = useState<Record<string, ImgTurn[]>>(() =>
    readLS<Record<string, ImgTurn[]>>(LS.threads, {}),
  );
  const [library, setLibrary] = useState<LibraryEntry[]>(() =>
    readLS<LibraryEntry[]>(LS.library, []),
  );

  useEffect(() => {
    localStorage.setItem(LS.sessions, JSON.stringify(sessions));
  }, [sessions]);
  useEffect(() => {
    localStorage.setItem(LS.active, activeId);
  }, [activeId]);
  useEffect(() => {
    localStorage.setItem(LS.threads, JSON.stringify(threads));
  }, [threads]);
  useEffect(() => {
    localStorage.setItem(LS.library, JSON.stringify(library));
  }, [library]);

  // Keep the active id pointing at a session that still exists (e.g. after delete).
  useEffect(() => {
    if (sessions.length && !sessions.some((s) => s.id === activeId)) {
      setActiveId(sessions[0].id);
    }
  }, [sessions, activeId]);

  const turns = threads[activeId] ?? [];

  const setActiveTurns = (fn: (prev: ImgTurn[]) => ImgTurn[]) =>
    setThreads((t) => ({ ...t, [activeId]: fn(t[activeId] ?? []) }));

  const touch = (id: string) =>
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, updatedAt: Date.now() } : s)),
    );

  const addSession = () => {
    const s = newSession();
    setSessions((prev) => [s, ...prev]);
    setActiveId(s.id);
    return s;
  };
  const rename = (id: string, title: string) =>
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, title } : s)));

  // Deleting a session cascades: drop every image it produced on the backend,
  // then drop the session and its thread locally.
  const removeSession = (id: string) => {
    const ids = (threads[id] ?? []).flatMap((t) => t.images.map((im) => im.id));
    if (ids.length) deleteImages(ids).catch(() => {});
    setThreads((t) => {
      const next = { ...t };
      delete next[id];
      return next;
    });
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      return next.length ? next : [newSession()];
    });
  };

  // Count of images in a session — used for the delete-confirm copy.
  const imageCount = (id: string) =>
    (threads[id] ?? []).reduce((sum, t) => sum + t.images.length, 0);

  // Generate: append a pending turn, set the session title from the first prompt,
  // then resolve it to done/error in place.
  const generate = async (
    prompt: string,
    params: ImgParams,
    provider: string | null,
    model: string | null,
    referenceImages: string[] = [],
  ) => {
    const sid = activeId;
    const turnId = crypto.randomUUID();
    if (turns.length === 0 && prompt) {
      rename(sid, prompt.length > 24 ? prompt.slice(0, 24) + '…' : prompt);
    }
    // Reference images are inputs, not persisted in the turn (they would bloat
    // localStorage); only the generated images are kept.
    setActiveTurns((prev) => [
      ...prev,
      { id: turnId, prompt, params, provider, model, status: 'pending', images: [] },
    ]);
    touch(sid);

    const req: GenerateRequest = {
      prompt,
      size: params.size,
      n: params.n,
      provider,
      model,
      reference_images: referenceImages,
    };
    try {
      const res = await generateImage(req);
      setThreads((t) => ({
        ...t,
        [sid]: (t[sid] ?? []).map((turn) =>
          turn.id === turnId
            ? { ...turn, status: 'done', images: res.images.map((im) => ({ id: im.id })) }
            : turn,
        ),
      }));
    } catch (e) {
      setThreads((t) => ({
        ...t,
        [sid]: (t[sid] ?? []).map((turn) =>
          turn.id === turnId ? { ...turn, status: 'error', error: (e as Error).message } : turn,
        ),
      }));
    }
  };

  // Delete one image: unlink on the backend, then drop it from its turn.
  const removeImage = (turnId: string, imageId: string) => {
    deleteImage(imageId).catch(() => {});
    setActiveTurns((prev) =>
      prev.map((turn) =>
        turn.id === turnId
          ? { ...turn, images: turn.images.filter((im) => im.id !== imageId) }
          : turn,
      ),
    );
  };

  // Save to library: copy the bytes to a new independent id so deleting the turn
  // image later doesn't break the library card.
  const saveToLibrary = async (imageId: string, prompt: string, params: ImgParams) => {
    const { id } = await copyToLibrary(imageId);
    setLibrary((prev) => [
      { id: crypto.randomUUID(), prompt, params, previewId: id },
      ...prev,
    ]);
  };

  const removeLibrary = (entry: LibraryEntry) => {
    deleteImage(entry.previewId).catch(() => {});
    setLibrary((prev) => prev.filter((e) => e.id !== entry.id));
  };

  const activeTitle = sessions.find((s) => s.id === activeId)?.title;

  return {
    sessions,
    activeId,
    activeTitle,
    setActiveId,
    addSession,
    rename,
    removeSession,
    imageCount,
    turns,
    generate,
    removeImage,
    library,
    saveToLibrary,
    removeLibrary,
  };
}
