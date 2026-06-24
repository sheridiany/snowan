import { useEffect, useMemo, useState } from 'react';
import { createStyles, useThemeMode } from 'antd-style';
import { App as AntApp } from 'antd';
import { Heart } from 'lucide-react';
import { persistThemeMode } from './theme/themes';
import TitleBar from './components/shell/TitleBar';
import RightPanel, { RIGHT_SOURCES } from './components/shell/RightPanel';
import ChatView from './components/ChatView';
import Composer from './components/Composer';
import ImgLibraryPanel from './components/draw/ImgLibraryPanel';
import DetailPane from './ui/DetailPane';
import NoteDraftModal from './components/NoteDraftModal';
import type { DraftEntry } from './api/knowledge';
import type { ImgParams } from './api/imagegen';
import { reconcileImages } from './api/imagegen';
import SessionsView from './components/views/SessionsView';
import SettingsView from './components/settings/SettingsView';
import type { Message } from './components/types';
import { textOfBlocks } from './components/types';
import { useViewHistory } from './hooks/useViewHistory';
import { useSessions } from './hooks/useSessions';
import { useChat } from './hooks/useChat';
import { useImageLibrary } from './hooks/useImageLibrary';

const useStyles = createStyles(({ token, css }) => ({
  app: css`
    position: relative;
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: ${token.colorSceneBg};
    color: ${token.colorText};
    font-feature-settings: 'cv11' 1, 'ss01' 1;
    font-variant-numeric: tabular-nums;
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
    background: transparent;
  `,
  stage: css`
    flex: 1;
    min-width: 0;
    display: flex;
  `,
}));

export default function App() {
  const { styles } = useStyles();
  const { message } = AntApp.useApp();
  const { themeMode } = useThemeMode();
  // antd-style does not persist themeMode; mirror it to localStorage so the
  // light/dark/auto choice is restored as defaultThemeMode on the next reload.
  useEffect(() => persistThemeMode(themeMode), [themeMode]);

  const nav = useViewHistory();
  const sessions = useSessions();
  // First message of a session sets its title — wire that through to the list.
  const chat = useChat(sessions.activeId, sessions.rename);
  const lib = useImageLibrary();
  // 图像生成 is a composer mode, not a separate view: when active, the right panel
  // swaps to the 收藏 library so generated images land in context.
  const [imageMode, setImageMode] = useState(false);
  const [imgBusy, setImgBusy] = useState(false);
  // The right panel's active source lives here so the top bar can render the
  // source tabs while the panel renders the matching content (one unified bar).
  const [rightSource, setRightSource] = useState('calendar');
  // Entering image mode pins the panel to 收藏 so generated images land in view.
  useEffect(() => {
    if (imageMode) setRightSource('imagelib');
  }, [imageMode]);

  // Image generation shows a pending turn immediately, then settles it once the
  // (30–60s) generation resolves.
  const handleGenerateImage = async (prompt: string, params: ImgParams, refs: string[]) => {
    setImgBusy(true);
    chat.addImageTurn(prompt);
    try {
      // generate rejects only on real generation failure; copy-to-收藏 is best-effort,
      // so a returned id list always settles the pending turn.
      const ids = await lib.generate(prompt, params, refs);
      chat.completeImageTurn(ids);
    } catch (e) {
      chat.failImageTurn();
      message.error(e instanceof Error ? e.message.replace(/^\d+\s*/, '') : '图像生成失败,请重试');
    } finally {
      setImgBusy(false);
    }
  };

  // Best-effort GC on launch: unlink backend PNGs no chat thread or library entry
  // still references (e.g. images orphaned by a crash mid-turn or a cleared cache).
  useEffect(() => {
    const threads = (() => {
      try {
        return JSON.parse(localStorage.getItem('snowan.threads') || '{}') as Record<string, Message[]>;
      } catch {
        return {} as Record<string, Message[]>;
      }
    })();
    const keep = new Set<string>();
    for (const msgs of Object.values(threads)) {
      for (const m of msgs) for (const b of m.blocks) if (b.kind === 'image') for (const id of b.ids) keep.add(id);
    }
    for (const e of lib.library) keep.add(e.previewId);
    void reconcileImages([...keep]).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  const textOf = (m: Message) => textOfBlocks(m.blocks).trim();
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

  // The contextual 收藏 panel only depends on the library; memoize it so streaming
  // chat tokens (frequent App re-renders) don't rebuild the right-panel subtree.
  const imgLibNode = useMemo(
    () => (
      <ImgLibraryPanel
        library={lib.library}
        onUsePrompt={(prompt) => {
          navigator.clipboard?.writeText(prompt);
          message.success('提示词已复制');
        }}
        onDelete={lib.removeLibrary}
      />
    ),
    [lib.library, lib.removeLibrary, message],
  );

  // 收藏 (contextual) + the built-in sources, rendered as tabs in the top bar.
  // Memoized so streaming chat re-renders don't rebuild the memoized RightPanel.
  const rightContextual = useMemo(
    () => ({ key: 'imagelib', label: '收藏', icon: Heart, node: imgLibNode }),
    [imgLibNode],
  );
  const rightSources = useMemo(
    () => [{ key: 'imagelib', label: '收藏', icon: Heart }, ...RIGHT_SOURCES],
    [],
  );

  return (
    <div className={styles.app}>
      <TitleBar
        navCollapsed={nav.listCollapsed}
        rightOpen={nav.rightOpen}
        canBack={nav.canBack}
        title={nav.view === 'settings' ? '设置' : sessions.activeTitle}
        sources={rightSources}
        activeSource={rightSource}
        onSelectSource={setRightSource}
        onNewChat={handleNew}
        onToggleNav={nav.toggleNav}
        onToggleRight={nav.toggleRight}
        onBack={nav.back}
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
              <DetailPane>
                <ChatView
                  messages={chat.messages}
                  busy={chat.busy}
                  onApprovalDecision={chat.approve}
                  onSaveNote={handleSaveNote}
                  onPickPrompt={(t) => chat.send(t)}
                />
                <Composer
                  busy={chat.busy}
                  imgBusy={imgBusy}
                  onSend={chat.send}
                  onStop={chat.stop}
                  onSteer={chat.steer}
                  onGenerateImage={handleGenerateImage}
                  onModeChange={(skill) => setImageMode(skill === 'image')}
                />
              </DetailPane>
            </>
          )}
          {nav.view === 'settings' && (
            <SettingsView
              view={nav.view}
              onView={nav.go}
              onNewChat={handleNew}
              listCollapsed={nav.listCollapsed}
            />
          )}
          {nav.rightOpen && (
            <RightPanel
              refreshKey={notesVersion}
              onOpenSettings={() => nav.go('settings')}
              source={rightSource}
              contextual={rightContextual}
            />
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
          setRightSource('notes'); // surface the just-saved note
          nav.openRight(); // reveal the panel so the saved note lands in view
        }}
      />
    </div>
  );
}
