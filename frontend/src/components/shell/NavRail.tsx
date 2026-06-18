import { Icon } from '@lobehub/ui';
import { Tooltip } from 'antd';
import { createStyles, useThemeMode } from 'antd-style';
import {
  SquarePen,
  Inbox,
  Library,
  Zap,
  Settings,
  Moon,
  Sun,
  type LucideIcon,
} from 'lucide-react';

export type View = 'conversations' | 'knowledge' | 'skills' | 'settings';

const useStyles = createStyles(({ token, css }) => ({
  rail: css`
    width: 60px;
    flex: none;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 10px 0 12px;
    background: ${token.colorBgLayout};
  `,
  mark: css`
    width: 28px;
    height: 28px;
    border-radius: 8px;
    flex: none;
    margin-bottom: 6px;
    background: linear-gradient(135deg, ${token.colorPrimaryHover}, ${token.colorPrimary});
  `,
  item: css`
    width: 40px;
    height: 40px;
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 10px;
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
  itemActive: css`
    background: ${token.colorFillSecondary};
    color: ${token.colorPrimary};
    &:hover {
      background: ${token.colorFillSecondary};
      color: ${token.colorPrimary};
    }
  `,
  newBtn: css`
    width: 40px;
    height: 40px;
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 10px;
    margin-bottom: 4px;
    color: ${token.colorTextLightSolid};
    background: ${token.colorPrimary};
    cursor: pointer;
    transition: filter 0.12s ease;
    &:hover {
      filter: brightness(1.06);
    }
  `,
  spacer: css`
    flex: 1;
  `,
}));

type NavItem = { view: View; label: string; icon: LucideIcon };

const PRIMARY: NavItem[] = [
  { view: 'conversations', label: '所有会话', icon: Inbox },
  { view: 'knowledge', label: '知识库', icon: Library },
  { view: 'skills', label: '技能', icon: Zap },
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

  return (
    <nav className={styles.rail}>
      <div className={styles.mark} />

      <Tooltip title="新建会话" placement="right">
        <div className={styles.newBtn} onClick={onNewChat}>
          <Icon icon={SquarePen} size={18} />
        </div>
      </Tooltip>

      {PRIMARY.map((item) => (
        <Tooltip key={item.view} title={item.label} placement="right">
          <div
            className={cx(styles.item, view === item.view && styles.itemActive)}
            onClick={() => onView(item.view)}
          >
            <Icon icon={item.icon} size={20} />
          </div>
        </Tooltip>
      ))}

      <div className={styles.spacer} />

      <Tooltip title="设置" placement="right">
        <div
          className={cx(styles.item, view === 'settings' && styles.itemActive)}
          onClick={() => onView('settings')}
        >
          <Icon icon={Settings} size={20} />
        </div>
      </Tooltip>
      <Tooltip title={isDarkMode ? '浅色模式' : '深色模式'} placement="right">
        <div
          className={styles.item}
          onClick={() => setThemeMode(isDarkMode ? 'light' : 'dark')}
        >
          <Icon icon={isDarkMode ? Sun : Moon} size={18} />
        </div>
      </Tooltip>
    </nav>
  );
}
