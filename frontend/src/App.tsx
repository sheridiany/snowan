import { useEffect, useRef, useState } from 'react';
import { createStyles, useThemeMode } from 'antd-style';
import { persistThemeMode } from './theme/themes';
import { streamChat, approveChat, deleteSession, type ChatHandlers } from './api/chat';
import TitleBar from './components/shell/TitleBar';
import RightPanel from './components/shell/RightPanel';
import NavRail, { type View } from './components/shell/NavRail';
import ChatView from './components/ChatView';
import Composer from './components/Composer';
import SessionsView from './components/views/SessionsView';
import KnowledgeView from './components/knowledge/KnowledgeView';
import SkillsView from './components/views/SkillsView';
import SettingsView from './components/settings/SettingsView';
import type { Block, Message, Session } from './components/types';

const useStyles = createStyles(({ token, css }) => ({
  app: css`
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: ${token.colorBgLayout};
    color: ${token.colorText};
  `,
  body: css`
    flex: 1;
    min-height: 0;
    display: flex;
    background: ${token.colorBgLayout};
  `,
  stage: css`
    flex: 1;
    min-width: 0;
    display: flex;
    gap: 8px;
    padding: 8px;
  `,
  detail: css`
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    background: ${token.colorBgContainer};
    border-radius: ${token.borderRadiusLG}px;
    box-shadow: ${token.boxShadowTertiary};
    overflow: hidden;
  `,
  detailHeader: css`
    flex: none;
    height: 52px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 16px;
  `,
  detailTitle: css`
    font-size: 14px;
    font-weight: 600;
    color: ${token.colorText};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
}));

const newSession = (): Session => ({
  id: crypto.randomUUID(),
  title: '新对话',
  status: 'active',
  tags: [],
  updatedAt: Date.now(),
});

// Local persistence so the session list + transcripts survive a reload. The
// backend separately persists the agent's message history per session id.
const LS = { sessions: 'snowan.sessions', threads: 'snowan.threads', active: 'snowan.activeId' };
function readLS<T>(key: string, fallback: T): T {
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const s = localStorage.getItem(key);
    return s ? (JSON.parse(s) as T) : fallback;
  } catch {
    return fallback;
  }
}

// Append a streamed text delta to the last assistant block (or open a new one
// after a tool card, so text and tools stay in invocation order).
function appendDelta(blocks: Block[], text: string): Block[] {
  const last = blocks[blocks.length - 1];
  if (last && last.kind === 'text') {
    return [...blocks.slice(0, -1), { kind: 'text', text: last.text + text }];
  }
  return [...blocks, { kind: 'text', text }];
}

export default function App() {
  const { styles } = useStyles();
  const { themeMode } = useThemeMode();
  // antd-style does not persist themeMode; mirror it to localStorage so the
  // light/dark/auto choice is restored as defaultThemeMode on the next reload.
  useEffect(() => persistThemeMode(themeMode), [themeMode]);

  // View navigation with back/forward history.
  const [hist, setHist] = useState<View[]>(['conversations']);
  const [hi, setHi] = useState(0);
  const view = hist[hi];
  const go = (v: View) => {
    if (v === hist[hi]) return;
    setHist((h) => [...h.slice(0, hi + 1), v]);
    setHi((i) => i + 1);
  };
  const canBack = hi > 0;
  const canForward = hi < hist.length - 1;

  // The thin icon rail is always shown; ◫ collapses the list pane (column 2).
  const [listCollapsed, setListCollapsed] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);

  const [sessions, setSessions] = useState<Session[]>(() => {
    const stored = readLS<Session[]>(LS.sessions, []);
    return stored.length ? stored : [newSession()];
  });
  const [activeId, setActiveId] = useState(() => {
    const stored = readLS<string>(LS.active, '');
    return sessions.some((s) => s.id === stored) ? stored : sessions[0].id;
  });
  const [threads, setThreads] = useState<Record<string, Message[]>>(() =>
    readLS<Record<string, Message[]>>(LS.threads, {}),
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    localStorage.setItem(LS.sessions, JSON.stringify(sessions));
  }, [sessions]);
  useEffect(() => {
    localStorage.setItem(LS.threads, JSON.stringify(threads));
  }, [threads]);
  useEffect(() => {
    localStorage.setItem(LS.active, activeId);
  }, [activeId]);

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
      patchAssistant((b) => [
        ...b,
        { kind: 'tool', step: { id: call.id, name: call.name, args: call.args } },
      ]),
    onToolResult: (res) =>
      patchAssistant((b) =>
        b.map((blk) =>
          blk.kind === 'tool' && blk.step.id === res.id
            ? { kind: 'tool', step: { ...blk.step, result: res.result } }
            : blk,
        ),
      ),
    onApprovalRequired: (calls) =>
      patchAssistant((b) => [...b, { kind: 'approval', calls }]),
  };

  const abortRef = useRef<AbortController | null>(null);
  const stop = () => abortRef.current?.abort();

  const send = async (text: string) => {
    setBusy(true);

    const sid = activeId;
    if (messages.length === 0) {
      const title = text.length > 24 ? text.slice(0, 24) + '…' : text;
      setSessions((s) => s.map((x) => (x.id === sid ? { ...x, title } : x)));
    }

    setActiveMessages((prev) => [
      ...prev,
      { role: 'user', blocks: [{ kind: 'text', text }] },
      { role: 'assistant', blocks: [] },
    ]);

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      await streamChat(text, sid, streamHandlers, ctrl.signal);
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  const handleApprovalDecision = async (
    messageIndex: number,
    blockIndex: number,
    approve: boolean,
  ) => {
    const message = messages[messageIndex];
    const block = message?.blocks[blockIndex];
    if (!block || block.kind !== 'approval' || block.decided) return;

    const decisions: Record<string, boolean> = {};
    for (const call of block.calls) decisions[call.id] = approve;

    setActiveMessages((prev) => {
      const next = [...prev];
      const msg = next[messageIndex];
      if (!msg) return prev;
      const blocks = [...msg.blocks];
      const blk = blocks[blockIndex];
      if (!blk || blk.kind !== 'approval') return prev;
      blocks[blockIndex] = { ...blk, decided: true, approved: approve };
      next[messageIndex] = { ...msg, blocks };
      return next;
    });

    setBusy(true);
    try {
      await approveChat(activeId, decisions, streamHandlers);
    } finally {
      setBusy(false);
    }
  };

  const handleNew = () => {
    const s = newSession();
    setSessions((prev) => [s, ...prev]);
    setActiveId(s.id);
    go('conversations');
  };

  const handleRenameSession = (id: string, title: string) =>
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, title } : s)));

  const handleDeleteSession = (id: string) => {
    deleteSession(id).catch(() => {});
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

  // Keep the active id pointing at a session that still exists (e.g. after delete).
  useEffect(() => {
    if (sessions.length && !sessions.some((s) => s.id === activeId)) {
      setActiveId(sessions[0].id);
    }
  }, [sessions, activeId]);

  const activeTitle = sessions.find((s) => s.id === activeId)?.title;

  return (
    <div className={styles.app}>
      <TitleBar
        navCollapsed={listCollapsed}
        rightOpen={rightOpen}
        canBack={canBack}
        canForward={canForward}
        onToggleNav={() => setListCollapsed((c) => !c)}
        onToggleRight={() => setRightOpen((o) => !o)}
        onBack={() => setHi((i) => Math.max(0, i - 1))}
        onForward={() => setHi((i) => Math.min(hist.length - 1, i + 1))}
      />
      <div className={styles.body}>
        <NavRail view={view} onView={go} onNewChat={handleNew} />
        <main className={styles.stage}>
          {view === 'conversations' && (
            <>
              {!listCollapsed && (
                <SessionsView
                  sessions={sessions}
                  activeId={activeId}
                  onSelect={setActiveId}
                  onSetStatus={(id, status) =>
                    setSessions((prev) =>
                      prev.map((s) =>
                        s.id === id ? { ...s, status, updatedAt: Date.now() } : s,
                      ),
                    )
                  }
                  onRename={handleRenameSession}
                  onDelete={handleDeleteSession}
                />
              )}
              <section className={styles.detail}>
                <header className={styles.detailHeader}>
                  <span className={styles.detailTitle}>{activeTitle}</span>
                </header>
                <ChatView messages={messages} onApprovalDecision={handleApprovalDecision} />
                <Composer busy={busy} onSend={send} onStop={stop} />
              </section>
            </>
          )}
          {view === 'knowledge' && <KnowledgeView listCollapsed={listCollapsed} />}
          {view === 'skills' && <SkillsView listCollapsed={listCollapsed} />}
          {view === 'settings' && <SettingsView listCollapsed={listCollapsed} />}
          {rightOpen && <RightPanel onClose={() => setRightOpen(false)} />}
        </main>
      </div>
    </div>
  );
}
