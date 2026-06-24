import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActionIcon, Button, Empty, Markdown } from '@lobehub/ui';
import { App, Dropdown, Input, Modal, Popconfirm } from 'antd';
import { createStyles } from 'antd-style';
import { motion } from 'motion/react';
import {
  BookOpen,
  Calendar,
  ChevronDown,
  ChevronLeft,
  Download,
  FileCode,
  FileText,
  FileType,
  Folder,
  FolderOpen,
  Globe,
  MessageSquare,
  Mic,
  PencilLine,
  RotateCw,
  Sparkles,
  StickyNote,
  Trash2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import CalendarSource from './CalendarSource';
import { useResizableWidth } from './useResizableWidth';
import DailyExpand from '../daily/DailyExpand';
import { LAYOUT, TYPE } from '../../theme/themes';
import RecordingPanel from '../recording/RecordingPanel';
import CapturesView from '../captures/CapturesView';
import IconOrb from '../../ui/IconOrb';
import Surface from '../../ui/Surface';
import DisplayHeading from '../../ui/DisplayHeading';
import { EASING, staggerContainer, staggerItem } from '../../ui/motion';
import {
  listNotes,
  listFolders,
  getEmbeddingStatus,
  exportNote,
  deleteNote,
  updateNote,
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
type SourceKey = 'notes' | 'web' | 'ai_chat' | 'folders' | 'calendar' | 'recording';
type Source = { key: SourceKey; label: string; icon: LucideIcon };

// 网页 and AI 对话 are intentionally omitted until a real list endpoint lands.
const SOURCES: Source[] = [
  { key: 'notes', label: '笔记', icon: StickyNote },
  { key: 'web', label: '网页', icon: Globe },
  { key: 'ai_chat', label: 'AI 对话', icon: Sparkles },
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
    transition:
      background 0.16s ${EASING.standard},
      transform 0.12s ${EASING.standard};
    &:hover {
      background: ${token.colorFillTertiary};
    }
    &:active {
      transform: scale(0.98);
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
  detailCard: css`
    margin: 6px 0 16px;
    padding: 20px 24px;
  `,
  detailTitle: css`
    margin: 0 0 10px;
  `,
  detailMeta: css`
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: ${TYPE.small}px;
    color: ${token.colorTextTertiary};
    font-variant-numeric: tabular-nums;
  `,
  detailBody: css`
    line-height: 1.72;
    color: ${token.colorText};
    /* Tighten the first heading so it doesn't fight the display title above. */
    & > :first-child {
      margin-top: 0;
    }
  `,
  // A single restrained line of real metrics atop the 笔记 list — no cards, no color.
  statLine: css`
    margin: 2px 2px 10px;
    font-size: ${TYPE.small}px;
    line-height: 1.5;
    color: ${token.colorTextTertiary};
    font-variant-numeric: tabular-nums;
  `,
  // Monochrome icon chip: a lucide glyph on a faint quaternary fill.
  rowIcon: css`
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: ${token.colorFillQuaternary};
    color: ${token.colorTextTertiary};
  `,
  noteRow: css`
    position: relative;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 11px 12px;
    border-radius: ${token.borderRadius}px;
    cursor: pointer;
    transition: background 0.16s ${EASING.standard};
    &:hover {
      background: ${token.colorFillTertiary};
    }
    &:hover [data-rowdate] {
      opacity: 0;
    }
    &:hover [data-rowdel] {
      opacity: 1;
    }
  `,
  noteText: css`
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  `,
  noteTitle: css`
    font-size: ${TYPE.body}px;
    font-weight: 500;
    line-height: 1.4;
    color: ${token.colorText};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  noteSnippet: css`
    font-size: ${TYPE.small}px;
    color: ${token.colorTextTertiary};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  noteRight: css`
    flex: none;
    font-size: ${TYPE.small}px;
    color: ${token.colorTextQuaternary};
    font-variant-numeric: tabular-nums;
    transition: opacity 0.14s ease;
  `,
  noteDel: css`
    position: absolute;
    right: 4px;
    top: 50%;
    transform: translateY(-50%);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: ${token.borderRadius}px;
    color: ${token.colorTextQuaternary};
    opacity: 0;
    cursor: pointer;
    transition:
      opacity 0.14s ease,
      color 0.14s ease,
      background 0.14s ease;
    &:hover {
      color: ${token.colorError};
      background: ${token.colorFillSecondary};
    }
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
    gap: 10px;
    padding: 30px 16px;
    text-align: center;
  `,
  emptyTitle: css`
    margin: 2px 0 0;
  `,
  emptyDesc: css`
    max-width: 240px;
    font-size: ${TYPE.small}px;
    line-height: 1.6;
    color: ${token.colorTextTertiary};
  `,
  // Folder rows reuse the note-row shell with the same monochrome icon chip.
  folderRow: css`
    position: relative;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 11px 12px;
    border-radius: ${token.borderRadius}px;
    cursor: default;
    transition: background 0.16s ${EASING.standard};
    &:hover {
      background: ${token.colorFillTertiary};
    }
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

  // A refreshKey bump means a note was just saved elsewhere (App bumps it and
  // opens the panel). Surface that note: jump to 笔记 instead of leaving the user
  // on the default 日程 source where the fresh note isn't visible. Skip the first
  // render so the initial default (calendar / contextual) is respected.
  const prevRefreshKey = useRef(refreshKey);
  useEffect(() => {
    if (refreshKey !== prevRefreshKey.current) {
      prevRefreshKey.current = refreshKey;
      setSource('notes');
      setOpen(null);
    }
  }, [refreshKey]);

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

  // Play the list entrance stagger only the first time a source shows content;
  // refreshing or switching back must not replay it (the container stays mounted,
  // so a refetch with stable keys would otherwise flash a re-stagger). Returns
  // motion props that animate on the first call per source and stay static after.
  const animatedSources = useRef<Set<string>>(new Set());
  const enterOnce = (key: string) => {
    if (animatedSources.current.has(key)) {
      return { initial: false as const, animate: 'visible' };
    }
    animatedSources.current.add(key);
    return { initial: 'hidden', animate: 'visible' };
  };

  // Restrained stats band for 笔记 — derived purely from the lists already fetched.
  const chatNotes = useMemo(
    () => notes.filter((n) => n.origin === 'chat').length,
    [notes],
  );

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

  // Inline note editor (title + body), persisted via updateNote.
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const openEdit = () => {
    if (!open) return;
    setDraftTitle(open.title || '');
    setDraftBody(open.body);
    setEditing(true);
  };
  const saveEdit = async () => {
    if (!open) return;
    setSavingEdit(true);
    try {
      const updated = await updateNote(open.id, { title: draftTitle.trim(), body: draftBody });
      setOpen(updated);
      setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
      setEditing(false);
      message.success('已保存');
    } catch {
      message.error('保存失败,请重试');
    } finally {
      setSavingEdit(false);
    }
  };

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
            <ActionIcon icon={PencilLine} size="small" title="编辑" onClick={openEdit} />
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
          <Surface variant="solid" className={styles.detailCard}>
            <DisplayHeading level={2} className={styles.detailTitle}>
              {open.title || '无标题'}
            </DisplayHeading>
            <div className={styles.detailMeta}>
              <span>{open.origin === 'chat' ? '来自对话' : '手动创建'}</span>
              <span>·</span>
              <span>{noteDate(open.updated_at)}</span>
            </div>
          </Surface>
          <div className={styles.detailBody}>
            <Markdown>{open.body}</Markdown>
          </div>
        </div>
        <div className={styles.handle} onPointerDown={onResizeStart} />
        <Modal
          title="编辑笔记"
          open={editing}
          onOk={saveEdit}
          onCancel={() => setEditing(false)}
          okText="保存"
          cancelText="取消"
          confirmLoading={savingEdit}
          width={640}
          destroyOnHidden
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 6 }}>
            <Input
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              placeholder="标题"
            />
            <Input.TextArea
              value={draftBody}
              onChange={(e) => setDraftBody(e.target.value)}
              autoSize={{ minRows: 12, maxRows: 24 }}
              placeholder="正文(Markdown)"
            />
          </div>
        </Modal>
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
      ) : source === 'web' ? (
        <CapturesView kind="web" refreshKey={refreshKey} />
      ) : source === 'ai_chat' ? (
        <CapturesView kind="ai_chat" refreshKey={refreshKey} />
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
              <IconOrb icon={FolderOpen} size="lg" tone="brand" />
              <DisplayHeading level={3} className={styles.emptyTitle}>
                还没有文件夹
              </DisplayHeading>
              <p className={styles.emptyDesc}>
                在设置里添加本地文件夹,里面的文件会进入知识库。
              </p>
              <Button size="small" onClick={onOpenSettings}>
                去设置添加
              </Button>
            </div>
          ) : (
            <motion.div variants={staggerContainer} {...enterOnce('folders')}>
              {folders.map((f) => (
                <motion.div key={f.id} variants={staggerItem}>
                  <div className={styles.folderRow}>
                    <span className={styles.rowIcon}>
                      <Folder size={16} />
                    </span>
                    <span className={styles.noteText}>
                      <span className={styles.noteTitle}>
                        {f.path.split('/').filter(Boolean).pop() || f.path}
                      </span>
                      <span className={styles.noteSnippet}>{f.path}</span>
                    </span>
                    <span className={styles.noteRight}>{f.file_count} 文件</span>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )
        ) : notes.length === 0 ? (
          loading ? (
            <Empty icon={StickyNote} title="加载中…" paddingBlock={36} />
          ) : (
            <div className={styles.folderEmpty}>
              <IconOrb icon={BookOpen} size="lg" tone="brand" />
              <DisplayHeading level={3} className={styles.emptyTitle}>
                还没有笔记
              </DisplayHeading>
              <p className={styles.emptyDesc}>
                在对话里点「存为笔记」,它会出现在这里。
              </p>
            </div>
          )
        ) : (
          <>
            <div className={styles.statLine}>
              笔记 {notes.length} · 来自对话 {chatNotes} ·{' '}
              {embReady === false ? '仅关键词' : '语义检索可用'}
            </div>
            <motion.div variants={staggerContainer} {...enterOnce('notes')}>
              {notes.map((n) => (
                <motion.div key={n.id} variants={staggerItem}>
                  <div className={styles.noteRow} onClick={() => setOpen(n)}>
                    <span className={styles.rowIcon}>
                      {n.origin === 'chat' ? (
                        <MessageSquare size={16} />
                      ) : (
                        <PencilLine size={16} />
                      )}
                    </span>
                    <span className={styles.noteText}>
                      <span className={styles.noteTitle}>{n.title || '无标题'}</span>
                      <span className={styles.noteSnippet}>{snippet(n.body)}</span>
                    </span>
                    <span className={styles.noteRight} data-rowdate="">
                      {noteDate(n.updated_at)}
                    </span>
                    <span
                      data-rowdel
                      className={styles.noteDel}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Popconfirm
                        title="删除这份笔记?"
                        description="删除后不可恢复。"
                        okText="删除"
                        cancelText="取消"
                        okButtonProps={{ danger: true }}
                        onConfirm={() => onDelete(n)}
                      >
                        <Trash2 size={15} />
                      </Popconfirm>
                    </span>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </>
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
