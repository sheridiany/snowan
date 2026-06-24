import { useEffect, useMemo, useState } from 'react';
import { ActionIcon, Markdown } from '@lobehub/ui';
import { App, Popconfirm } from 'antd';
import { createStyles } from 'antd-style';
import { ChevronLeft, ExternalLink, Globe, Sparkles, Trash2 } from 'lucide-react';
import { listCaptures, deleteCapture, type Capture } from '../../api/capture';
import type { Session } from '../types';
import { TYPE } from '../../theme/themes';

const SNOWAN_SRC = 'Snowan';

// Unified list row: either an external capture or one of Snowan's own sessions.
type Row =
  | { kind: 'capture'; src: string; at: string; capture: Capture }
  | { kind: 'session'; src: string; at: string; session: Session };

// host -> friendly AI-chat site name; everything else falls back to the bare host.
const aiSite = (host: string) => {
  if (/chatgpt\.com|openai\.com/.test(host)) return 'ChatGPT';
  if (/claude\.ai/.test(host)) return 'Claude';
  if (/gemini\.google|bard\.google/.test(host)) return 'Gemini';
  if (/doubao\.com/.test(host)) return '豆包';
  if (/grok\.com|x\.ai|grok\.x\.com/.test(host)) return 'Grok';
  if (/deepseek\.com/.test(host)) return 'DeepSeek';
  if (/kimi\.|moonshot/.test(host)) return 'Kimi';
  if (/yuanbao|hunyuan|tencent/.test(host)) return '元宝';
  return host || '对话';
};

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

// Deterministic, fully-local letter avatar — no external favicon request (the app's
// promise is that browsing data never leaves the machine).
const avatarColor = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 52% 55%)`;
};
const initial = (s: string) => (s.replace(/^https?:\/\//, '').trim()[0] || '·').toUpperCase();

const dayLabel = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '更早';
  const now = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(d)) / 86400000);
  if (days <= 0) return '今天';
  if (days === 1) return '昨天';
  if (days < 7) return `${days} 天前`;
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`;
};
const timeLabel = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const useStyles = createStyles(({ token, css }) => ({
  scroll: css`
    flex: 1;
    overflow-y: auto;
    padding: 8px 10px 16px;
  `,
  chart: css`
    margin: 4px 2px 12px;
    padding: 12px 12px 10px;
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorBgContainer};
    box-shadow: ${token.boxShadowTertiary};
  `,
  chartHead: css`
    font-size: ${TYPE.small}px;
    color: ${token.colorTextTertiary};
    margin-bottom: 12px;
  `,
  bars: css`
    display: flex;
    align-items: flex-end;
    gap: 8px;
    height: 86px;
  `,
  barCol: css`
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    cursor: pointer;
  `,
  barWrap: css`
    flex: 1;
    width: 100%;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  `,
  bar: css`
    width: 18px;
    border-radius: 4px 4px 0 0;
    background: ${token.colorPrimary};
    min-height: 4px;
    transition: opacity 0.15s;
  `,
  barLabel: css`
    font-size: 10px;
    color: ${token.colorTextTertiary};
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  chips: css`
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 0 2px 10px;
  `,
  chip: css`
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 26px;
    padding: 0 10px;
    border-radius: 999px;
    font-size: 12px;
    cursor: pointer;
    color: ${token.colorTextSecondary};
    background: ${token.colorFillTertiary};
    border: 1px solid transparent;
    &:hover {
      background: ${token.colorFill};
    }
  `,
  chipActive: css`
    background: ${token.colorPrimaryBg};
    color: ${token.colorPrimary};
    border-color: ${token.colorPrimaryBorder};
  `,
  chipCount: css`
    opacity: 0.6;
  `,
  groupLabel: css`
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 14px 4px 6px;
    font-size: ${TYPE.micro}px;
    letter-spacing: 0.04em;
    color: ${token.colorTextTertiary};
  `,
  groupCount: css`
    color: ${token.colorTextQuaternary};
  `,
  row: css`
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 10px 8px;
    border-radius: ${token.borderRadius}px;
    cursor: pointer;
    &:hover {
      background: ${token.colorFillQuaternary};
    }
  `,
  avatar: css`
    flex: none;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 13px;
    font-weight: 600;
  `,
  rowBody: css`
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  `,
  rowTitle: css`
    font-size: ${TYPE.dense}px;
    color: ${token.colorText};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  rowMeta: css`
    display: flex;
    gap: 6px;
    font-size: ${TYPE.small}px;
    color: ${token.colorTextTertiary};
  `,
  empty: css`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 48px 24px;
    text-align: center;
  `,
  emptyIcon: css`
    width: 52px;
    height: 52px;
    border-radius: 16px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: ${token.colorPrimary};
    background: ${token.colorPrimaryBg};
  `,
  emptyTitle: css`
    font-size: ${TYPE.section}px;
    font-family: ${token.fontFamilyDisplay};
    color: ${token.colorText};
  `,
  emptyDesc: css`
    font-size: ${TYPE.small}px;
    line-height: 1.6;
    color: ${token.colorTextTertiary};
    max-width: 260px;
  `,
  // detail
  detail: css`
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  `,
  detailHead: css`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px 10px;
  `,
  back: css`
    display: inline-flex;
    cursor: pointer;
    color: ${token.colorTextSecondary};
    &:hover {
      color: ${token.colorText};
    }
  `,
  detailScroll: css`
    flex: 1;
    overflow-y: auto;
    padding: 0 12px 16px;
  `,
  detailTitle: css`
    font-size: ${TYPE.block}px;
    font-family: ${token.fontFamilyDisplay};
    color: ${token.colorText};
    margin-bottom: 6px;
  `,
  detailMeta: css`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    font-size: ${TYPE.small}px;
    color: ${token.colorTextTertiary};
    margin-bottom: 12px;
  `,
  cat: css`
    padding: 1px 8px;
    border-radius: 6px;
    background: ${token.colorPrimaryBg};
    color: ${token.colorPrimary};
  `,
  spacer: css`
    flex: 1;
  `,
}));

