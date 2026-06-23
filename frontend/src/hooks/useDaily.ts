import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ConflictError,
  getAssembly,
  getCarryover,
  getDaily,
  listDailyDates,
  saveDaily,
  type Assembly,
  type CarryoverItem,
} from '../api/daily';
import { todaysChats } from '../components/daily/localCaptures';
import type { ChatCapture } from '../components/daily/localCaptures';

const AUTOSAVE_MS = 1500;

type SaveState = 'idle' | 'saving' | 'saved' | 'conflict' | 'error';

// Owns one day's note buffer + its live assembly. The body is the only persisted
// state; the assembly band is queried live and never written back. Autosave is
// debounced (idle) and also flushed on blur; a stale base_updated_at surfaces as a
// conflict the caller resolves (reload vs. overwrite).
export function useDaily(date: string) {
  const [body, setBody] = useState('');
  const [baseUpdatedAt, setBaseUpdatedAt] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [savedAt, setSavedAt] = useState<string>('');

  const [assembly, setAssembly] = useState<Assembly | null>(null);
  const [carryover, setCarryover] = useState<CarryoverItem[]>([]);
  const [dates, setDates] = useState<Set<string>>(new Set());
  const [chats, setChats] = useState<ChatCapture[]>([]);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);
  // Latest body, so a debounced flush saves what's on screen, not a stale closure.
  const bodyRef = useRef(body);
  bodyRef.current = body;

  // Load the note + all read-only context whenever the date changes.
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setSaveState('idle');
    dirty.current = false;
    getDaily(date)
      .then((note) => {
        if (!alive) return;
        setBody(note.body);
        setBaseUpdatedAt(note.updated_at);
      })
      .catch(() => {
        if (alive) {
          setBody('');
          setBaseUpdatedAt(undefined);
        }
      })
      .finally(() => alive && setLoading(false));

    getAssembly(date).then((a) => alive && setAssembly(a)).catch(() => alive && setAssembly(null));
    getCarryover(date).then((c) => alive && setCarryover(c)).catch(() => alive && setCarryover([]));
    listDailyDates().then((d) => alive && setDates(new Set(d))).catch(() => {});
    setChats(todaysChats(date));

    return () => {
      alive = false;
    };
  }, [date]);

  const flush = useCallback(async () => {
    if (!dirty.current) return;
    setSaveState('saving');
    try {
      const note = await saveDaily(date, bodyRef.current, baseUpdatedAt);
      dirty.current = false;
      setBaseUpdatedAt(note.updated_at);
      setSaveState('saved');
      setSavedAt(
        new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      );
      setDates((prev) => new Set(prev).add(date));
    } catch (e) {
      setSaveState(e instanceof ConflictError ? 'conflict' : 'error');
    }
  }, [date, baseUpdatedAt]);

  // Edit handler: optimistic local update + debounced autosave. `defer` reflects
  // the keystroke into the buffer but does NOT (re)arm autosave — used while an IME
  // composition is in flight so we never transform/save a half-composed CJK string.
  const edit = (next: string, defer = false) => {
    setBody(next);
    dirty.current = true;
    setSaveState('idle');
    if (timer.current) clearTimeout(timer.current);
    if (!defer) timer.current = setTimeout(flush, AUTOSAVE_MS);
  };

  const blur = () => {
    if (timer.current) clearTimeout(timer.current);
    flush();
  };

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  // Conflict resolution. Reload: discard the local buffer for the disk version.
  // Overwrite: re-fetch the latest stamp, then force-save the local buffer over it.
  const reloadFromDisk = async () => {
    const note = await getDaily(date);
    setBody(note.body);
    setBaseUpdatedAt(note.updated_at);
    dirty.current = false;
    setSaveState('idle');
  };
  const overwriteDisk = async () => {
    const note = await getDaily(date);
    const saved = await saveDaily(date, bodyRef.current, note.updated_at);
    setBaseUpdatedAt(saved.updated_at);
    dirty.current = false;
    setSaveState('saved');
    setSavedAt(new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }));
  };

  return {
    body,
    edit,
    blur,
    loading,
    saveState,
    savedAt,
    assembly,
    carryover,
    dates,
    chats,
    reloadFromDisk,
    overwriteDisk,
  };
}
