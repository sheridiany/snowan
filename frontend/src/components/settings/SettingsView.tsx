import { useState } from 'react';
import { ActionIcon } from '@lobehub/ui';
import { createStyles } from 'antd-style';
import {
  Globe,
  Info,
  Keyboard,
  MoreHorizontal,
  Palette,
  Plug,
  ShieldCheck,
  SlidersHorizontal,
  Library,
  Sparkles,
  UserRound,
  Wrench,
  Zap,
} from 'lucide-react';
import type { ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';

import { ListPane, ListRow, type NavProps } from '../shell/ListPane';
import SettingsAppearance from './SettingsAppearance';
import SettingsAI from './SettingsAI';
import SettingsKnowledge from './SettingsKnowledge';
import SettingsWeb from './SettingsWeb';
import SettingsMcp from './SettingsMcp';
import SettingsTools from './SettingsTools';
import SettingsPermissions from './SettingsPermissions';
import SettingsRun from './SettingsRun';
import SettingsProfile from './SettingsProfile';
import SettingsSkills from './SettingsSkills';
import SettingsShortcuts from './SettingsShortcuts';
import SettingsAbout from './SettingsAbout';

type CategoryId =
  | 'appearance'
  | 'ai'
  | 'knowledge'
  | 'web'
  | 'mcp'
  | 'tools'
  | 'permissions'
  | 'run'
  | 'profile'
  | 'skills'
  | 'shortcuts'
  | 'about';

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
  { id: 'knowledge', title: '知识库', subtitle: '本地语义检索', icon: Library, panel: SettingsKnowledge },
  { id: 'web', title: '联网', subtitle: '网页搜索与抓取', icon: Globe, panel: SettingsWeb },
  { id: 'mcp', title: 'MCP', subtitle: '外部工具服务器', icon: Plug, panel: SettingsMcp },
  { id: 'tools', title: '工具', subtitle: '可用工具', icon: Wrench, panel: SettingsTools },
  { id: 'permissions', title: '权限', subtitle: '审批模式', icon: ShieldCheck, panel: SettingsPermissions },
  { id: 'run', title: '运行', subtitle: '模型行为', icon: SlidersHorizontal, panel: SettingsRun },
  { id: 'profile', title: '个人档案', subtitle: '让助手懂你', icon: UserRound, panel: SettingsProfile },
  { id: 'skills', title: '技能', subtitle: '可安装的能力', icon: Zap, panel: SettingsSkills },
  { id: 'shortcuts', title: '快捷键', subtitle: '键盘操作', icon: Keyboard, panel: SettingsShortcuts },
  { id: 'about', title: '关于', subtitle: '版本与数据', icon: Info, panel: SettingsAbout },
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

export default function SettingsView({
  view,
  onView,
  onNewChat,
  listCollapsed,
}: NavProps & { listCollapsed?: boolean }) {
  const { styles } = useStyles();
  const [activeId, setActiveId] = useState<CategoryId>('appearance');

  const active = CATEGORIES.find((c) => c.id === activeId) ?? CATEGORIES[0];
  const Panel = active.panel;

  return (
    <>
      {!listCollapsed && (
        <ListPane view={view} onView={onView} onNewChat={onNewChat}>
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
