import { useState } from 'react';
import { Flexbox, Text } from '@lobehub/ui';
import { Dropdown, Input, Modal } from 'antd';
import { createStyles } from 'antd-style';
import { motion, useReducedMotion } from 'motion/react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  MessagesSquare,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react';

import { ListPane, type NavProps } from '../shell/ListPane';
import type { Session, SessionStatus } from '../types';
import StatusBadge, { type BadgeStatus } from '../../ui/StatusBadge';
import GradientThumb from '../../ui/GradientThumb';
import IconOrb from '../../ui/IconOrb';
import DisplayHeading from '../../ui/DisplayHeading';
import { EASING, staggerContainer, staggerItem } from '../../ui/motion';

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

const SECTIONS: { status: SessionStatus; label: string; badge: BadgeStatus }[] = [
  { status: 'active', label: '进行中', badge: 'processing' },
  { status: 'todo', label: '待办', badge: 'info' },
  { status: 'done', label: '已完成', badge: 'success' },
];

// Clicking the status circle advances active -> todo -> done -> active.
const NEXT: Record<SessionStatus, SessionStatus> = {
  active: 'todo',
  todo: 'done',
  done: 'active',
};

const useStyles = createStyles(({ token, css }) => {
  // Soft tinted pill for tags — same language as StatusBadge (rgba fill + inset
  // ring, no border, no dot), seeded from a neutral token (no color-mix).
  const rgb = (hex: string) => {
    const c = hex.replace('#', '');
    if (c.length !== 6) return '120, 120, 120';
    return [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16)).join(', ');
  };
  const tagTint = rgb(token.colorTextSecondary);
  return {
  section: css`
    display: flex;
    flex-direction: column;
    margin-bottom: 6px;
  `,
  sectionHeader: css`
    display: flex;
    align-items: center;
    gap: 7px;
    height: 30px;
    padding: 0 8px;
    border-radius: ${token.borderRadiusSM}px;
    cursor: pointer;
    user-select: none;
    transition: background 0.16s ${EASING.standard};
    &:hover {
      background: ${token.colorFillQuaternary};
    }
  `,
  chevron: css`
    flex: none;
    display: inline-flex;
    color: ${token.colorTextTertiary};
    transition: transform 0.16s ${EASING.standard};
  `,
  sectionLabel: css`
    flex: 1;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: ${token.colorTextSecondary};
  `,
  row: css`
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 9px 10px;
    border-radius: ${token.borderRadius}px;
    cursor: pointer;
    transition: background 0.16s ${EASING.standard};
    /* Accent rail — collapsed by default, grows in on hover/active. */
    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 50%;
      width: 3px;
      height: 0;
      border-radius: 0 3px 3px 0;
      background: ${token.colorPrimary};
      transform: translateY(-50%);
      opacity: 0;
      transition:
        height 0.18s ${EASING.emphasized},
        opacity 0.18s ${EASING.standard};
    }
    &:hover {
      background: ${token.colorFillTertiary};
    }
    &:hover::before {
      height: 38%;
      opacity: 0.45;
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
      height: calc(100% - 16px);
      opacity: 1;
    }
    &:hover::before {
      height: calc(100% - 16px);
      opacity: 1;
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
    transition:
      color 0.15s ${EASING.standard},
      transform 0.15s ${EASING.emphasized};
    &:hover {
      color: ${token.colorText};
      transform: scale(1.12);
    }
    &:active {
      transform: scale(0.92);
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
  tag: css`
    display: inline-flex;
    align-items: center;
    height: 18px;
    padding: 0 7px;
    border-radius: 999px;
    font-size: 11px;
    line-height: 1;
    color: rgba(${tagTint}, 1);
    background: rgba(${tagTint}, 0.12);
    box-shadow: inset 0 0 0 1px rgba(${tagTint}, 0.22);
  `,
  empty: css`
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 56px 24px 40px;
    gap: 16px;
  `,
  emptyArt: css`
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  `,
  emptyOrb: css`
    position: absolute;
    right: -8px;
    bottom: -8px;
  `,
  emptyTitle: css`
    margin: 4px 0 0;
  `,
  emptyDesc: css`
    max-width: 220px;
    font-size: 12.5px;
    line-height: 1.6;
    color: ${token.colorTextTertiary};
  `,
  };
});

export default function SessionsView({
  view,
  onView,
  onNewChat,
  sessions,
  activeId,
  onSelect,
  onSetStatus,
  onRename,
  onDelete,
}: NavProps & {
  sessions: Session[];
  activeId: string;
  onSelect: (id: string) => void;
  onSetStatus?: (id: string, status: SessionStatus) => void;
  onRename?: (id: string, title: string) => void;
  onDelete?: (id: string) => void;
}) {
  const { styles, cx } = useStyles();
  const reduceMotion = useReducedMotion();
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
    <ListPane view={view} onView={onView} onNewChat={onNewChat}>
      {sessions.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyArt}>
            <GradientThumb seed="sessions-empty" size={72} radius={20} icon={MessagesSquare} />
            <span className={styles.emptyOrb}>
              <IconOrb icon={Pencil} size="sm" tone="brand" />
            </span>
          </div>
          <DisplayHeading level={3} className={styles.emptyTitle}>
            还没有会话
          </DisplayHeading>
          <Text className={styles.emptyDesc}>开始一段新对话,它会出现在这里。</Text>
        </div>
      ) : (
        SECTIONS.map(({ status, label, badge }) => {
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
                <StatusBadge status={badge} size="sm">
                  {items.length}
                </StatusBadge>
              </div>
              {!isCollapsed && (
                <motion.div
                  variants={staggerContainer}
                  initial={reduceMotion ? false : 'hidden'}
                  animate="visible"
                >
                {items.map((s) => {
                  const active = s.id === activeId;
                  const done = s.status === 'done';
                  return (
                    <motion.div
                      key={s.id}
                      variants={reduceMotion ? undefined : staggerItem}
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
                              <span key={t} className={styles.tag}>
                                {t}
                              </span>
                            ))}
                          </Flexbox>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
                </motion.div>
              )}
            </div>
          );
        })
      )}
    </ListPane>
  );
}
