import { useEffect, useState } from 'react';
import { createStyles, useThemeMode } from 'antd-style';
import { persistThemeMode } from './theme/themes';
import { streamChat, approveChat, type ChatHandlers } from './api/chat';
import TitleBar from './components/shell/TitleBar';
import RightPanel from './components/shell/RightPanel';
import NavRail, { type View } from './components/shell/NavRail';
import ChatView from './components/ChatView';
import Composer from './components/Composer';
import SessionsView from './components/views/SessionsView';
import SourcesView from './components/views/SourcesView';
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
  `,
  main: css`
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  `,
}));

const newSession = (): Session => ({ id: crypto.randomUUID(), title: '新对话' });

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
  const [hist, setHist] = useState<View[]>(['chat']);
  const [hi, setHi] = useState(0);
  const view = hist[hi];
  const go = (v: View) => {
    if (v === hist[hi]) return;
    setHist((h) => [...h.slice(0, hi + 1), v]);
    setHi((i) => i + 1);
  };
  const canBack = hi > 0;
  const canForward = hi < hist.length - 1;

  const [navCollapsed, setNavCollapsed] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);

  const [sessions, setSessions] = useState<Session[]>(() => [newSession()]);
  const [activeId, setActiveId] = useState(() => sessions[0].id);
  const [threads, setThreads] = useState<Record<string, Message[]>>({});
  const [busy, setBusy] = useState(false);

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

    try {
      await streamChat(text, sid, streamHandlers);
    } finally {
      setBusy(false);
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
    go('chat');
  };

  const activeTitle = sessions.find((s) => s.id === activeId)?.title;

  return (
    <div className={styles.app}>
      <TitleBar
        navCollapsed={navCollapsed}
        rightOpen={rightOpen}
        canBack={canBack}
        canForward={canForward}
        title={view === 'chat' ? activeTitle : undefined}
        onToggleNav={() => setNavCollapsed((c) => !c)}
        onToggleRight={() => setRightOpen((o) => !o)}
        onBack={() => setHi((i) => Math.max(0, i - 1))}
        onForward={() => setHi((i) => Math.min(hist.length - 1, i + 1))}
      />
      <div className={styles.body}>
        {!navCollapsed && <NavRail view={view} onView={go} onNewChat={handleNew} />}
        <main className={styles.main}>
          {view === 'chat' && (
            <>
              <ChatView messages={messages} onApprovalDecision={handleApprovalDecision} />
              <Composer busy={busy} onSend={send} />
            </>
          )}
          {view === 'sessions' && (
            <SessionsView
              sessions={sessions}
              activeId={activeId}
              onSelect={(id) => {
                setActiveId(id);
                go('chat');
              }}
            />
          )}
          {view === 'sources' && <SourcesView />}
          {view === 'skills' && <SkillsView />}
          {view === 'settings' && <SettingsView />}
        </main>
        {rightOpen && <RightPanel onClose={() => setRightOpen(false)} />}
      </div>
    </div>
  );
}
