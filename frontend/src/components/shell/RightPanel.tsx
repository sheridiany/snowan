import { useEffect, useState } from 'react';
import { ActionIcon, Empty, Markdown } from '@lobehub/ui';
import { Dropdown } from 'antd';
import { createStyles } from 'antd-style';
import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  FolderOpen,
  Globe,
  MessagesSquare,
  RotateCw,
  StickyNote,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { ListRow } from './ListPane';
import { useResizableWidth } from './useResizableWidth';
import { listNotes, getEmbeddingStatus, type Note } from '../../api/knowledge';

// The right panel is the in-context knowledge browser (remio-style): a source
// dropdown in the header, a list below, and click-to-open detail in place. Only
// 笔记 is wired to the backend today; the rest are placeholders until their
// list endpoints land.
type SourceKey = 'notes' | 'web' | 'aichat' | 'folders' | 'calendar';
type Source = { key: SourceKey; label: string; icon: LucideIcon; ready: boolean };

const SOURCES: Source[] = [
  { key: 'notes', label: '笔记', icon: StickyNote, ready: true },
  { key: 'web', label: '网页', icon: Globe, ready: false },
  { key: 'aichat', label: 'AI 对话', icon: MessagesSquare, ready: false },
  { key: 'folders', label: '文件夹', icon: FolderOpen, ready: false },
  { key: 'calendar', label: '日程', icon: Calendar, ready: false },
];

function noteDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function snippet(body: string): string {
  const line = body
    .split('\n')
    .map((l) => l.replace(/^#+\s*/, '').trim())
    .find((l) => l.length > 0);
  return line ?? '';
}

const useStyles = createStyles(({ token, css }) => ({
  panel: css`
    position: relative;
    flex: none;
    display: flex;
    flex-direction: column;
    background: ${token.colorBgContainer};
    border-radius: ${token.borderRadiusLG}px;
    box-shadow: ${token.boxShadowTertiary};
    overflow: hidden;
  `,
  handle: css`
    position: absolute;
    top: 8px;
    bottom: 8px;
    left: 0;
    width: 6px;
    cursor: col-resize;
    z-index: 5;
    &:hover::after {
      content: '';
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      width: 2px;
      border-radius: 2px;
      background: ${token.colorPrimary};
      opacity: 0.5;
    }
  `,
  header: css`
    flex: none;
    height: 52px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 0 8px 0 10px;
  `,
  source: css`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 32px;
    padding: 0 8px;
    border-radius: ${token.borderRadius}px;
    cursor: pointer;
    color: ${token.colorText};
    font-size: 14px;
    font-weight: 600;
    transition: background 0.12s ease;
    &:hover {
      background: ${token.colorFillTertiary};
    }
  `,
  chevron: css`
    color: ${token.colorTextTertiary};
  `,
  crumb: css`
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
    font-size: 13px;
    font-weight: 600;
    color: ${token.colorText};
  `,
  back: css`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    flex: none;
    border-radius: ${token.borderRadiusSM}px;
    cursor: pointer;
    color: ${token.colorTextSecondary};
    &:hover {
      background: ${token.colorFillTertiary};
      color: ${token.colorText};
    }
  `,
  crumbTitle: css`
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  actions: css`
    flex: none;
    display: flex;
    align-items: center;
    gap: 2px;
  `,
  scroll: css`
    flex: 1;
    overflow-y: auto;
    padding: 6px 8px 12px;
  `,
  detail: css`
    flex: 1;
    overflow-y: auto;
    padding: 8px 18px 24px;
  `,
  detailTitle: css`
    font-size: 18px;
    font-weight: 700;
    line-height: 1.4;
    color: ${token.colorText};
    margin: 8px 0 4px;
  `,
  detailMeta: css`
    font-size: 12px;
    color: ${token.colorTextTertiary};
    margin-bottom: 14px;
  `,
  notice: css`
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 2px 2px 8px;
    padding: 7px 10px;
    border-radius: ${token.borderRadius}px;
    background: ${token.colorWarningBg};
    border: 1px solid ${token.colorWarningBorder};
    font-size: 12px;
    color: ${token.colorWarningText};
  `,
  noticeLink: css`
    flex: none;
    margin-left: auto;
    font-weight: 600;
    color: ${token.colorWarning};
    cursor: pointer;
    white-space: nowrap;
  `,
}));

export default function RightPanel({
  refreshKey,
  onOpenSettings,
}: {
  refreshKey?: number;
  onOpenSettings?: () => void;
}) {
  const { styles } = useStyles();
  const { width, onResizeStart } = useResizableWidth({
    key: 'snowan.rightWidth',
    initial: 340,
    min: 280,
    max: 560,
    side: 'left',
  });
  const [source, setSource] = useState<SourceKey>('notes');
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<Note | null>(null);
  const [embReady, setEmbReady] = useState<boolean | null>(null);

  const refresh = () => {
    setLoading(true);
    listNotes()
      .then(setNotes)
      .catch(() => setNotes([]))
      .finally(() => setLoading(false));
    getEmbeddingStatus()
      .then((s) => setEmbReady(s.ready))
      .catch(() => setEmbReady(null));
  };

  useEffect(refresh, [refreshKey]); // re-fetch when a note is saved elsewhere

  const active = SOURCES.find((s) => s.key === source) ?? SOURCES[0];

  // Detail view — a single opened note, with breadcrumb back to its list.
  if (open) {
    return (
      <aside className={styles.panel} style={{ width }}>
        <div className={styles.header}>
          <span className={styles.crumb}>
            <span className={styles.back} onClick={() => setOpen(null)}>
              <ChevronLeft size={18} />
            </span>
            <span className={styles.crumbTitle}>{active.label}</span>
          </span>
        </div>
        <div className={styles.detail}>
          <div className={styles.detailTitle}>{open.title || '无标题'}</div>
          <div className={styles.detailMeta}>
            {open.origin === 'chat' ? '来自对话 · ' : ''}
            {noteDate(open.updated_at)}
          </div>
          <Markdown>{open.body}</Markdown>
        </div>
        <div className={styles.handle} onPointerDown={onResizeStart} />
      </aside>
    );
  }

  return (
    <aside className={styles.panel} style={{ width }}>
      <div className={styles.header}>
        <Dropdown
          trigger={['click']}
          menu={{
            items: SOURCES.map((s) => ({
              key: s.key,
              icon: <s.icon size={15} />,
              label: s.ready ? s.label : `${s.label}（即将上线）`,
            })),
            onClick: ({ key }) => {
              setSource(key as SourceKey);
              setOpen(null);
            },
          }}
        >
          <span className={styles.source}>
            <active.icon size={16} />
            {active.label}
            <ChevronDown size={15} className={styles.chevron} />
          </span>
        </Dropdown>
        {active.ready && (
          <div className={styles.actions}>
            <ActionIcon icon={RotateCw} size="small" title="刷新" onClick={refresh} spin={loading} />
          </div>
        )}
      </div>

      <div className={styles.scroll}>
        {active.ready && embReady === false && (
          <div className={styles.notice}>
            <span>语义检索未启用,当前仅关键词。</span>
            <span className={styles.noticeLink} onClick={onOpenSettings}>
              去设置下载
            </span>
          </div>
        )}
        {!active.ready ? (
          <Empty
            icon={active.icon}
            title="即将上线"
            description={`${active.label}还在规划中。`}
            paddingBlock={36}
          />
        ) : notes.length === 0 ? (
          <Empty
            icon={StickyNote}
            title={loading ? '加载中…' : '还没有笔记'}
            description="在对话里点「存为笔记」,它会出现在这里。"
            paddingBlock={36}
          />
        ) : (
          notes.map((n) => (
            <ListRow
              key={n.id}
              label={n.title || '无标题'}
              sub={snippet(n.body)}
              right={noteDate(n.updated_at)}
              onClick={() => setOpen(n)}
            />
          ))
        )}
      </div>
      <div className={styles.handle} onPointerDown={onResizeStart} />
    </aside>
  );
}
