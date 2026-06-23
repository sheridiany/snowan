import { Fragment, useState } from 'react';
import { createStyles } from 'antd-style';
import {
  Brain,
  CalendarDays,
  Globe,
  Info,
  Palette,
  Plug,
  Library,
  Sparkles,
  UserRound,
  Wrench,
  Zap,
} from 'lucide-react';
import type { ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';

import { ListPane, ListRow, ListGroupLabel, type NavProps } from '../shell/ListPane';
import DetailPane from '../../ui/DetailPane';
import SettingsAppearance from './SettingsAppearance';
import SettingsAI from './SettingsAI';
import SettingsKnowledge from './SettingsKnowledge';
import SettingsCalendar from './SettingsCalendar';
import SettingsMemory from './SettingsMemory';
import SettingsWeb from './SettingsWeb';
import SettingsMcp from './SettingsMcp';
import SettingsTools from './SettingsTools';
import SettingsPermissions from './SettingsPermissions';
import SettingsRun from './SettingsRun';
import SettingsProfile from './SettingsProfile';
import SettingsSkills from './SettingsSkills';
import SettingsShortcuts from './SettingsShortcuts';
import SettingsAbout from './SettingsAbout';

// Merged tabs — composed from the existing panels so each keeps its own state/logic.
const AssistantPanel = () => (
  <>
    <SettingsProfile />
    <SettingsRun />
  </>
);
const ToolsAndPermissions = () => (
  <>
    <SettingsTools />
    <SettingsPermissions />
  </>
);
const AppearancePanel = () => (
  <>
    <SettingsAppearance />
    <SettingsShortcuts />
  </>
);

type Group = '助手' | '能力' | '知识' | '应用';
const GROUPS: Group[] = ['助手', '能力', '知识', '应用'];

type Category = {
  id: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  panel: ComponentType;
  group: Group;
};

const CATEGORIES: Category[] = [
  { id: 'ai', title: 'AI', subtitle: '模型与连接', icon: Sparkles, panel: SettingsAI, group: '助手' },
  { id: 'assistant', title: '助手', subtitle: '档案与行为', icon: UserRound, panel: AssistantPanel, group: '助手' },
  { id: 'memory', title: '记忆', subtitle: '长期记忆与画像', icon: Brain, panel: SettingsMemory, group: '助手' },
  { id: 'tools', title: '工具与权限', subtitle: '可用工具与审批', icon: Wrench, panel: ToolsAndPermissions, group: '能力' },
  { id: 'web', title: '联网', subtitle: '网页搜索与抓取', icon: Globe, panel: SettingsWeb, group: '能力' },
  { id: 'mcp', title: 'MCP', subtitle: '外部工具服务器', icon: Plug, panel: SettingsMcp, group: '能力' },
  { id: 'skills', title: '技能', subtitle: '可安装的能力', icon: Zap, panel: SettingsSkills, group: '能力' },
  { id: 'knowledge', title: '知识库', subtitle: '本地语义检索', icon: Library, panel: SettingsKnowledge, group: '知识' },
  { id: 'calendar', title: '日历', subtitle: '系统日历与 ICS', icon: CalendarDays, panel: SettingsCalendar, group: '知识' },
  { id: 'appearance', title: '外观', subtitle: '主题、字体与快捷键', icon: Palette, panel: AppearancePanel, group: '应用' },
  { id: 'about', title: '关于', subtitle: '版本与数据', icon: Info, panel: SettingsAbout, group: '应用' },
];

const useStyles = createStyles(({ css }) => ({
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
  const [activeId, setActiveId] = useState<string>('ai');

  const active = CATEGORIES.find((c) => c.id === activeId) ?? CATEGORIES[0];
  const Panel = active.panel;

  return (
    <>
      {!listCollapsed && (
        <ListPane view={view} onView={onView} onNewChat={onNewChat}>
          {GROUPS.map((g) => (
            <Fragment key={g}>
              <ListGroupLabel>{g}</ListGroupLabel>
              {CATEGORIES.filter((c) => c.group === g).map((c) => (
                <ListRow
                  key={c.id}
                  icon={c.icon}
                  label={c.title}
                  sub={c.subtitle}
                  active={c.id === activeId}
                  onClick={() => setActiveId(c.id)}
                />
              ))}
            </Fragment>
          ))}
        </ListPane>
      )}

      <DetailPane title={active.title} align="between" glow>
        <div className={styles.detailScroll}>
          <div className={styles.detailInner}>
            <Panel />
          </div>
        </div>
      </DetailPane>
    </>
  );
}
