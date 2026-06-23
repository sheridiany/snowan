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

  useEffect(() => {
    localStorage.setItem(LS_THREADS, JSON.stringify(threads));
  }, [threads]);

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
    onError: (message) =>
      patchAssistant((b) => appendDelta(b, `\n\n⚠️ ${message}`)),
  };

  const abortRef = useRef<AbortController | null>(null);
  const stop = () => abortRef.current?.abort();

  const send = async (text: string, attachments: ApiAttachment[] = [], skill?: string) => {
    setBusy(true);

    const sid = activeId;
    if (messages.length === 0 && text) {
      onTitle?.(sid, text.length > 24 ? text.slice(0, 24) + '…' : text);
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
      patchAssistant((b) => appendDelta(b, `\n\n⚠️ ${(e as Error).message}`));
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
      patchAssistant((b) => appendDelta(b, `\n\n⚠️ ${(e as Error).message}`));
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

  // An image turn is a complete client-side exchange: a user prompt bubble plus
  // an assistant message holding the generated image ids. No backend round-trip —
  // generation already happened, so this just records the result in the thread.
  const addImageTurn = (prompt: string, ids: string[]) => {
    if (messages.length === 0 && prompt) {
      onTitle?.(activeId, prompt.length > 24 ? prompt.slice(0, 24) + '…' : prompt);
    }
    setActiveMessages((prev) => [
      ...prev,
      { role: 'user', blocks: [{ kind: 'text', text: prompt }] },
      { role: 'assistant', blocks: [{ kind: 'image', ids, prompt }] },
    ]);
  };

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

  return { messages, busy, send, stop, steer, approve, addImageTurn, dropThread };
}
