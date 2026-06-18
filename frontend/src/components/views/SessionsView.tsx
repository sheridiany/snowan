import { useState } from 'react';
import { ActionIcon, Empty, Flexbox, Tag, Text } from '@lobehub/ui';
import { Dropdown, Input, Modal } from 'antd';
import { createStyles } from 'antd-style';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';

import { ListPane } from '../shell/ListPane';
import type { Session, SessionStatus } from '../types';

// Relative time in Chinese from a past epoch ms: "刚刚" / "3分钟" / "5小时" / "19天".
function relTime(ts: number): string {
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

const SECTIONS: { status: SessionStatus; label: string }[] = [
  { status: 'active', label: '进行中' },
  { status: 'todo', label: '待办' },
  { status: 'done', label: '已完成' },
];

// Clicking the status circle advances active -> todo -> done -> active.
const NEXT: Record<SessionStatus, SessionStatus> = {
  active: 'todo',
  todo: 'done',
  done: 'active',
};

const useStyles = createStyles(({ token, css }) => ({
  section: css`
    display: flex;
    flex-direction: column;
    margin-bottom: 6px;
  `,
  sectionHeader: css`
    display: flex;
    align-items: center;
    gap: 6px;
    height: 30px;
    padding: 0 8px;
    border-radius: ${token.borderRadiusSM}px;
    cursor: pointer;
    user-select: none;
    &:hover {
      background: ${token.colorFillQuaternary};
    }
  `,
  chevron: css`
    flex: none;
    display: inline-flex;
    color: ${token.colorTextTertiary};
  `,
  sectionLabel: css`
    flex: 1;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.02em;
    color: ${token.colorTextSecondary};
  `,
  count: css`
    font-size: 12px;
    color: ${token.colorTextQuaternary};
  `,
  row: css`
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 9px 10px;
    border-radius: ${token.borderRadius}px;
    cursor: pointer;
    transition: background 0.12s ease;
    &:hover {
      background: ${token.colorFillTertiary};
    }
    /* reveal the ⋯ button only on hover (or while its menu is open) */
    &:hover .row-more {
      opacity: 1;
    }
  `,
  rowActive: css`
    background: ${token.colorFillSecondary};
    &:hover {
      background: ${token.colorFillSecondary};
    }
    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 8px;
      bottom: 8px;
      width: 3px;
      border-radius: 0 3px 3px 0;
      background: ${token.colorPrimary};
    }
  `,
  circle: css`
    flex: none;
    width: 18px;
    height: 18px;
    margin-top: 1px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    color: ${token.colorTextTertiary};
    cursor: pointer;
    transition: color 0.15s;
    &:hover {
      color: ${token.colorText};
    }
  `,
  circleDone: css`
    color: ${token.colorSuccess};
    &:hover {
      color: ${token.colorSuccess};
    }
  `,
  circleReadonly: css`
    cursor: default;
    &:hover {
      color: ${token.colorTextTertiary};
    }
  `,
  body: css`
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
  `,
  rowTop: css`
    display: flex;
    align-items: baseline;
    gap: 8px;
  `,
  rowTitle: css`
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
    color: ${token.colorText};
  `,
  rowTitleDone: css`
    color: ${token.colorTextTertiary};
  `,
  time: css`
    flex: none;
    font-size: 11px;
    color: ${token.colorTextQuaternary};
  `,
  more: css`
    flex: none;
    width: 22px;
    height: 18px;
    margin: -1px -4px 0 0;
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
  tags: css`
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  `,
}));

export default function SessionsView({
  sessions,
  activeId,
  onSelect,
  onSetStatus,
  onRename,
  onDelete,
}: {
  sessions: Session[];
  activeId: string;
  onSelect: (id: string) => void;
  onSetStatus?: (id: string, status: SessionStatus) => void;
  onRename?: (id: string, title: string) => void;
  onDelete?: (id: string) => void;
}) {
  const { styles, cx } = useStyles();
  const [collapsed, setCollapsed] = useState<Set<SessionStatus>>(new Set());
  const [editId, setEditId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');

  const toggle = (status: SessionStatus) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(status) ? next.delete(status) : next.add(status);
      return next;
    });

  const startRename = (s: Session) => {
    setEditId(s.id);
    setEditVal(s.title);
  };
  const saveRename = (s: Session) => {
    if (editId !== s.id) return;
    setEditId(null);
    const t = editVal.trim();
    if (t && t !== s.title) onRename?.(s.id, t);
  };
  const confirmDelete = (s: Session) =>
    Modal.confirm({
      title: `删除会话?`,
      content: `“${s.title}” 及其全部对话将被删除,无法撤销。`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => onDelete?.(s.id),
    });

  return (
    <ListPane
      title="所有会话"
      actions={<ActionIcon icon={SlidersHorizontal} size="small" title="筛选" />}
    >
      {sessions.length === 0 ? (
        <Empty
          icon={MessageSquare}
          title="还没有会话"
          description="开始一段新对话,它会出现在这里。"
          paddingBlock={40}
        />
      ) : (
        SECTIONS.map(({ status, label }) => {
          const items = sessions.filter((s) => s.status === status);
          if (items.length === 0) return null;
          const isCollapsed = collapsed.has(status);
          return (
            <div key={status} className={styles.section}>
              <div className={styles.sectionHeader} onClick={() => toggle(status)}>
                <span className={styles.chevron}>
                  {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                </span>
                <Text className={styles.sectionLabel}>{label}</Text>
                <Text className={styles.count}>{items.length}</Text>
              </div>
              {!isCollapsed &&
                items.map((s) => {
                  const active = s.id === activeId;
                  const done = s.status === 'done';
                  return (
                    <div
                      key={s.id}
                      className={cx(styles.row, active && styles.rowActive)}
                      onClick={() => onSelect(s.id)}
                    >
                      <div
                        className={cx(
                          styles.circle,
                          done && styles.circleDone,
                          !onSetStatus && styles.circleReadonly,
                        )}
                        onClick={(e) => {
                          if (!onSetStatus) return;
                          e.stopPropagation();
                          onSetStatus(s.id, NEXT[s.status]);
                        }}
                      >
                        {done ? (
                          <Check size={15} strokeWidth={2.4} />
                        ) : (
                          <Circle size={15} strokeWidth={2} />
                        )}
                      </div>
                      <div className={styles.body}>
                        <div className={styles.rowTop}>
                          {editId === s.id ? (
                            <Input
                              size="small"
                              autoFocus
                              variant="borderless"
                              style={{ flex: 1, padding: 0, height: 18, fontSize: 13 }}
                              value={editVal}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => setEditVal(e.target.value)}
                              onPressEnter={() => saveRename(s)}
                              onBlur={() => saveRename(s)}
                            />
                          ) : (
                            <Text
                              className={cx(styles.rowTitle, done && styles.rowTitleDone)}
                            >
                              {s.title}
                            </Text>
                          )}
                          <Text className={styles.time}>{relTime(s.updatedAt)}</Text>
                          {(onRename || onDelete) && editId !== s.id && (
                            <Dropdown
                              trigger={['click']}
                              menu={{
                                items: [
                                  onRename && {
                                    key: 'rename',
                                    icon: <Pencil size={14} />,
                                    label: '重命名',
                                  },
                                  onDelete && {
                                    key: 'delete',
                                    icon: <Trash2 size={14} />,
                                    label: '删除',
                                    danger: true,
                                  },
                                ].filter(Boolean) as { key: string }[],
                                onClick: ({ key, domEvent }) => {
                                  domEvent.stopPropagation();
                                  if (key === 'rename') startRename(s);
                                  if (key === 'delete') confirmDelete(s);
                                },
                              }}
                            >
                              <span
                                className={cx(styles.more, 'row-more')}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal size={15} />
                              </span>
                            </Dropdown>
                          )}
                        </div>
                        {s.tags.length > 0 && (
                          <Flexbox className={styles.tags}>
                            {s.tags.map((t) => (
                              <Tag key={t}>{t}</Tag>
                            ))}
                          </Flexbox>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          );
        })
      )}
    </ListPane>
  );
}
