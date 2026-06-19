import { useState } from 'react';
import { Empty } from '@lobehub/ui';
import { Dropdown, Input, Modal } from 'antd';
import { createStyles } from 'antd-style';
import { Image, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';

import { ListPane, type NavProps } from '../shell/ListPane';
import type { ImgSession } from '../../hooks/useImagegen';

const useStyles = createStyles(({ token, css }) => ({
  row: css`
    position: relative;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 10px;
    border-radius: ${token.borderRadius}px;
    cursor: pointer;
    transition: background 0.12s ease;
    &:hover {
      background: ${token.colorFillTertiary};
    }
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
  icon: css`
    flex: none;
    display: inline-flex;
    color: ${token.colorTextSecondary};
  `,
  iconActive: css`
    color: ${token.colorPrimary};
  `,
  title: css`
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
    color: ${token.colorText};
  `,
  more: css`
    flex: none;
    width: 22px;
    height: 18px;
    margin-right: -4px;
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

export default function ImgSessionList({
  view,
  onView,
  onNewChat,
  sessions,
  activeId,
  onSelect,
  onRename,
  onDelete,
  imageCount,
}: NavProps & {
  sessions: ImgSession[];
  activeId: string;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  imageCount: (id: string) => number;
}) {
  const { styles, cx } = useStyles();
  const [editId, setEditId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');

  const startRename = (s: ImgSession) => {
    setEditId(s.id);
    setEditVal(s.title);
  };
  const saveRename = (s: ImgSession) => {
    if (editId !== s.id) return;
    setEditId(null);
    const t = editVal.trim();
    if (t && t !== s.title) onRename(s.id, t);
  };
  const confirmDelete = (s: ImgSession) => {
    const n = imageCount(s.id);
    Modal.confirm({
      title: '删除会话?',
      content: n > 0 ? `删除会话会连带删除其中 ${n} 张图,无法撤销。` : `“${s.title}” 将被删除,无法撤销。`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => onDelete(s.id),
    });
  };

  return (
    <ListPane view={view} onView={onView} onNewChat={onNewChat}>
      {sessions.length === 0 ? (
        <Empty
          icon={Image}
          title="还没有画图会话"
          description="新建一个画图会话,它会出现在这里。"
          paddingBlock={40}
        />
      ) : (
        sessions.map((s) => {
          const active = s.id === activeId;
          return (
            <div
              key={s.id}
              className={cx(styles.row, active && styles.rowActive)}
              onClick={() => onSelect(s.id)}
            >
              <span className={cx(styles.icon, active && styles.iconActive)}>
                <Image size={18} />
              </span>
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
                <span className={styles.title}>{s.title}</span>
              )}
              {editId !== s.id && (
                <Dropdown
                  trigger={['click']}
                  menu={{
                    items: [
                      { key: 'rename', icon: <Pencil size={14} />, label: '重命名' },
                      { key: 'delete', icon: <Trash2 size={14} />, label: '删除', danger: true },
                    ],
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
          );
        })
      )}
    </ListPane>
  );
}
