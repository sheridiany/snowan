import { Empty } from '@lobehub/ui';
import { Input } from 'antd';
import { createStyles } from 'antd-style';
import { Inbox, Search, Star } from 'lucide-react';

import type { ArticleListItem, FeedOut } from '../../api/reading';

// Relative time in Chinese from an ISO date (published_at ?? fetched_at).
function relTime(iso: string | null): string {
  if (!iso) return '';
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return '';
  const diff = Math.max(0, Date.now() - ts);
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min}分钟`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}小时`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}天`;
  const mon = Math.floor(day / 30);
  if (mon < 12) return `${mon}个月`;
  return `${Math.floor(mon / 12)}年`;
}

const useStyles = createStyles(({ token, css }) => ({
  col: css`
    flex: none;
    width: 340px;
    display: flex;
    flex-direction: column;
    background: ${token.colorBgContainer};
    border-radius: ${token.borderRadiusLG}px;
    box-shadow: ${token.boxShadowTertiary};
    overflow: hidden;
  `,
  searchBar: css`
    flex: none;
    padding: 10px 12px;
    border-bottom: 1px solid ${token.colorFillQuaternary};
  `,
  scroll: css`
    flex: 1;
    overflow-y: auto;
    padding: 6px;
  `,
  row: css`
    position: relative;
    display: flex;
    gap: 8px;
    padding: 10px 10px;
    border-radius: ${token.borderRadius}px;
    cursor: pointer;
    transition: background 0.12s ease;
    &:hover {
      background: ${token.colorFillTertiary};
    }
  `,
  active: css`
    background: ${token.colorFillSecondary};
    &:hover {
      background: ${token.colorFillSecondary};
    }
  `,
  dot: css`
    flex: none;
    width: 7px;
    height: 7px;
    margin-top: 6px;
    border-radius: 50%;
    background: ${token.colorPrimary};
  `,
  dotRead: css`
    background: transparent;
  `,
  body: css`
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  `,
  title: css`
    font-size: 13px;
    font-weight: 500;
    line-height: 1.4;
    color: ${token.colorText};
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  `,
  titleRead: css`
    color: ${token.colorTextSecondary};
    font-weight: 400;
  `,
  meta: css`
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: ${token.colorTextTertiary};
  `,
  feed: css`
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  star: css`
    flex: none;
    display: inline-flex;
    align-items: center;
    color: ${token.colorTextQuaternary};
    cursor: pointer;
    &:hover {
      color: ${token.colorWarning};
    }
  `,
  starOn: css`
    color: ${token.colorWarning};
  `,
}));

export default function ArticleList({
  articles,
  feeds,
  activeId,
  loading,
  query,
  onQuery,
  onOpen,
  onToggleStar,
}: {
  articles: ArticleListItem[];
  feeds: FeedOut[];
  activeId: string | null;
  loading: boolean;
  query: string;
  onQuery: (q: string) => void;
  onOpen: (id: string) => void;
  onToggleStar: (id: string, value: boolean) => void;
}) {
  const { styles, cx } = useStyles();
  const feedTitle = (feedId: number | null): string => {
    if (feedId == null) return '已保存';
    const f = feeds.find((x) => x.id === feedId);
    return f?.title || f?.feed_url || '订阅源';
  };

  return (
    <div className={styles.col}>
      <div className={styles.searchBar}>
        <Input
          allowClear
          prefix={<Search size={14} />}
          placeholder="搜索文章"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
        />
      </div>
      <div className={styles.scroll}>
        {articles.length === 0 ? (
          <Empty
            icon={Inbox}
            title={loading ? '加载中…' : '没有文章'}
            description="订阅一个源或粘贴文章链接,文章会出现在这里。"
            paddingBlock={40}
          />
        ) : (
          articles.map((a) => (
            <div
              key={a.id}
              className={cx(styles.row, a.id === activeId && styles.active)}
              onClick={() => onOpen(a.id)}
            >
              <span className={cx(styles.dot, a.is_read && styles.dotRead)} />
              <div className={styles.body}>
                <span className={cx(styles.title, a.is_read && styles.titleRead)}>
                  {a.title || '无标题'}
                </span>
                <div className={styles.meta}>
                  <span className={styles.feed}>{feedTitle(a.feed_id)}</span>
                  <span>·</span>
                  <span>{relTime(a.published_at ?? a.fetched_at)}</span>
                  <span style={{ flex: 1 }} />
                  <span
                    className={cx(styles.star, a.is_starred && styles.starOn)}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleStar(a.id, !a.is_starred);
                    }}
                  >
                    <Star size={13} fill={a.is_starred ? 'currentColor' : 'none'} />
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
