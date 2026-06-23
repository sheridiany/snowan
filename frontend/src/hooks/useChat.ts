import { useEffect, useRef, useState } from 'react';
import {
  streamChat,
  approveChat,
  steerChat,
  type ChatHandlers,
  type Attachment as ApiAttachment,
} from '../api/chat';
import type { Block, Message, ToolStep } from '../components/types';
import { deleteImage } from '../api/imagegen';
import { readLS } from './useSessions';

const LS_THREADS = 'snowan.threads';

// Append a streamed text delta to the last assistant block (or open a new one
// after a tool card, so text and tools stay in invocation order).
function appendDelta(blocks: Block[], text: string): Block[] {
  const last = blocks[blocks.length - 1];
  if (last && last.kind === 'text') {
    return [...blocks.slice(0, -1), { kind: 'text', text: last.text + text }];
  }
  return [...blocks, { kind: 'text', text }];
}

// Merge a tool event into its existing row (matched by call id) or append a new
// one, so the announce / approval / execution events for one call stay a single
// row instead of stacking up. `patch` overlays only the fields it carries.
function upsertTool(blocks: Block[], id: string, patch: Partial<ToolStep>): Block[] {
  const i = blocks.findIndex((b) => b.kind === 'tool' && b.step.id === id);
  if (i === -1) {
    return [...blocks, { kind: 'tool', step: { id, name: '', args: {}, ...patch } }];
  }
  const next = [...blocks];
  const prev = next[i] as Extract<Block, { kind: 'tool' }>;
  next[i] = { kind: 'tool', step: { ...prev.step, ...patch } };
  return next;
}

