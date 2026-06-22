import { useCallback, useEffect, useState } from 'react';
import {
  addFeed,
  addRecommended,
  deleteFeed,
  getArticle,
  importOpml,
  listArticles,
  listFeeds,
  refreshAll,
  refreshFeed,
  renameFeed,
  saveUrl,
  updateArticle,
  type ArticleListItem,
  type ArticleOut,
  type ArticleView,
  type FeedOut,
} from '../api/reading';

// View-local state for the reading pane: which smart-view/feed is selected, the
// article list under that selection, and the opened article (full bodies). No
// localStorage — article state is server-backed; this hook just mirrors the
// existing fetch + useState patterns and keeps the three columns in sync.
export type Selection = { view: ArticleView; feedId: number | null };

export function useReading() {
  const [feeds, setFeeds] = useState<FeedOut[]>([]);
  const [sel, setSel] = useState<Selection>({ view: 'all', feedId: null });
  const [query, setQuery] = useState('');
  const [articles, setArticles] = useState<ArticleListItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [article, setArticle] = useState<ArticleOut | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadFeeds = useCallback(() => {
    listFeeds().then(setFeeds).catch(() => setFeeds([]));
  }, []);

  const loadArticles = useCallback(() => {
    setListLoading(true);
    listArticles({ view: sel.view, feed_id: sel.feedId, q: query.trim() || undefined })
      .then(setArticles)
      .catch(() => setArticles([]))
      .finally(() => setListLoading(false));
  }, [sel.view, sel.feedId, query]);

  // On mount: refresh-on-view-open (manual elsewhere), then load.
  useEffect(() => {
    loadFeeds();
    refreshAll()
      .catch(() => {})
      .finally(loadFeeds);
  }, [loadFeeds]);

  useEffect(loadArticles, [loadArticles]);

  const open = useCallback((id: string) => {
    setActiveId(id);
    getArticle(id)
      .then((a) => {
        setArticle(a);
        if (!a.is_read) markRead(id, true);
      })
      .catch(() => setArticle(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Patch a flag on an article: update server, then patch local list + opened row.
  const patchFlag = useCallback(
    (id: string, body: { is_read?: boolean; is_starred?: boolean; read_later?: boolean }) =>
      updateArticle(id, body).then((updated) => {
        setArticles((prev) => prev.map((a) => (a.id === id ? { ...a, ...body } : a)));
        setArticle((prev) => (prev && prev.id === id ? { ...prev, ...updated } : prev));
        loadFeeds(); // unread counts shift on read/unread
        return updated;
      }),
    [loadFeeds],
  );

  const markRead = (id: string, value: boolean) => patchFlag(id, { is_read: value });
  const toggleStar = (id: string, value: boolean) => patchFlag(id, { is_starred: value });
  const toggleLater = (id: string, value: boolean) => patchFlag(id, { read_later: value });

  const selectView = (view: ArticleView) => setSel({ view, feedId: null });
  const selectFeed = (feedId: number) => setSel({ view: 'all', feedId });

  const refresh = (feedId?: number) => {
    setRefreshing(true);
    const p = feedId != null ? refreshFeed(feedId) : refreshAll();
    return p
      .then((r) => {
        loadFeeds();
        loadArticles();
        return r.new;
      })
      .finally(() => setRefreshing(false));
  };

  // Add accepts a feed URL or an article URL — the caller picks which endpoint.
  const subscribe = (url: string) =>
    addFeed(url).then((f) => {
      loadFeeds();
      loadArticles();
      return f;
    });

  // Bulk-add (curated set or imported OPML): feeds show at once, then a refresh
  // ingests their articles with the usual spinner.
  const importFeeds = (opml: string) =>
    importOpml(opml).then((r) => {
      loadFeeds();
      refresh();
      return r;
    });

  const addRecommendedFeeds = () =>
    addRecommended().then((r) => {
      loadFeeds();
      refresh();
      return r;
    });

  const saveArticleUrl = (url: string) =>
    saveUrl(url).then((a) => {
      loadArticles();
      return a;
    });

  const rename = (id: number, title: string) =>
    renameFeed(id, title).then(loadFeeds);

  const unsubscribe = (id: number) =>
    deleteFeed(id).then(() => {
      if (sel.feedId === id) setSel({ view: 'all', feedId: null });
      loadFeeds();
      loadArticles();
    });

  // Total unread across feeds = the count for the 全部/未读 smart views.
  const totalUnread = feeds.reduce((n, f) => n + f.unread_count, 0);

  return {
    feeds,
    sel,
    query,
    setQuery,
    articles,
    activeId,
    article,
    setArticle,
    listLoading,
    refreshing,
    totalUnread,
    selectView,
    selectFeed,
    open,
    markRead,
    toggleStar,
    toggleLater,
    refresh,
    subscribe,
    importFeeds,
    addRecommendedFeeds,
    saveArticleUrl,
    rename,
    unsubscribe,
    reloadArticles: loadArticles,
  };
}
