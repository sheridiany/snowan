import { memo, useEffect, useState, type ReactNode } from 'react';
import { ActionIcon, Button, Empty, Markdown } from '@lobehub/ui';
import { App, Dropdown, Popconfirm } from 'antd';
import { createStyles } from 'antd-style';
import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  Download,
  FileCode,
  FileText,
  FileType,
  FolderOpen,
  Mic,
  RotateCw,
  StickyNote,
  Trash2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { ListRow } from './ListPane';
import CalendarSource from './CalendarSource';
import { useResizableWidth } from './useResizableWidth';
import DailyExpand from '../daily/DailyExpand';
import { LAYOUT } from '../../theme/themes';
import RecordingPanel from '../recording/RecordingPanel';
import {
  listNotes,
  listFolders,
  getEmbeddingStatus,
  exportNote,
  deleteNote,
  type ExportFormat,
  type Note,
  type KbFolder,
} from '../../api/knowledge';
import { getCalendar, type CalendarEvent } from '../../api/calendar';
import { getPrefs } from '../../api/system';

// The right panel is the in-context knowledge browser (remio-style): a source
// dropdown in the header, a list below, and click-to-open detail in place. 笔记
// and 文件夹 are wired to the backend; the rest are placeholders until their list
// endpoints land.
type SourceKey = 'notes' | 'folders' | 'calendar' | 'recording';
type Source = { key: SourceKey; label: string; icon: LucideIcon };

// 网页 and AI 对话 are intentionally omitted until a real list endpoint lands.
const SOURCES: Source[] = [
  { key: 'notes', label: '笔记', icon: StickyNote },
  { key: 'folders', label: '文件夹', icon: FolderOpen },
  { key: 'calendar', label: '日程', icon: Calendar },
  { key: 'recording', label: '录音', icon: Mic },
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
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    padding: 6px 8px 12px;
  `,
  // Holds a view-provided contextual source (e.g. 伴读) — it owns its own scroll.
  ctxBody: css`
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
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
}));

