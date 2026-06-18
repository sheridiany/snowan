import { useState } from 'react';
import { Text } from '@lobehub/ui';
import { createStyles } from 'antd-style';
import {
  Keyboard,
  Palette,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  FolderOpen,
} from 'lucide-react';
import type { ComponentType } from 'react';
import SettingsAppearance from './SettingsAppearance';
import SettingsAI from './SettingsAI';
import SettingsWorkspace from './SettingsWorkspace';
import SettingsPermissions from './SettingsPermissions';
import SettingsShortcuts from './SettingsShortcuts';
import SettingsPreferences from './SettingsPreferences';

type CategoryId =
  | 'appearance'
  | 'ai'
  | 'workspace'
  | 'permissions'
  | 'shortcuts'
  | 'preferences';

type Category = {
  id: CategoryId;
  title: string;
  subtitle: string;
  icon: ComponentType<{ size?: number }>;
  panel: ComponentType;
};

const CATEGORIES: Category[] = [
  {
    id: 'appearance',
    title: '外观',
    subtitle: '主题与字体',
    icon: Palette,
    panel: SettingsAppearance,
  },
  { id: 'ai', title: 'AI', subtitle: '模型与连接', icon: Sparkles, panel: SettingsAI },
  {
    id: 'workspace',
    title: 'Workspace',
    subtitle: '工作目录',
    icon: FolderOpen,
    panel: SettingsWorkspace,
  },
  {
    id: 'permissions',
    title: '权限',
    subtitle: '探索与执行规则',
    icon: ShieldCheck,
    panel: SettingsPermissions,
  },
  {
    id: 'shortcuts',
    title: '快捷键',
    subtitle: '键盘操作',
    icon: Keyboard,
    panel: SettingsShortcuts,
  },
  {
    id: 'preferences',
    title: '偏好',
    subtitle: '语言与其他',
    icon: SlidersHorizontal,
    panel: SettingsPreferences,
  },
];

const useStyles = createStyles(({ token, css }) => ({
  root: css`
    flex: 1;
    min-width: 0;
    display: flex;
    height: 100vh;
    background: ${token.colorBgLayout};
  `,
  nav: css`
    width: 248px;
    flex: none;
    height: 100%;
    overflow-y: auto;
    padding: 22px 12px;
    border-right: 1px solid ${token.colorBorderSecondary};
    display: flex;
    flex-direction: column;
    gap: 4px;
  `,
  navTitle: css`
    padding: 4px 10px 12px;
    font-size: 20px;
    font-weight: 700;
    color: ${token.colorText};
  `,
  catRow: css`
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 9px 10px;
    border-radius: ${token.borderRadius}px;
    cursor: pointer;
    transition: background 0.15s ease;
    &:hover {
      background: ${token.colorFillTertiary};
    }
  `,
  catRowActive: css`
    background: ${token.colorFillSecondary};
  `,
  catIcon: css`
    width: 32px;
    height: 32px;
    flex: none;
    border-radius: 9px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: ${token.colorTextSecondary};
    background: ${token.colorFillQuaternary};
  `,
  catIconActive: css`
    color: ${token.colorPrimary};
    background: ${token.colorPrimaryBg};
  `,
  catText: css`
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  `,
  catTitle: css`
    font-size: 13px;
    font-weight: 600;
    color: ${token.colorText};
  `,
  catSub: css`
    font-size: 11px;
    color: ${token.colorTextTertiary};
  `,
  detail: css`
    flex: 1;
    min-width: 0;
    height: 100%;
    overflow-y: auto;
  `,
  detailInner: css`
    max-width: 720px;
    margin: 0 auto;
    padding: 36px 32px 64px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  `,
  detailHead: css`
    margin-bottom: 14px;
  `,
  detailTitle: css`
    font-size: 22px;
    font-weight: 700;
    color: ${token.colorText};
  `,
  detailSub: css`
    font-size: 13px;
    color: ${token.colorTextTertiary};
    margin-top: 2px;
  `,
}));

export default function SettingsView() {
  const { styles, cx } = useStyles();
  const [activeId, setActiveId] = useState<CategoryId>('appearance');

  const active = CATEGORIES.find((c) => c.id === activeId) ?? CATEGORIES[0];
  const Panel = active.panel;

  return (
    <div className={styles.root}>
      <nav className={styles.nav}>
        <Text className={styles.navTitle}>设置</Text>
        {CATEGORIES.map((c) => {
          const Icon = c.icon;
          const isActive = c.id === activeId;
          return (
            <div
              key={c.id}
              className={cx(styles.catRow, isActive && styles.catRowActive)}
              onClick={() => setActiveId(c.id)}
            >
              <span className={cx(styles.catIcon, isActive && styles.catIconActive)}>
                <Icon size={16} />
              </span>
              <span className={styles.catText}>
                <span className={styles.catTitle}>{c.title}</span>
                <span className={styles.catSub}>{c.subtitle}</span>
              </span>
            </div>
          );
        })}
      </nav>

      <div className={styles.detail}>
        <div className={styles.detailInner}>
          <div className={styles.detailHead}>
            <div className={styles.detailTitle}>{active.title}</div>
            <div className={styles.detailSub}>{active.subtitle}</div>
          </div>
          <Panel />
        </div>
      </div>
    </div>
  );
}
