import { BookOpenText } from 'lucide-react';
import { type NavProps } from '../shell/ListPane';
import BookShelf from '../books/BookShelf';
import BookWorkspace from '../books/BookWorkspace';
import BookCompanion, { type CompanionMessage } from '../books/BookCompanion';
import SyntopicalView from '../books/SyntopicalView';
import RightPanel from '../shell/RightPanel';
import { useBooks } from '../../hooks/useBooks';

export default function ReadingView({
  view,
  onView,
  onNewChat,
  listCollapsed,
}: NavProps & { listCollapsed?: boolean }) {
  const b = useBooks();

  // useBooks' chat uses role 'ai'; BookCompanion wants 'assistant'. Sources
  // ({chapter,snippet}) already match CompanionSource, so just remap the role.
  const messages: CompanionMessage[] = b.chat.map((m) =>
    m.role === 'user'
      ? { role: 'user', text: m.text }
      : { role: 'assistant', text: m.text, sources: m.sources },
  );

  return (
    <>
      {!listCollapsed && (
        <BookShelf
          view={view}
          onView={onView}
          onNewChat={onNewChat}
          books={b.books}
          activeId={b.activeId}
          loading={b.listLoading}
          uploading={b.uploading}
          coverBusy={b.coverBusy}
          syntopicalMode={b.syntopicalMode}
          onToggleSyntopical={b.toggleSyntopical}
          onSelect={b.select}
          onUpload={b.upload}
          onGenCover={b.genCover}
          onDelete={b.remove}
        />
      )}

      {b.syntopicalMode ? (
        <SyntopicalView
          books={b.books}
          selected={b.syntSelected}
          onToggleBook={b.toggleSyntBook}
          busy={b.syntBusy}
          result={b.syntResult}
          onAsk={b.runSyntopical}
        />
      ) : (
        <>
          <BookWorkspace
            book={b.book}
            overview={b.overview}
            skeleton={b.skeleton}
            busy={{ overview: b.overviewBusy, skeleton: b.skeletonBusy }}
            onOverview={b.runOverview}
            onSkeleton={b.runSkeleton}
            artifacts={b.artifacts}
            artifactBusy={b.artifactBusy}
            onGenArtifact={b.genArtifact}
          />

          <RightPanel
            onOpenSettings={() => onView('settings')}
            contextual={{
              key: 'companion',
              label: '伴读',
              icon: BookOpenText,
              node: (
                <BookCompanion
                  embedded
                  messages={messages}
                  busy={b.asking}
                  onAsk={b.ask}
                  mode={b.mode}
                  onSetMode={b.setMode}
                  onSaveInsight={b.saveInsight}
                />
              ),
            }}
          />
        </>
      )}
    </>
  );
}