export default function CapturesView({
  kind,
  refreshKey,
  sessions,
  onOpenSession,
}: {
  kind: 'web' | 'ai_chat';
  refreshKey?: number;
  // Only consumed for kind==='ai_chat': Snowan's own conversations, merged into
  // the list alongside externally-captured AI chats.
  sessions?: Session[];
  onOpenSession?: (id: string) => void;
}) {
  const { styles, cx } = useStyles();
  const { message } = App.useApp();
  const [items, setItems] = useState<Capture[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [open, setOpen] = useState<Capture | null>(null);

  const wants = (c: Capture) =>
    kind === 'web' ? c.kind === 'web' || c.kind === 'selection' : c.kind === 'ai_chat';
  const srcOf = (c: Capture) => (kind === 'ai_chat' ? aiSite(hostOf(c.url)) : hostOf(c.url) || '其它');

  const load = () => {
    setLoading(true);
    return listCaptures()
      .then((all) => setItems(all.filter(wants)))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, refreshKey]);

  // Unified rows: captures from the backend plus (for AI 对话) Snowan's own
  // sessions. Snowan rows sort to the top by recency so the user's live
  // conversations lead the list; captures keep their backend captured_at order.
  const rows = useMemo<Row[]>(() => {
    const captureRows: Row[] = items.map((c) => ({
      kind: 'capture',
      src: srcOf(c),
      at: c.captured_at,
      capture: c,
    }));
    if (kind !== 'ai_chat' || !sessions?.length) return captureRows;
    const sessionRows: Row[] = sessions.map((s) => ({
      kind: 'session',
      src: SNOWAN_SRC,
      at: new Date(s.updatedAt).toISOString(),
      session: s,
    }));
    return [...sessionRows, ...captureRows];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, sessions, kind]);

  // source -> count, for chips + the 主要来源 chart.
  const sources = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.src, (m.get(r.src) || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const filtered = filter === 'all' ? rows : rows.filter((r) => r.src === filter);

  // group filtered by day, preserving the source order (Snowan first, then the
  // captured_at-desc order from the backend).
  const groups = useMemo(() => {
    const out: { label: string; items: Row[] }[] = [];
    for (const r of filtered) {
      const lbl = dayLabel(r.at);
      const last = out[out.length - 1];
      if (last && last.label === lbl) last.items.push(r);
      else out.push({ label: lbl, items: [r] });
    }
    return out;
  }, [filtered]);

  const onDelete = (c: Capture) =>
    deleteCapture(c.id)
      .then(() => {
        setItems((prev) => prev.filter((x) => x.id !== c.id));
        setOpen((cur) => (cur?.id === c.id ? null : cur));
        message.success('已删除');
      })
      .catch(() => message.error('删除失败'));

  if (open) {
    return (
      <div className={styles.detail}>
        <div className={styles.detailHead}>
          <span className={styles.back} onClick={() => setOpen(null)}>
            <ChevronLeft size={18} />
          </span>
          <span className={styles.spacer} />
          {open.url && (
            <ActionIcon
              icon={ExternalLink}
              size="small"
              title="打开原网页"
              onClick={() => window.open(open.url, '_blank')}
            />
          )}
          <Popconfirm
            title="删除这条剪藏?"
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            onConfirm={() => onDelete(open)}
          >
            <ActionIcon icon={Trash2} size="small" title="删除" />
          </Popconfirm>
        </div>
        <div className={styles.detailScroll}>
          <div className={styles.detailTitle}>{open.title || '未命名抓取'}</div>
          <div className={styles.detailMeta}>
            {open.category && open.category !== '未分类' && (
              <span className={styles.cat}>{open.category}</span>
            )}
            <span>{srcOf(open)}</span>
            <span>·</span>
            <span>
              {dayLabel(open.captured_at)} {timeLabel(open.captured_at)}
            </span>
            {open.tags?.length ? <span>· {open.tags.map((t) => `#${t}`).join(' ')}</span> : null}
          </div>
          <Markdown variant="chat">{open.content || '(无正文)'}</Markdown>
        </div>
      </div>
    );
  }

  if (!loading && rows.length === 0) {
    return (
      <div className={styles.scroll}>
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>
            {kind === 'ai_chat' ? <Sparkles size={24} /> : <Globe size={24} />}
          </span>
          <div className={styles.emptyTitle}>
            还没有{kind === 'ai_chat' ? ' AI 对话' : '网页'}剪藏
          </div>
          <p className={styles.emptyDesc}>
            装上「Snowan 剪藏」浏览器扩展,在
            {kind === 'ai_chat' ? ' ChatGPT / Claude / Gemini / 豆包 等对话页' : '任意网页'}
            点剪藏,内容会带 AI 分类出现在这里。
          </p>
        </div>
      </div>
    );
  }

  const maxCount = sources.length ? sources[0][1] : 1;

  return (
    <div className={styles.scroll}>
      {sources.length >= 2 && rows.length >= 3 && (
        <div className={styles.chart}>
          <div className={styles.chartHead}>主要来源</div>
          <div className={styles.bars}>
            {sources.slice(0, 6).map(([src, n]) => (
              <div
                key={src}
                className={styles.barCol}
                title={`${src} · ${n}`}
                onClick={() => setFilter((f) => (f === src ? 'all' : src))}
              >
                <div className={styles.barWrap}>
                  <div
                    className={styles.bar}
                    style={{
                      height: `${Math.max(8, Math.round((n / maxCount) * 64))}px`,
                      opacity: filter === 'all' || filter === src ? 1 : 0.4,
                    }}
                  />
                </div>
                <span
                  className={styles.avatar}
                  style={{ width: 20, height: 20, fontSize: 11, background: avatarColor(src) }}
                >
                  {initial(src)}
                </span>
                <span className={styles.barLabel}>{src}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {sources.length >= 2 && (
        <div className={styles.chips}>
          <span
            className={cx(styles.chip, filter === 'all' && styles.chipActive)}
            onClick={() => setFilter('all')}
          >
            全部 <span className={styles.chipCount}>{rows.length}</span>
          </span>
          {sources.map(([src, n]) => (
            <span
              key={src}
              className={cx(styles.chip, filter === src && styles.chipActive)}
              onClick={() => setFilter(src)}
            >
              {src} <span className={styles.chipCount}>{n}</span>
            </span>
          ))}
        </div>
      )}

      {groups.map((g) => (
        <div key={g.label}>
          <div className={styles.groupLabel}>
            <span>{g.label}</span>
            <span className={styles.groupCount}>{g.items.length}</span>
          </div>
          {g.items.map((r) =>
            r.kind === 'session' ? (
              <div
                key={`s:${r.session.id}`}
                className={styles.row}
                onClick={() => onOpenSession?.(r.session.id)}
              >
                <span className={styles.avatar} style={{ background: avatarColor(r.src) }}>
                  {initial(r.src)}
                </span>
                <span className={styles.rowBody}>
                  <span className={styles.rowTitle}>{r.session.title || '新对话'}</span>
                  <span className={styles.rowMeta}>
                    <span>{r.src}</span>
                    <span>·</span>
                    <span>{timeLabel(r.at)}</span>
                  </span>
                </span>
              </div>
            ) : (
              <div
                key={r.capture.id}
                className={styles.row}
                onClick={() => setOpen(r.capture)}
              >
                <span className={styles.avatar} style={{ background: avatarColor(r.src) }}>
                  {initial(r.src)}
                </span>
                <span className={styles.rowBody}>
                  <span className={styles.rowTitle}>{r.capture.title || '未命名抓取'}</span>
                  <span className={styles.rowMeta}>
                    {r.capture.category && r.capture.category !== '未分类' && (
                      <span>{r.capture.category}</span>
                    )}
                    <span>{r.src}</span>
                    <span>·</span>
                    <span>{timeLabel(r.at)}</span>
                  </span>
                </span>
              </div>
            ),
          )}
        </div>
      ))}
    </div>
  );
}
