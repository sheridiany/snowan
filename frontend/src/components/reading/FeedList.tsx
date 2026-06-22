import { App, Dropdown, Input } from 'antd';
import { ActionIcon } from '@lobehub/ui';
import { createStyles } from 'antd-style';
import {
  BookOpen,
  Circle,
  MoreHorizontal,
  Pencil,
  Rss,
  Star,
  Clock,
  RotateCw,
  Trash2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';

import { ListPane, ListRow, type NavProps } from '../shell/ListPane';
import AddFeed from './AddFeed';
import type { ArticleView, FeedOut } from '../../api/reading';
import type { Selection } from '../../hooks/useReading';

const SMART: { view: ArticleView; label: string; icon: LucideIcon }[] = [
  { view: 'all', label: '全部', icon: BookOpen },
  { view: 'unread', label: '未读', icon: Circle },
  { view: 'starred', label: '星标', icon: Star },
  { view: 'later', label: '稍后读', icon: Clock },
];

const useStyles = createStyles(({ token, css }) => ({
  group: css`
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.03em;
    color: ${token.colorTextTertiary};
    padding: 10px 10px 4px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  `,
  feedRow: css`
    position: relative;
    &:hover .feed-more {
      opacity: 1;
    }
  `,
  more: css`
    flex: none;
    width: 22px;
    height: 18px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: ${token.borderRadiusSM}px;
    color: ${token.colorTextTertiary};
    opacity: 0;
    transition: opacity 0.12s ease, background 0.12s ease;
    &:hover {
      background: ${token.colorFill};
      color: ${token.colorText};
    }
  `,
}));

export default function FeedList({
  view,
  onView,
  onNewChat,
  feeds,
  sel,
  totalUnread,
  refreshing,
  onSelectView,
  onSelectFeed,
  onRefresh,
  onSubscribe,
  onSaveArticle,
  onImportOpml,
  onAddRecommended,
  onRename,
  onUnsubscribe,
}: NavProps & {
  feeds: FeedOut[];
  sel: Selection;
  totalUnread: number;
  refreshing: boolean;
  onSelectView: (v: ArticleView) => void;
  onSelectFeed: (id: number) => void;
  onRefresh: () => void;
  onSubscribe: (url: string) => Promise<unknown>;
  onSaveArticle: (url: string) => Promise<unknown>;
  onImportOpml: (opml: string) => Promise<{ added: number; total: number }>;
  onAddRecommended: () => Promise<{ added: number; total: number }>;
  onRename: (id: number, title: string) => void;
  onUnsubscribe: (id: number) => void;
}) {
  const { styles, cx } = useStyles();
  const { modal } = App.useApp();
  const [editId, setEditId] = useState<number | null>(null);
  const [editVal, setEditVal] = useState('');

  const startRename = (f: FeedOut) => {
    setEditId(f.id);
    setEditVal(f.title || '');
  };
  const saveRename = (f: FeedOut) => {
    setEditId(null);
    const t = editVal.trim();
    if (t && t !== f.title) onRename(f.id, t);
  };
  const confirmDelete = (f: FeedOut) =>
    modal.confirm({
      title: '取消订阅?',
      content: `“${f.title || f.feed_url}” 及其文章将被移除。`,
      okText: '取消订阅',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => onUnsubscribe(f.id),
    });

  const smartCount = (v: ArticleView) => (v === 'all' || v === 'unread' ? totalUnread : undefined);

  return (
    <ListPane view={view} onView={onView} onNewChat={onNewChat}>
      <AddFeed
        onSubscribe={onSubscribe}
        onSaveArticle={onSaveArticle}
        onImportOpml={onImportOpml}
        onAddRecommended={onAddRecommended}
      />

      {SMART.map((s) => {
        const c = smartCount(s.view);
        return (
          <ListRow
            key={s.view}
            icon={s.icon}
            label={s.label}
            active={sel.feedId == null && sel.view === s.view}
            right={c ? c : undefined}
            onClick={() => onSelectView(s.view)}
          />
        );
      })}

      <div className={styles.group}>
        <span>订阅源</span>
        <ActionIcon icon={RotateCw} size="small" title="刷新" spin={refreshing} onClick={onRefresh} />
      </div>

      {feeds.map((f) => {
        const active = sel.feedId === f.id;
        return (
          <div key={f.id} className={styles.feedRow}>
            {editId === f.id ? (
              <Input
                size="small"
                autoFocus
                value={editVal}
                style={{ margin: '4px 6px' }}
                onChange={(e) => setEditVal(e.target.value)}
                onPressEnter={() => saveRename(f)}
                onBlur={() => saveRename(f)}
              />
            ) : (
              <ListRow
                icon={Rss}
                label={f.title || f.feed_url}
                sub={f.fetch_error ? '抓取失败' : undefined}
                active={active}
                onClick={() => onSelectFeed(f.id)}
                right={
                  <Dropdown
                    trigger={['click']}
                    menu={{
                      items: [
                        { key: 'rename', icon: <Pencil size={14} />, label: '重命名' },
                        { key: 'delete', icon: <Trash2 size={14} />, label: '取消订阅', danger: true },
                      ],
                      onClick: ({ key, domEvent }) => {
                        domEvent.stopPropagation();
                        if (key === 'rename') startRename(f);
                        if (key === 'delete') confirmDelete(f);
                      },
                    }}
                  >
                    <span
                      className={cx(styles.more, 'feed-more')}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {f.unread_count > 0 && editId == null ? (
                        <span style={{ fontSize: 11 }}>{f.unread_count}</span>
                      ) : (
                        <MoreHorizontal size={15} />
                      )}
                    </span>
                  </Dropdown>
                }
              />
            )}
          </div>
        );
      })}
    </ListPane>
  );
}
