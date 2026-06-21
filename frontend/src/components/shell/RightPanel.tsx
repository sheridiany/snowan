import { useEffect, useState } from 'react';
import { ActionIcon, Button, Empty, Markdown } from '@lobehub/ui';
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
import { LAYOUT } from '../../theme/themes';
import {
  listNotes,
  listFolders,
  getEmbeddingStatus,
  type Note,
  type KbFolder,
} from '../../api/knowledge';
import { getCalendar, type CalendarEvent } from '../../api/calendar';

// The right panel is the in-context knowledge browser (remio-style): a source
// dropdown in the header, a list below, and click-to-open detail in place. 笔记
// and 文件夹 are wired to the backend; the rest are placeholders until their list
// endpoints land.
type SourceKey = 'notes' | 'web' | 'aichat' | 'folders' | 'calendar';
type Source = { key: SourceKey; label: string; icon: LucideIcon; ready: boolean };

const SOURCES: Source[] = [
  { key: 'notes', label: '笔记', icon: StickyNote, ready: true },
  { key: 'web', label: '网页', icon: Globe, ready: false },
  { key: 'aichat', label: 'AI 对话', icon: MessagesSquare, ready: false },
  { key: 'folders', label: '文件夹', icon: FolderOpen, ready: true },
  { key: 'calendar', label: '日程', icon: Calendar, ready: true },
];

function evTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  if (d.getHours() === 0 && d.getMinutes() === 0) return '全天';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function evDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 86400000);
  const same = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (same(d, today)) return '今天';
  if (same(d, tomorrow)) return '明天';
  const wd = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
  return `${d.getMonth() + 1}月${d.getDate()}日 周${wd}`;
}

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
    width: ${LAYOUT.handle}px;
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
    height: ${LAYOUT.headerHeight}px;
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
  folderEmpty: css`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  `,
  dayHead: css`
    font-size: 12px;
    font-weight: 600;
    color: ${token.colorTextTertiary};
    margin: 14px 4px 4px;
    &:first-of-type {
      margin-top: 2px;
    }
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
  const [folders, setFolders] = useState<KbFolder[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<Note | null>(null);
  const [embReady, setEmbReady] = useState<boolean | null>(null);

  const refresh = () => {
    setLoading(true);
    listNotes()
      .then(setNotes)
      .catch(() => setNotes([]))
      .finally(() => setLoading(false));
    listFolders()
      .then((s) => setFolders(s.folders))
      .catch(() => setFolders([]));
    getEmbeddingStatus()
      .then((s) => setEmbReady(s.ready))
      .catch(() => setEmbReady(null));
    getCalendar()
      .then((d) => setEvents(d.events))
      .catch(() => setEvents([]));
  };

  useEffect(refresh, [refreshKey]); // re-fetch when a note is saved elsewhere
  // re-fetch each time that source is opened (it can change in Settings)
  useEffect(() => {
    if (source === 'folders') listFolders().then((s) => setFolders(s.folders)).catch(() => {});
    if (source === 'calendar') getCalendar().then((d) => setEvents(d.events)).catch(() => {});
  }, [source]);

  const active = SOURCES.find((s) => s.key === source) ?? SOURCES[0];

  // Agenda: today onward, soonest first.
  const todayMid = new Date();
  todayMid.setHours(0, 0, 0, 0);
  const upcoming = events
    .filter((e) => new Date(e.startsAt).getTime() >= todayMid.getTime())
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

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
        ) : source === 'calendar' ? (
          upcoming.length === 0 ? (
            <div className={styles.folderEmpty}>
              <Empty
                icon={Calendar}
                title="还没有日程"
                description="连接系统日历或导入 ICS,日程会出现在这里。"
                paddingBlock={28}
              />
              <Button size="small" onClick={onOpenSettings}>
                去设置连接
              </Button>
            </div>
          ) : (
            upcoming.map((e, i) => {
              const day = evDay(e.startsAt);
              const showHead = i === 0 || evDay(upcoming[i - 1].startsAt) !== day;
              return (
                <div key={e.id}>
                  {showHead && <div className={styles.dayHead}>{day}</div>}
                  <ListRow
                    label={e.title || '未命名日程'}
                    sub={[evTime(e.startsAt), e.location].filter(Boolean).join(' · ')}
                  />
                </div>
              );
            })
          )
        ) : source === 'folders' ? (
          folders.length === 0 ? (
            <div className={styles.folderEmpty}>
              <Empty
                icon={FolderOpen}
                title="还没有文件夹"
                description="在设置里添加本地文件夹,里面的文件会进入知识库。"
                paddingBlock={28}
              />
              <Button size="small" onClick={onOpenSettings}>
                去设置添加
              </Button>
            </div>
          ) : (
            folders.map((f) => (
              <ListRow
                key={f.id}
                icon={FolderOpen}
                label={f.path.split('/').filter(Boolean).pop() || f.path}
                sub={f.path}
                right={`${f.file_count} 文件`}
              />
            ))
          )
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