function RightPanel({
  refreshKey,
  onOpenSettings,
  contextual,
  autoSelect,
}: {
  refreshKey?: number;
  onOpenSettings?: () => void;
  // A view-provided source pinned to the top of the dropdown and selected by
  // default (e.g. 画图's 收藏). Lets a per-view panel live inside the one shared
  // RightPanel shell instead of being a bespoke right column.
  contextual?: { key: string; label: string; icon: LucideIcon; node: ReactNode };
  // When this transitions to true, switch the panel to the contextual source
  // (e.g. entering image mode auto-opens 收藏).
  autoSelect?: boolean;
}) {
  const { styles } = useStyles();
  const { message } = App.useApp();
  const { width, onResizeStart } = useResizableWidth({
    key: 'snowan.rightWidth',
    initial: 340,
    min: 280,
    max: 560,
    side: 'left',
  });
  const [source, setSource] = useState<string>(
    autoSelect && contextual ? contextual.key : 'calendar',
  );
  const [notes, setNotes] = useState<Note[]>([]);
  const [folders, setFolders] = useState<KbFolder[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<Note | null>(null);
  const [embReady, setEmbReady] = useState<boolean | null>(null);
  const [expandDate, setExpandDate] = useState<string | null>(null);
  const openExpand = (d: string) => setExpandDate(d);
  // 「我的画像」onboarding: show the nudge atop the daily panel until onboarded.
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  useEffect(() => {
    getPrefs()
      .then((p) => setOnboarded(p.onboarded))
      .catch(() => setOnboarded(true));
  }, []);

  // When autoSelect turns on (e.g. entering image mode), switch to 收藏.
  useEffect(() => {
    if (autoSelect && contextual) setSource(contextual.key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSelect]);

  // Fetch only what the active source needs; scope the spinner over all
  // in-flight requests with one finally. Returns a no-op for sources that
  // carry their own data (contextual / recording).
  const fetchSource = (key: string) => {
    const jobs: Promise<unknown>[] = [];
    if (key === 'notes') {
      jobs.push(listNotes().then(setNotes).catch(() => setNotes([])));
      jobs.push(getEmbeddingStatus().then((s) => setEmbReady(s.ready)).catch(() => setEmbReady(null)));
    } else if (key === 'folders') {
      jobs.push(listFolders().then((s) => setFolders(s.folders)).catch(() => setFolders([])));
    } else if (key === 'calendar') {
      jobs.push(getCalendar().then((d) => setEvents(d.events)).catch(() => setEvents([])));
    }
    if (jobs.length === 0) return;
    setLoading(true);
    void Promise.all(jobs).finally(() => setLoading(false));
  };

  // Re-fetch the active source when a note is saved elsewhere (refreshKey bump)
  // or when the source changes (it can change in Settings). A source switch
  // shows the spinner so calendar/folders don't flash the empty state.
  useEffect(() => {
    fetchSource(source);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, refreshKey]);

  // The contextual source (if any) sits atop the built-in sources in the dropdown.
  const sources: { key: string; label: string; icon: LucideIcon }[] = contextual
    ? [{ key: contextual.key, label: contextual.label, icon: contextual.icon }, ...SOURCES]
    : SOURCES;
  const active = sources.find((s) => s.key === source) ?? sources[0];
  const isContextual = source === contextual?.key;

  const doExport = (note: Note, format: ExportFormat) =>
    exportNote(note.id, format).catch(() => message.error('导出失败,请重试'));

  const onDelete = (note: Note) =>
    deleteNote(note.id)
      .then(() => {
        setNotes((prev) => prev.filter((n) => n.id !== note.id));
        setOpen((cur) => (cur?.id === note.id ? null : cur));
        message.success('已删除');
      })
      .catch((e: Error) => message.error(`删除失败:${e.message || '请重试'}`));

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
          <div className={styles.actions}>
            <Dropdown
              trigger={['click']}
              menu={{
                items: [
                  { key: 'md', icon: <FileText size={15} />, label: 'Markdown' },
                  { key: 'html', icon: <FileCode size={15} />, label: 'HTML' },
                  { key: 'docx', icon: <FileType size={15} />, label: 'Word' },
                ],
                onClick: ({ key }) => doExport(open, key as ExportFormat),
              }}
            >
              <ActionIcon icon={Download} size="small" title="导出" />
            </Dropdown>
            <Popconfirm
              title="删除这份笔记?"
              description="删除后不可恢复。"
              okText="删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
              onConfirm={() => onDelete(open)}
            >
              <ActionIcon icon={Trash2} size="small" title="删除" />
            </Popconfirm>
          </div>
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
            items: sources.map((s) => ({
              key: s.key,
              icon: <s.icon size={15} />,
              label: s.label,
            })),
            onClick: ({ key }) => {
              setSource(key);
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
        {!isContextual && (
          <div className={styles.actions}>
            <ActionIcon icon={RotateCw} size="small" title="刷新" onClick={() => fetchSource(source)} spin={loading} />
          </div>
        )}
      </div>

      {isContextual ? (
        <div className={styles.ctxBody}>{contextual!.node}</div>
      ) : source === 'recording' ? (
        <RecordingPanel refreshKey={refreshKey} />
      ) : (
      <div className={styles.scroll}>
        {embReady === false && (
          <div className={styles.notice}>
            <span>语义检索未启用,当前仅关键词。</span>
            <span className={styles.noticeLink} onClick={onOpenSettings}>
              去设置下载
            </span>
          </div>
        )}
        {source === 'calendar' ? (
          <CalendarSource
            events={events}
            loading={loading}
            onboarded={onboarded}
            onOnboarded={() => setOnboarded(true)}
            onOpenSettings={onOpenSettings}
            onExpand={openExpand}
          />
        ) : source === 'folders' ? (
          loading && folders.length === 0 ? (
            <Empty icon={FolderOpen} title="加载中…" paddingBlock={36} />
          ) : folders.length === 0 ? (
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
              onDelete={() => onDelete(n)}
            />
          ))
        )}
      </div>
      )}
      <div className={styles.handle} onPointerDown={onResizeStart} />
      <DailyExpand
        date={expandDate ?? ''}
        open={expandDate !== null}
        onClose={() => setExpandDate(null)}
      />
    </aside>
  );
}

export default memo(RightPanel);
