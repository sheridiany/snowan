import { Icon } from '@lobehub/ui';
import { Popconfirm, Tooltip } from 'antd';
import { createStyles, useThemeMode } from 'antd-style';
import {
  Moon,
  Settings,
  Sun,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { SquarePenRounded } from './craftIcons';
import { useResizableWidth } from './useResizableWidth';
import { LAYOUT } from '../../theme/themes';

export type View =
  | 'conversations'
  | 'settings';

// New-chat + settings/theme controls are threaded into every list pane so the
// middle card is the single home for navigation (no left rail).
export type NavProps = {
  view: View;
  onView: (v: View) => void;
  onNewChat: () => void;
};

// Column 2 — the universal list pane. It carries the horizontal section nav at the
// top and the settings / theme controls at the bottom; section-specific list
// content goes in the middle. Every section renders through this so the middle
// column is visually identical everywhere.
const useStyles = createStyles(({ token, css }) => ({
  col: css`
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
    right: 0;
    width: ${LAYOUT.handle}px;
    cursor: col-resize;
    z-index: 5;
    &:hover::after {
      content: '';
      position: absolute;
      top: 0;
      bottom: 0;
      right: 0;
      width: 2px;
      border-radius: 2px;
      background: ${token.colorPrimary};
      opacity: 0.5;
    }
  `,
  nav: css`
    flex: none;
    display: flex;
    align-items: center;
    gap: 2px;
    height: ${LAYOUT.headerHeight}px;
    padding: 0 10px;
  `,
  navSpacer: css`
    flex: 1;
  `,
  newBtn: css`
    width: ${LAYOUT.navBtn}px;
    height: ${LAYOUT.navBtn}px;
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 10px;
    color: ${token.colorPrimary};
    background: ${token.colorPrimaryBg};
    cursor: pointer;
    transition:
      background 0.12s ease,
      color 0.12s ease;
    &:hover {
      background: ${token.colorPrimaryBgHover};
    }
  `,
  scroll: css`
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  `,
  footer: css`
    flex: none;
    display: flex;
    align-items: center;
    gap: 2px;
    height: 48px;
    padding: 0 12px;
    border-top: 1px solid ${token.colorFillQuaternary};
  `,
  footerItem: css`
    width: ${LAYOUT.footerBtn}px;
    height: ${LAYOUT.footerBtn}px;
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 9px;
    color: ${token.colorTextSecondary};
    cursor: pointer;
    transition:
      background 0.12s ease,
      color 0.12s ease;
    &:hover {
      background: ${token.colorFillTertiary};
      color: ${token.colorText};
    }
  `,
  footerItemActive: css`
    background: ${token.colorFillSecondary};
    color: ${token.colorPrimary};
    &:hover {
      background: ${token.colorFillSecondary};
      color: ${token.colorPrimary};
    }
  `,
}));

function SideNav({ onNewChat }: Pick<NavProps, 'onNewChat'>) {
  const { styles } = useStyles();
  return (
    <nav className={styles.nav}>
      <div className={styles.navSpacer} />
      <Tooltip title="新建对话" placement="bottom">
        <div className={styles.newBtn} onClick={onNewChat}>
          <SquarePenRounded size={17} />
        </div>
      </Tooltip>
    </nav>
  );
}

function SideFooter({ view, onView }: Pick<NavProps, 'view' | 'onView'>) {
  const { styles, cx } = useStyles();
  const { isDarkMode, setThemeMode } = useThemeMode();
  return (
    <div className={styles.footer}>
      <Tooltip title="设置" placement="top">
        <div
          className={cx(styles.footerItem, view === 'settings' && styles.footerItemActive)}
          onClick={() => onView('settings')}
        >
          <Icon icon={Settings} size={18} />
        </div>
      </Tooltip>
      <Tooltip title={isDarkMode ? '浅色模式' : '深色模式'} placement="top">
        <div
          className={styles.footerItem}
          onClick={() => setThemeMode(isDarkMode ? 'light' : 'dark')}
        >
          <Icon icon={isDarkMode ? Sun : Moon} size={17} />
        </div>
      </Tooltip>
    </div>
  );
}

export function ListPane({
  view,
  onView,
  onNewChat,
  children,
}: NavProps & { children: ReactNode }) {
  const { styles } = useStyles();
  const { width, onResizeStart } = useResizableWidth({
    key: 'snowan.listWidth',
    initial: 272,
    min: 220,
    max: 440,
    side: 'right',
  });
  return (
    <div className={styles.col} style={{ width }}>
      <SideNav onNewChat={onNewChat} />
      <div className={styles.scroll}>{children}</div>
      <SideFooter view={view} onView={onView} />
      <div className={styles.handle} onPointerDown={onResizeStart} />
    </div>
  );
}

const useRowStyles = createStyles(({ token, css }) => ({
  row: css`
    position: relative;
    display: flex;
    align-items: center;
    gap: ${LAYOUT.rowGap}px;
    padding: 9px 10px;
    border-radius: ${token.borderRadius}px;
    cursor: pointer;
    transition: background 0.12s ease;
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
  del: css`
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
    transition: opacity 0.14s ease, color 0.14s ease, background 0.14s ease;
    &:hover {
      color: ${token.colorError};
      background: ${token.colorFillSecondary};
    }
  `,
  active: css`
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
    color: ${token.colorTextSecondary};
  `,
  iconActive: css`
    color: ${token.colorPrimary};
  `,
  text: css`
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  `,
  label: css`
    font-size: 13px;
    font-weight: 500;
    color: ${token.colorText};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  sub: css`
    font-size: 11px;
    color: ${token.colorTextTertiary};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  right: css`
    flex: none;
    font-size: 11px;
    color: ${token.colorTextQuaternary};
    transition: opacity 0.14s ease;
  `,
}));

export function ListRow({
  icon,
  label,
  sub,
  active,
  right,
  onClick,
  onDelete,
}: {
  icon?: LucideIcon;
  label: ReactNode;
  sub?: ReactNode;
  active?: boolean;
  right?: ReactNode;
  onClick?: () => void;
  onDelete?: () => void;
}) {
  const { styles, cx } = useRowStyles();
  return (
    <div className={cx(styles.row, active && styles.active)} onClick={onClick}>
      {icon && (
        <Icon
          className={cx(styles.icon, active && styles.iconActive)}
          icon={icon}
          size={18}
        />
      )}
      <span className={styles.text}>
        <span className={styles.label}>{label}</span>
        {sub && <span className={styles.sub}>{sub}</span>}
      </span>
      {right && (
        <span className={styles.right} data-rowdate={onDelete ? '' : undefined}>
          {right}
        </span>
      )}
      {onDelete && (
        <span data-rowdel className={styles.del} onClick={(e) => e.stopPropagation()}>
          <Popconfirm
            title="删除这份笔记?"
            description="删除后不可恢复。"
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            onConfirm={onDelete}
          >
            <Trash2 size={15} />
          </Popconfirm>
        </span>
      )}
    </div>
  );
}

const useGroupStyles = createStyles(({ token, css }) => ({
  group: css`
    padding: 14px 10px 4px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: ${token.colorTextQuaternary};
    &:first-of-type {
      padding-top: 4px;
    }
  `,
}));

// A small section header for the list rail (e.g. grouping the settings tabs).
export function ListGroupLabel({ children }: { children: ReactNode }) {
  const { styles } = useGroupStyles();
  return <div className={styles.group}>{children}</div>;
}
