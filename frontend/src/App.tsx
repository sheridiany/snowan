import { useState } from 'react';
import { createStyles } from 'antd-style';
import { streamChat } from './api/chat';
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
    background: ${token.colorBgLayout};
    color: ${token.colorText};
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
  const [view, setView] = useState<View>('chat');
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
      await streamChat(text, sid, {
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
      });
    } finally {
      setBusy(false);
    }
  };

  const handleNew = () => {
    const s = newSession();
    setSessions((prev) => [s, ...prev]);
    setActiveId(s.id);
    setView('chat');
  };

  return (
    <div className={styles.app}>
      <NavRail view={view} onView={setView} onNewChat={handleNew} />
      <main className={styles.main}>
        {view === 'chat' && (
          <>
            <ChatView messages={messages} />
            <Composer busy={busy} onSend={send} />
          </>
        )}
        {view === 'sessions' && (
          <SessionsView
            sessions={sessions}
            activeId={activeId}
            onSelect={(id) => {
              setActiveId(id);
              setView('chat');
            }}
          />
        )}
        {view === 'sources' && <SourcesView />}
        {view === 'skills' && <SkillsView />}
        {view === 'settings' && <SettingsView />}
      </main>
    </div>
  );
}
