import { useEffect, useState } from 'react';
import { ActionIcon, Button, Empty, Markdown } from '@lobehub/ui';
import { App, Dropdown } from 'antd';
import { createStyles } from 'antd-style';
import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileCode,
  FileText,
  FileType,
  FolderOpen,
  Globe,
  MessagesSquare,
  RotateCw,
  StickyNote,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { ListRow } from './ListPane';
import { useResizableWidth } from './useResizableWidth';
import PanelDailyNote from '../daily/PanelDailyNote';
import DailyExpand from '../daily/DailyExpand';
import { LAYOUT } from '../../theme/themes';
import {
  listNotes,
  listFolders,
  getEmbeddingStatus,
  exportNote,
  type ExportFormat,
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

function isAllDay(iso: string): boolean {
  const d = new Date(iso);
  return d.getHours() === 0 && d.getMinutes() === 0;
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dayLabel(d: Date): string {
  const wd = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
  const same = (a: Date, b: Date) => ymd(a) === ymd(b);
  const today = new Date();
  const prefix = same(d, today)
    ? '今天 · '
    : same(d, new Date(today.getTime() + 86400000))
      ? '明天 · '
      : '';
  return `${prefix}${d.getMonth() + 1}月${d.getDate()}日 周${wd}`;
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
    min-height: 0;
    display: flex;
    flex-direction: column;
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
  calNav: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 2px 4px 8px;
  `,
  calMonth: css`
    display: inline-flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;
    font-weight: 600;
    color: ${token.colorText};
  `,
  calArrow: css`
    display: inline-flex;
    cursor: pointer;
    color: ${token.colorTextSecondary};
    &:hover {
      color: ${token.colorText};
    }
  `,
  calToday: css`
    font-size: 12px;
    color: ${token.colorPrimary};
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusSM}px;
    padding: 2px 9px;
    cursor: pointer;
    &:hover {
      background: ${token.colorFillTertiary};
    }
  `,
  weekRow: css`
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    text-align: center;
    font-size: 11px;
    color: ${token.colorTextTertiary};
    padding: 0 2px 2px;
  `,
  grid: css`
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    text-align: center;
  `,
  cell: css`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 4px 0 3px;
    font-size: 13px;
    color: ${token.colorText};
    cursor: pointer;
    border-radius: ${token.borderRadiusSM}px;
    &:hover {
      background: ${token.colorFillQuaternary};
    }
  `,
  cellMuted: css`
    color: ${token.colorTextQuaternary};
  `,
  cellNum: css`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
  `,
  cellToday: css`
    background: ${token.colorPrimary};
    color: #fff;
    font-weight: 500;
  `,
  cellSel: css`
    box-shadow: inset 0 0 0 1.5px ${token.colorPrimary};
  `,
  dot: css`
    width: 4px;
    height: 4px;
    border-radius: 50%;
  `,
  daySection: css`
    border-top: 1px solid ${token.colorBorderSecondary};
    margin: 10px 0 0;
    padding-top: 10px;
  `,
  dayHead: css`
    font-size: 12px;
    color: ${token.colorTextTertiary};
    margin: 0 2px 6px;
  `,
  evRow: css`
    display: flex;
    gap: 10px;
    align-items: baseline;
    padding: 5px 2px;
  `,
  evTime: css`
    flex: none;
    width: 42px;
    font-size: 12px;
    color: ${token.colorTextTertiary};
  `,
  evTitle: css`
    flex: 1;
    min-width: 0;
    font-size: 13px;
    color: ${token.colorText};
    word-break: break-word;
  `,
  evLoc: css`
    color: ${token.colorTextTertiary};
    font-size: 12px;
  `,
}));

export default function RightPanel({
  refreshKey,
  onOpenSettings,
}: {
  refreshKey?: number;
  onOpenSettings?: () => void;
}) {
  const { styles, cx, theme } = useStyles();
  const { message } = App.useApp();
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
  const [cal, setCal] = useState(() => {
    const t = new Date();
    return { y: t.getFullYear(), m: t.getMonth() }; // m: 0-11
  });
  const [selDay, setSelDay] = useState(() => ymd(new Date()));
  const [expandDate, setExpandDate] = useState<string | null>(null);
  const openExpand = (d: string) => setExpandDate(d);

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

  // Calendar: events bucketed by local day, a Mon-aligned 6-week grid, selected-day list.
  const byDay = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const d = new Date(e.startsAt);
    if (Number.isNaN(d.getTime())) continue;
    const k = ymd(d);
    (byDay.get(k) ?? byDay.set(k, []).get(k)!).push(e);
  }
  const firstWeekday = (new Date(cal.y, cal.m, 1).getDay() + 6) % 7; // Mon = 0
  const gridStart = new Date(cal.y, cal.m, 1 - firstWeekday);
  const cells = Array.from({ length: 42 }, (_, i) =>
    new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i),
  );
  const todayYmd = ymd(new Date());
  const selEvents = (byDay.get(selDay) ?? []).slice().sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const selDate = new Date(`${selDay}T00:00:00`);
  const shiftMonth = (delta: number) =>
    setCal(({ y, m }) => {
      const d = new Date(y, m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  const goToday = () => {
    const t = new Date();
    setCal({ y: t.getFullYear(), m: t.getMonth() });
    setSelDay(ymd(t));
  };

  const doExport = (note: Note, format: ExportFormat) =>
    exportNote(note.id, format).catch(() => message.error('导出失败,请重试'));

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
          events.length === 0 ? (
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
            <>
              <div className={styles.calNav}>
                <span className={styles.calMonth}>
                  <span className={styles.calArrow} onClick={() => shiftMonth(-1)}>
                    <ChevronLeft size={18} />
                  </span>
                  {cal.y}年{cal.m + 1}月
                  <span className={styles.calArrow} onClick={() => shiftMonth(1)}>
                    <ChevronRight size={18} />
                  </span>
                </span>
                <span className={styles.calToday} onClick={goToday}>
                  今天
                </span>
              </div>
              <div className={styles.weekRow}>
                {['一', '二', '三', '四', '五', '六', '日'].map((w, i) => (
                  <span key={w} style={i >= 5 ? { color: theme.colorError } : undefined}>
                    {w}
                  </span>
                ))}
              </div>
              <div className={styles.grid}>
                {cells.map((d) => {
                  const k = ymd(d);
                  const inMonth = d.getMonth() === cal.m;
                  const isToday = k === todayYmd;
                  const isSel = k === selDay;
                  const evs = byDay.get(k) ?? [];
                  const hasTimed = evs.some((e) => !isAllDay(e.startsAt));
                  return (
                    <div key={k} className={styles.cell} onClick={() => setSelDay(k)}>
                      <span
                        className={cx(
                          styles.cellNum,
                          isToday && styles.cellToday,
                          !isToday && isSel && styles.cellSel,
                          !inMonth && !isToday && styles.cellMuted,
                        )}
                      >
                        {d.getDate()}
                      </span>
                      <span
                        className={styles.dot}
                        style={{
                          background: evs.length
                            ? hasTimed
                              ? theme.colorPrimary
                              : theme.colorTextQuaternary
                            : 'transparent',
                        }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className={styles.daySection}>
                <div className={styles.dayHead}>{dayLabel(selDate)}</div>
                {selEvents.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: theme.colorTextTertiary, padding: '2px' }}>
                    这天没有安排。
                  </div>
                ) : (
                  selEvents.map((e) => (
                    <div key={e.id} className={styles.evRow}>
                      <span className={styles.evTime}>{evTime(e.startsAt)}</span>
                      <span className={styles.evTitle}>
                        {e.title || '未命名日程'}
                        {e.location && <span className={styles.evLoc}> · {e.location}</span>}
                      </span>
                    </div>
                  ))
                )}
              </div>
              <PanelDailyNote date={selDay} onExpand={openExpand} />
            </>
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
      <DailyExpand
        date={expandDate ?? ''}
        open={expandDate !== null}
        onClose={() => setExpandDate(null)}
      />
    </aside>
  );
}
