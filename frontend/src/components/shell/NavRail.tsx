import { Button, Icon, Text } from '@lobehub/ui';
import { createStyles } from 'antd-style';
import {
  PencilLine,
  MessagesSquare,
  Database,
  Sparkles,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import { useThemeMode } from '../../theme/ThemeModeContext';

export type View = 'chat' | 'sessions' | 'sources' | 'skills' | 'settings';

const useStyles = createStyles(({ token, css }) => ({
  rail: css`
    width: 210px;
    flex: none;
    height: 100vh;
    display: flex;
    flex-direction: column;
    padding: 18px 12px 14px;
    background: ${token.colorBgContainer};
    border-right: 1px solid ${token.colorBorderSecondary};
  `,
  brand: css`
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 4px 6px 18px;
  `,
  mark: css`
    width: 28px;
    height: 28px;
    border-radius: 9px;
    flex: none;
    background: linear-gradient(135deg, ${token.colorPrimary}, #ffb066);
    box-shadow: 0 4px 12px ${token.colorPrimaryBorder};
  `,
  brandText: css`
    font-size: 18px;
    font-weight: 700;
    letter-spacing: 0.01em;
    color: ${token.colorText};
  `,
  newBtn: css`
    width: 100%;
    justify-content: center;
    margin-bottom: 16px;
  `,
  section: css`
    display: flex;
    flex-direction: column;
    gap: 2px;
  `,
  sectionLabel: css`
    padding: 6px 10px 4px;
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: ${token.colorTextTertiary};
  `,
  row: css`
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 10px;
    border-radius: ${token.borderRadius}px;
    font-size: 13px;
    color: ${token.colorTextSecondary};
    cursor: pointer;
    user-select: none;
    transition: background 0.15s ease, color 0.15s ease;
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
  spacer: css`
    flex: 1;
  `,
  footer: css`
    padding-top: 10px;
    margin-top: 6px;
    border-top: 1px solid ${token.colorBorderSecondary};
    display: flex;
    flex-direction: column;
    gap: 2px;
  `,
  toggle: css`
    width: 100%;
    justify-content: flex-start;
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
  const { isDark, toggle } = useThemeMode();

  const Row = ({ item }: { item: NavItem }) => (
    <div
      className={cx(styles.row, view === item.view && styles.rowActive)}
      onClick={() => onView(item.view)}
    >
      <Icon className={styles.rowIcon} icon={item.icon} size={18} />
      {item.label}
    </div>
  );

  return (
    <nav className={styles.rail}>
      <div className={styles.brand}>
        <div className={styles.mark} />
        <Text className={styles.brandText}>Snowan</Text>
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
          <Icon className={styles.rowIcon} icon={Settings} size={18} />
          设置
        </div>
        <Button className={styles.toggle} type="text" size="small" onClick={toggle}>
          {isDark ? '☀️  浅色模式' : '🌙  深色模式'}
        </Button>
      </div>
    </nav>
  );
}
