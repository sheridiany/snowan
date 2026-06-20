import { App } from 'antd';

import { type NavProps } from '../shell/ListPane';
import FeedList from '../reading/FeedList';
import ArticleList from '../reading/ArticleList';
import Reader from '../reading/Reader';
import { useReading } from '../../hooks/useReading';

export default function ReadingView({
  view,
  onView,
  onNewChat,
  listCollapsed,
}: NavProps & { listCollapsed?: boolean }) {
  const r = useReading();
  const { message } = App.useApp();

  return (
    <>
      {!listCollapsed && (
        <FeedList
          view={view}
          onView={onView}
          onNewChat={onNewChat}
          feeds={r.feeds}
          sel={r.sel}
          totalUnread={r.totalUnread}
          refreshing={r.refreshing}
          onSelectView={r.selectView}
          onSelectFeed={r.selectFeed}
          onRefresh={() => r.refresh().then((n) => message.success(`刷新完成,新增 ${n} 篇`))}
          onSubscribe={r.subscribe}
          onSaveArticle={r.saveArticleUrl}
          onRename={r.rename}
          onUnsubscribe={r.unsubscribe}
        />
      )}

      <ArticleList
        articles={r.articles}
        feeds={r.feeds}
        activeId={r.activeId}
        loading={r.listLoading}
        query={r.query}
        onQuery={r.setQuery}
        onOpen={r.open}
        onToggleStar={r.toggleStar}
      />

      <Reader
        article={r.article}
        onSetArticle={r.setArticle}
        onToggleRead={r.markRead}
        onToggleStar={r.toggleStar}
        onToggleLater={r.toggleLater}
        onOpenSource={r.open}
      />
    </>
  );
}
