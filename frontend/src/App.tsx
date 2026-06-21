import { useEffect, useState } from 'react';
import { createStyles, useThemeMode } from 'antd-style';
import { persistThemeMode } from './theme/themes';
import TitleBar from './components/shell/TitleBar';
import RightPanel from './components/shell/RightPanel';
import ChatView from './components/ChatView';
import Composer from './components/Composer';
import DetailPane from './ui/DetailPane';
import NoteDraftModal from './components/NoteDraftModal';
import type { DraftEntry } from './api/knowledge';
import SessionsView from './components/views/SessionsView';
import DrawView from './components/views/DrawView';
import ReadingView from './components/views/ReadingView';
import SettingsView from './components/settings/SettingsView';
import type { Block, Message } from './components/types';
import { useViewHistory } from './hooks/useViewHistory';
import { useSessions } from './hooks/useSessions';
import { useChat } from './hooks/useChat';

// A tiled fractal-noise texture (inline SVG data URI) overlaid app-wide for a
// matte / frosted grain. Theme-agnostic: the blend mode flips per appearance so
// the grain darkens on light themes and lightens on dark ones.
const NOISE_URL =
  "url(\"data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='140'%20height='140'%3E%3Cfilter%20id='n'%3E%3CfeTurbulence%20type='fractalNoise'%20baseFrequency='1.3'%20numOctaves='2'%20stitchTiles='stitch'/%3E%3CfeColorMatrix%20type='saturate'%20values='0'/%3E%3C/filter%3E%3Crect%20width='100%25'%20height='100%25'%20filter='url(%23n)'/%3E%3C/svg%3E\")";

const useStyles = createStyles(({ token, css, isDarkMode }) => ({
  app: css`
    position: relative;
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: ${token.colorBgLayout};
    color: ${token.colorText};
    font-feature-settings: 'cv11' 1, 'ss01' 1;
    font-variant-numeric: tabular-nums;
    &::after {
      content: '';
      position: fixed;
      inset: 0;
      z-index: 1;
      pointer-events: none;
      background-image: ${NOISE_URL};
      background-size: 140px 140px;
      opacity: ${isDarkMode ? 0.1 : 0.065};
      mix-blend-mode: ${isDarkMode ? 'screen' : 'multiply'};
    }
    @media (prefers-reduced-motion: reduce) {
      *,
      *::before,
      *::after {
        animation-duration: 0.001ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.001ms !important;
      }
    }
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
}));

export default function App() {
  const { styles } = useStyles();
  const { themeMode } = useThemeMode();
  // antd-style does not persist themeMode; mirror it to localStorage so the
  // light/dark/auto choice is restored as defaultThemeMode on the next reload.
  useEffect(() => persistThemeMode(themeMode), [themeMode]);

  const nav = useViewHistory();
  const sessions = useSessions();
  // First message of a session sets its title — wire that through to the list.
  const chat = useChat(sessions.activeId, sessions.rename);

  const handleNew = () => {
    sessions.addSession();
    nav.go('conversations');
  };
  // Deleting a session drops both its list entry and its transcript.
  const handleDelete = (id: string) => {
    chat.dropThread(id);
    sessions.remove(id);
  };

  // 存为笔记: distill the answer (+ its question) into a note draft to review.
  const [noteDraft, setNoteDraft] = useState<{ open: boolean; entries: DraftEntry[]; topic: string }>({
    open: false,
    entries: [],
    topic: '',
  });
  // Bumped when a note is saved, so the right panel re-fetches and shows it.
  const [notesVersion, setNotesVersion] = useState(0);
  const textOf = (m: Message) =>
    m.blocks
      .filter((b): b is Extract<Block, { kind: 'text' }> => b.kind === 'text')
      .map((b) => b.text)
      .join('')
      .trim();
  const handleSaveNote = (messageIndex: number) => {
    const { messages } = chat;
    const prevUser = messages.slice(0, messageIndex).reverse().find((m) => m.role === 'user');
    const entries: DraftEntry[] = [];
    if (prevUser && textOf(prevUser)) entries.push({ role: 'user', text: textOf(prevUser) });
    const answer = textOf(messages[messageIndex]);
    if (answer) entries.push({ role: 'assistant', text: answer });
    if (!entries.length) return;
    setNoteDraft({ open: true, entries, topic: prevUser ? textOf(prevUser).slice(0, 40) : '' });
  };

  return (
    <div className={styles.app}>
      <TitleBar
        navCollapsed={nav.listCollapsed}
        rightOpen={nav.rightOpen}
        canBack={nav.canBack}
        canForward={nav.canForward}
        onToggleNav={nav.toggleNav}
        onToggleRight={nav.toggleRight}
        onBack={nav.back}
        onForward={nav.forward}
      />
      <div className={styles.body}>
        <main className={styles.stage}>
          {nav.view === 'conversations' && (
            <>
              {!nav.listCollapsed && (
                <SessionsView
                  view={nav.view}
                  onView={nav.go}
                  onNewChat={handleNew}
                  sessions={sessions.sessions}
                  activeId={sessions.activeId}
                  onSelect={sessions.setActiveId}
                  onSetStatus={sessions.setStatus}
                  onRename={sessions.rename}
                  onDelete={handleDelete}
                />
              )}
              <DetailPane title={sessions.activeTitle} leadingOrb glow>
                <ChatView
                  messages={chat.messages}
                  busy={chat.busy}
                  onApprovalDecision={chat.approve}
                  onSaveNote={handleSaveNote}
                  onPickPrompt={(t) => chat.send(t)}
                />
                <Composer busy={chat.busy} onSend={chat.send} onStop={chat.stop} onSteer={chat.steer} />
              </DetailPane>
            </>
          )}
          {nav.view === 'draw' && (
            <DrawView
              view={nav.view}
              onView={nav.go}
              onNewChat={handleNew}
              listCollapsed={nav.listCollapsed}
            />
          )}
          {nav.view === 'reading' && (
            <ReadingView
              view={nav.view}
              onView={nav.go}
              onNewChat={handleNew}
              listCollapsed={nav.listCollapsed}
            />
          )}
          {nav.view === 'settings' && (
            <SettingsView
              view={nav.view}
              onView={nav.go}
              onNewChat={handleNew}
              listCollapsed={nav.listCollapsed}
            />
          )}
          {nav.rightOpen &&
            nav.view !== 'draw' &&
            nav.view !== 'reading' && (
              <RightPanel refreshKey={notesVersion} onOpenSettings={() => nav.go('settings')} />
            )}
        </main>
      </div>
      <NoteDraftModal
        open={noteDraft.open}
        entries={noteDraft.entries}
        sessionId={sessions.activeId}
        topic={noteDraft.topic}
        onClose={() => setNoteDraft((s) => ({ ...s, open: false }))}
        onSaved={() => {
          setNotesVersion((v) => v + 1);
          nav.openRight(); // reveal the panel so the saved note lands in view
        }}
      />
    </div>
  );
}
