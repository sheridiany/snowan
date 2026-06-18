import { Button, Icon } from '@lobehub/ui';
import { createStyles } from 'antd-style';
import {
  PencilLine,
  MessagesSquare,
  Database,
  Sparkles,
  Settings,
  Moon,
  Sun,
  type LucideIcon,
} from 'lucide-react';
import { useThemeMode } from 'antd-style';

export type View = 'chat' | 'sessions' | 'sources' | 'skills' | 'settings';

const useStyles = createStyles(({ token, css }) => ({
  rail: css`
    width: 208px;
    flex: none;
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: 12px 10px 10px;
    background: ${token.colorBgContainer};
    border-right: 1px solid ${token.colorBorderSecondary};
  `,
  brand: css`
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 4px 8px 12px;
  `,
  mark: css`
    width: 22px;
    height: 22px;
    border-radius: 7px;
    flex: none;
    background: linear-gradient(135deg, ${token.colorPrimaryHover}, ${token.colorPrimary});
    box-shadow: 0 2px 8px ${token.colorPrimaryBorder};
  `,
  brandText: css`
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0.01em;
    color: ${token.colorText};
  `,
  newBtn: css`
    width: 100%;
    justify-content: center;
    margin-bottom: 12px;
  `,
  section: css`
    display: flex;
    flex-direction: column;
    gap: 2px;
  `,
  sectionLabel: css`
    padding: 6px 10px 5px;
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: ${token.colorTextTertiary};
  `,
  row: css`
    display: flex;
    align-items: center;
    gap: 10px;
    height: 36px;
    padding: 0 10px;
    border-radius: ${token.borderRadius}px;
    font-size: 13px;
    color: ${token.colorTextSecondary};
    cursor: pointer;
    user-select: none;
    transition:
      background 0.15s ease,
      color 0.15s ease;
    &:hover {
      background: ${token.colorFillTertiary};
    }
  `,
  rowActive: css`
    background: ${token.colorFillSecondary};
    color: ${token.colorText};
    font-weight: 600;
  `,
  rowIcon: css`
    flex: none;
    color: inherit;
  `,
  rowIconActive: css`
    color: ${token.colorPrimary};
  `,
  spacer: css`
    flex: 1;
  `,
  footer: css`
    display: flex;
    flex-direction: column;
    gap: 2px;
  `,
  toggle: css`
    width: 100%;
    justify-content: flex-start;
    height: 36px;
    color: ${token.colorTextSecondary};
  `,
  toggleIcon: css`
    margin-right: 4px;
  `,
}));

type NavItem = { view: View; label: string; icon: LucideIcon };

const PRIMARY: NavItem[] = [
  { view: 'sessions', label: '所有会话', icon: MessagesSquare },
  { view: 'sources', label: '数据源', icon: Database },
  { view: 'skills', label: '技能', icon: Sparkles },
];

export default function NavRail({
  view,
  onView,
  onNewChat,
}: {
  view: View;
  onView: (v: View) => void;
  onNewChat: () => void;
}) {
  const { styles, cx } = useStyles();
  const { isDarkMode, setThemeMode } = useThemeMode();

  const Row = ({ item }: { item: NavItem }) => {
    const active = view === item.view;
    return (
      <div
        className={cx(styles.row, active && styles.rowActive)}
        onClick={() => onView(item.view)}
      >
        <Icon
          className={cx(styles.rowIcon, active && styles.rowIconActive)}
          icon={item.icon}
          size={18}
        />
        {item.label}
      </div>
    );
  };

  return (
    <nav className={styles.rail}>
      <div className={styles.brand}>
        <div className={styles.mark} />
        <span className={styles.brandText}>Snowan</span>
      </div>

      <Button
        className={styles.newBtn}
        type="primary"
        shape="round"
        icon={<Icon icon={PencilLine} size={16} />}
        onClick={onNewChat}
      >
        新建会话
      </Button>

      <div className={styles.section}>
        <span className={styles.sectionLabel}>工作台</span>
        {PRIMARY.map((item) => (
          <Row key={item.view} item={item} />
        ))}
      </div>

      <div className={styles.spacer} />

      <div className={styles.footer}>
        <div
          className={cx(styles.row, view === 'settings' && styles.rowActive)}
          onClick={() => onView('settings')}
        >
          <Icon
            className={cx(styles.rowIcon, view === 'settings' && styles.rowIconActive)}
            icon={Settings}
            size={18}
          />
          设置
        </div>
        <Button
          className={styles.toggle}
          type="text"
          size="small"
          onClick={() => setThemeMode(isDarkMode ? 'light' : 'dark')}
        >
          <Icon
            className={styles.toggleIcon}
            icon={isDarkMode ? Sun : Moon}
            size={16}
          />
          {isDarkMode ? '浅色模式' : '深色模式'}
        </Button>
      </div>
    </nav>
  );
}