// The streaming chat core for the active session: the per-session transcripts,
// the busy flag, and send/stop/approve. `onTitle` lets the host set a session's
// title from its first message without this hook owning the session list.
export function useChat(activeId: string, onTitle?: (id: string, title: string) => void) {
  const [threads, setThreads] = useState<Record<string, Message[]>>(() =>
    readLS<Record<string, Message[]>>(LS_THREADS, {}),
  );
  const [busy, setBusy] = useState(false);

  // localStorage only needs eventual consistency — in-memory `threads` is the
  // render source of truth. Debounce writes so streaming (a setState per token)
  // doesn't reserialize the whole threads map on every delta.
  const threadsRef = useRef(threads);
  threadsRef.current = threads;
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushThreads = () => {
    if (flushTimer.current) {
      clearTimeout(flushTimer.current);
      flushTimer.current = null;
    }
    localStorage.setItem(LS_THREADS, JSON.stringify(threadsRef.current));
  };
  useEffect(() => {
    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(flushThreads, 350);
    return () => {
      if (flushTimer.current) clearTimeout(flushTimer.current);
    };
  }, [threads]);
  // Quitting or backgrounding the tab must not lose the last few hundred ms.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flushThreads();
    };
    window.addEventListener('beforeunload', flushThreads);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('beforeunload', flushThreads);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, []);
  // Flush as soon as a turn finishes streaming, so a settled thread is durable
  // without waiting on the debounce.
  const prevBusy = useRef(busy);
  useEffect(() => {
    if (prevBusy.current && !busy) flushThreads();
    prevBusy.current = busy;
  }, [busy]);

  const messages = threads[activeId] ?? [];

  const setActiveMessages = (fn: (prev: Message[]) => Message[]) =>
    setThreads((t) => ({ ...t, [activeId]: fn(t[activeId] ?? []) }));

  // Update the trailing assistant message's blocks in place.
  const patchAssistant = (fn: (blocks: Block[]) => Block[]) =>
    setActiveMessages((prev) => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (!last || last.role !== 'assistant') return prev;
      next[next.length - 1] = { ...last, blocks: fn(last.blocks) };
      return next;
    });

  // Surface a failure as an inline marker on the trailing assistant turn.
  const showError = (msg: string) => patchAssistant((b) => appendDelta(b, `\n\n⚠️ ${msg}`));
  // A session's title is its first message, truncated to fit the list row.
  const titleFrom = (text: string) => (text.length > 24 ? text.slice(0, 24) + '…' : text);

  // Streamed events patch the trailing assistant message identically whether they
  // arrive from the initial turn or from an approval continuation.
  const streamHandlers: ChatHandlers = {
    onDelta: (delta) => patchAssistant((b) => appendDelta(b, delta)),
    onToolCall: (call) =>
      patchAssistant((b) => upsertTool(b, call.id, { name: call.name, args: call.args })),
    onToolResult: (res) =>
      patchAssistant((b) => upsertTool(b, res.id, { name: res.name, result: res.result })),
    onApprovalRequired: (calls) =>
      patchAssistant((b) =>
        calls.reduce(
          (acc, c) => upsertTool(acc, c.id, { name: c.name, args: c.args, approval: 'pending' }),
          b,
        ),
      ),
    onArtifact: (a) =>
      patchAssistant((b) => [...b, { kind: 'artifact', path: a.path, title: a.title }]),
    onDiagram: (d) =>
      patchAssistant((b) => [...b, { kind: 'diagram', svg: d.svg, title: d.title }]),
    onError: (message) => showError(message),
  };

  const abortRef = useRef<AbortController | null>(null);
  const stop = () => abortRef.current?.abort();

  const send = async (text: string, attachments: ApiAttachment[] = [], skill?: string) => {
    setBusy(true);

    const sid = activeId;
    if (messages.length === 0 && text) {
      onTitle?.(sid, titleFrom(text));
    }

    setActiveMessages((prev) => [
      ...prev,
      {
        role: 'user',
        blocks: [{ kind: 'text', text }],
        attachments: attachments.map((a) => ({ name: a.name, mime: a.mime })),
      },
      { role: 'assistant', blocks: [] },
    ]);

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      await streamChat(text, sid, attachments, streamHandlers, ctrl.signal, skill);
    } catch (e) {
      showError((e as Error).message);
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  // A paused turn answers all its pending tool calls in one resume, so the
  // decision applies to every pending row in that message at once.
  const approve = async (messageIndex: number, decision: boolean) => {
    const message = messages[messageIndex];
    const pendingIds = (message?.blocks ?? [])
      .filter((b): b is Extract<Block, { kind: 'tool' }> => b.kind === 'tool' && b.step.approval === 'pending')
      .map((b) => b.step.id);
    if (pendingIds.length === 0) return;

    const decisions: Record<string, boolean> = {};
    for (const id of pendingIds) decisions[id] = decision;

    setActiveMessages((prev) => {
      const next = [...prev];
      const msg = next[messageIndex];
      if (!msg) return prev;
      next[messageIndex] = {
        ...msg,
        blocks: msg.blocks.map((b) =>
          b.kind === 'tool' && b.step.approval === 'pending'
            ? { kind: 'tool', step: { ...b.step, approval: decision ? 'approved' : 'denied' } }
            : b,
        ),
      };
      return next;
    });

    setBusy(true);
    try {
      await approveChat(activeId, decisions, streamHandlers);
    } catch (e) {
      showError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Mid-run steering: inject a follow-up instruction into the live turn without
  // interrupting it. Shown as a user bubble inserted *before* the still-streaming
  // assistant message, so the assistant stays trailing and deltas keep patching it.
  const steer = async (text: string) => {
    const t = text.trim();
    if (!busy || !t) return;
    setActiveMessages((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      next.splice(next.length - 1, 0, { role: 'user', blocks: [{ kind: 'text', text: t }] });
      return next;
    });
    await steerChat(activeId, t);
  };

  // An image turn shows immediately as a user prompt bubble plus an assistant
  // message holding a *pending* image block, so the thread isn't empty during the
  // 30–60s generation. completeImageTurn / failImageTurn settle the trailing block
  // once generation resolves.
  const addImageTurn = (prompt: string) => {
    if (messages.length === 0 && prompt) {
      onTitle?.(activeId, titleFrom(prompt));
    }
    setActiveMessages((prev) => [
      ...prev,
      { role: 'user', blocks: [{ kind: 'text', text: prompt }] },
      { role: 'assistant', blocks: [{ kind: 'image', ids: [], prompt, pending: true }] },
    ]);
  };

  // Patch the trailing pending image block with its generated ids.
  const completeImageTurn = (ids: string[]) =>
    patchAssistant((b) =>
      b.map((bl) => (bl.kind === 'image' && bl.pending ? { ...bl, ids, pending: false } : bl)),
    );

  // Replace the trailing pending image block with an inline error.
  const failImageTurn = () =>
    patchAssistant((b) =>
      b.map((bl) =>
        bl.kind === 'image' && bl.pending
          ? ({ kind: 'text', text: '⚠️ 图像生成失败,请重试' } as Block)
          : bl,
      ),
    );

  // Dropping a thread cascades to its generated images so PNGs don't orphan on
  // the backend: collect every image block's ids and delete them best-effort.
  const dropThread = (id: string) =>
    setThreads((t) => {
      const imageIds = (t[id] ?? []).flatMap((m) =>
        m.blocks.flatMap((b) => (b.kind === 'image' ? b.ids : [])),
      );
      for (const imgId of imageIds) void deleteImage(imgId).catch(() => {});
      const next = { ...t };
      delete next[id];
      return next;
    });

  return {
    messages,
    busy,
    send,
    stop,
    steer,
    approve,
    addImageTurn,
    completeImageTurn,
    failImageTurn,
    dropThread,
  };
}
