import { Icon } from '@lobehub/ui';
import { createStyles } from 'antd-style';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

// Column 2 — the universal list pane. Every section (conversations / knowledge /
// skills / settings) renders its list through this so the middle column is
// visually identical everywhere.
const useStyles = createStyles(({ token, css }) => ({
  col: css`
    width: 280px;
    flex: none;
    height: 100%;
    display: flex;
    flex-direction: column;
    background: ${token.colorBgContainer};
  `,
  header: css`
    position: relative;
    flex: none;
    height: 52px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 12px;
  `,
  title: css`
    font-size: 15px;
    font-weight: 600;
    color: ${token.colorText};
  `,
  actions: css`
    position: absolute;
    right: 10px;
    display: flex;
    align-items: center;
    gap: 2px;
  `,
  scroll: css`
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  `,
}));

export function ListPane({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { styles } = useStyles();
  return (
    <div className={styles.col}>
      <div className={styles.header}>
        <span className={styles.title}>{title}</span>
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
      <div className={styles.scroll}>{children}</div>
    </div>
  );
}

const useRowStyles = createStyles(({ token, css }) => ({
  row: css`
    position: relative;
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 9px 10px;
    border-radius: ${token.borderRadius}px;
    cursor: pointer;
    transition: background 0.12s ease;
    &:hover {
      background: ${token.colorFillTertiary};
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
  `,
}));

export function ListRow({
  icon,
  label,
  sub,
  active,
  right,
  onClick,
}: {
  icon?: LucideIcon;
  label: ReactNode;
  sub?: ReactNode;
  active?: boolean;
  right?: ReactNode;
  onClick?: () => void;
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
      {right && <span className={styles.right}>{right}</span>}
    </div>
  );
}
