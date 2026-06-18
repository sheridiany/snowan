import { useState } from 'react';
import { Button, Empty, Flexbox, Icon, Text } from '@lobehub/ui';
import { createStyles } from 'antd-style';
import {
  Calendar,
  CalendarPlus,
  FileText,
  FolderOpen,
  FolderPlus,
  Globe,
  Library,
  MessagesSquare,
  Plus,
  StickyNote,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { ListPane, ListRow, type NavProps } from '../shell/ListPane';

type TabKey = 'notes' | 'web' | 'aichat' | 'folders' | 'calendar';

type Category = {
  key: TabKey;
  label: string;
  icon: LucideIcon;
  sub: string;
  empty: { icon: LucideIcon; title: string; description: string };
  action: { label: string; icon: LucideIcon };
};

const CATEGORIES: Category[] = [
  {
    key: 'notes',
    label: '笔记',
    icon: StickyNote,
    sub: '随手记录,沉淀想法',
    empty: { icon: StickyNote, title: '还没有笔记', description: '新建一条笔记,随手记录想法,沉淀进知识库。' },
    action: { label: '新建笔记', icon: Plus },
  },
  {
    key: 'web',
    label: '网页',
    icon: Globe,
    sub: '抓取并保存网页',
    empty: { icon: Globe, title: '还没有收藏网页', description: '抓取一个网址,把页面内容保存进知识库。' },
    action: { label: '添加网页', icon: Plus },
  },
  {
    key: 'aichat',
    label: 'AI 对话',
    icon: MessagesSquare,
    sub: '导入其他工具的对话',
    empty: { icon: MessagesSquare, title: '还没有导入对话', description: '导入来自其他 AI 工具的对话记录,沉淀为可检索的资料。' },
    action: { label: '导入对话', icon: Plus },
  },
  {
    key: 'folders',
    label: '文件夹',
    icon: FolderOpen,
    sub: '连接本地文件与目录',
    empty: { icon: Library, title: '还没有添加文件夹', description: '连接本地文件夹,让助手参考你的资料。' },
    action: { label: '添加文件夹', icon: FolderPlus },
  },
  {
    key: 'calendar',
    label: '日历',
    icon: Calendar,
    sub: '同步你的日程',
    empty: { icon: Calendar, title: '还没有连接日历', description: '连接日历,让助手了解你的日程安排。' },
    action: { label: '连接日历', icon: CalendarPlus },
  },
];

const FOLDER_TYPES = [
  { icon: FolderOpen, title: '本地文件夹', desc: '索引本地目录里的文档,作为可检索的上下文。' },
  { icon: FileText, title: '单个文件', desc: '添加单份文档或笔记,纳入知识范围。' },
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
    max-width: 760px;
    margin: 0 auto;
    padding: 32px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  `,
  emptyCard: css`
    padding: 48px 24px;
  `,
  sectionLabel: css`
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: ${token.colorTextTertiary};
  `,
  grid: css`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
    gap: 14px;
  `,
  card: css`
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    cursor: pointer;
    border-radius: ${token.borderRadius}px;
    transition: background 0.12s ease;
    &:hover {
      background: ${token.colorFillQuaternary};
    }
  `,
  cardIcon: css`
    width: 40px;
    height: 40px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: ${token.colorPrimaryBg};
    color: ${token.colorPrimary};
  `,
  cardTitle: css`
    font-size: 14px;
    font-weight: 600;
    color: ${token.colorText};
  `,
  cardDesc: css`
    font-size: 12px;
    line-height: 1.6;
    color: ${token.colorTextTertiary};
  `,
}));

export default function KnowledgeView({
  view,
  onView,
  onNewChat,
  listCollapsed,
}: NavProps & { listCollapsed?: boolean }) {
  const { styles } = useStyles();
  const [tab, setTab] = useState<TabKey>('notes');
  const active = CATEGORIES.find((c) => c.key === tab) ?? CATEGORIES[0];

  return (
    <>
      {!listCollapsed && (
        <ListPane view={view} onView={onView} onNewChat={onNewChat}>
          {CATEGORIES.map((c) => (
            <ListRow
              key={c.key}
              icon={c.icon}
              label={c.label}
              sub={c.sub}
              active={c.key === tab}
              onClick={() => setTab(c.key)}
            />
          ))}
        </ListPane>
      )}

      <div className={styles.detail}>
        <div className={styles.detailHeader}>
          <span className={styles.detailTitle}>{active.label}</span>
          <Button type="primary" size="small" icon={<Icon icon={active.action.icon} size={15} />}>
            {active.action.label}
          </Button>
        </div>
        <div className={styles.detailScroll}>
          <div className={styles.detailInner}>
            <div className={styles.emptyCard}>
              <Empty
                icon={active.empty.icon}
                title={active.empty.title}
                description={active.empty.description}
              />
            </div>

            {tab === 'folders' && (
              <>
                <Text className={styles.sectionLabel}>支持的类型</Text>
                <div className={styles.grid}>
                  {FOLDER_TYPES.map(({ icon: CardIcon, title, desc }) => (
                    <div key={title} className={styles.card}>
                      <div className={styles.cardIcon}>
                        <Icon icon={CardIcon} size={20} />
                      </div>
                      <Flexbox direction="vertical" gap={4}>
                        <Text className={styles.cardTitle}>{title}</Text>
                        <Text className={styles.cardDesc}>{desc}</Text>
                      </Flexbox>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
