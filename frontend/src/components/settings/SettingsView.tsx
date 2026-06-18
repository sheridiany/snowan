import { useState } from 'react';
import { ActionIcon } from '@lobehub/ui';
import { createStyles } from 'antd-style';
import {
  Keyboard,
  MoreHorizontal,
  Palette,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  FolderOpen,
} from 'lucide-react';
import type { ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';

import { ListPane, ListRow } from '../shell/ListPane';
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
  icon: LucideIcon;
  panel: ComponentType;
};

const CATEGORIES: Category[] = [
  { id: 'appearance', title: '外观', subtitle: '主题与字体', icon: Palette, panel: SettingsAppearance },
  { id: 'ai', title: 'AI', subtitle: '模型与连接', icon: Sparkles, panel: SettingsAI },
  { id: 'workspace', title: 'Workspace', subtitle: '工作目录', icon: FolderOpen, panel: SettingsWorkspace },
  { id: 'permissions', title: '权限', subtitle: '探索与执行规则', icon: ShieldCheck, panel: SettingsPermissions },
  { id: 'shortcuts', title: '快捷键', subtitle: '键盘操作', icon: Keyboard, panel: SettingsShortcuts },
  { id: 'preferences', title: '偏好', subtitle: '语言与其他', icon: SlidersHorizontal, panel: SettingsPreferences },
];

const useStyles = createStyles(({ token, css }) => ({
  detail: css`
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    background: ${token.colorBgContainer};
    border-radius: ${token.borderRadiusLG}px;
    box-shadow: ${token.boxShadowTertiary};
    overflow: hidden;
  `,
  detailHeader: css`
    flex: none;
    height: 52px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 0 24px;
  `,
  detailTitle: css`
    font-size: 14px;
    font-weight: 600;
    color: ${token.colorText};
  `,
  detailScroll: css`
    flex: 1;
    overflow-y: auto;
  `,
  detailInner: css`
    max-width: 720px;
    margin: 0 auto;
    padding: 16px 32px 64px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  `,
}));

export default function SettingsView({ listCollapsed }: { listCollapsed?: boolean }) {
  const { styles } = useStyles();
  const [activeId, setActiveId] = useState<CategoryId>('appearance');

  const active = CATEGORIES.find((c) => c.id === activeId) ?? CATEGORIES[0];
  const Panel = active.panel;

  return (
    <>
      {!listCollapsed && (
        <ListPane title="设置">
          {CATEGORIES.map((c) => (
            <ListRow
              key={c.id}
              icon={c.icon}
              label={c.title}
              sub={c.subtitle}
              active={c.id === activeId}
              onClick={() => setActiveId(c.id)}
            />
          ))}
        </ListPane>
      )}

      <div className={styles.detail}>
        <div className={styles.detailHeader}>
          <span className={styles.detailTitle}>{active.title}</span>
          <ActionIcon icon={MoreHorizontal} size="small" title="更多" />
        </div>
        <div className={styles.detailScroll}>
          <div className={styles.detailInner}>
            <Panel />
          </div>
        </div>
      </div>
    </>
  );
}
