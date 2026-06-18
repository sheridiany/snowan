import { useState } from 'react';
import { Block, Button, Empty, Flexbox, Icon, Text } from '@lobehub/ui';
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
    empty: {
      icon: StickyNote,
      title: '还没有笔记',
      description: '新建一条笔记,随手记录想法,沉淀进知识库。',
    },
    action: { label: '新建笔记', icon: Plus },
  },
  {
    key: 'web',
    label: '网页',
    icon: Globe,
    sub: '抓取并保存网页',
    empty: {
      icon: Globe,
      title: '还没有收藏网页',
      description: '抓取一个网址,把页面内容保存进知识库。',
    },
    action: { label: '添加网页', icon: Plus },
  },
  {
    key: 'aichat',
    label: 'AI 对话',
    icon: MessagesSquare,
    sub: '导入其他工具的对话',
    empty: {
      icon: MessagesSquare,
      title: '还没有导入对话',
      description: '导入来自其他 AI 工具的对话记录,沉淀为可检索的资料。',
    },
    action: { label: '导入对话', icon: Plus },
  },
  {
    key: 'folders',
    label: '文件夹',
    icon: FolderOpen,
    sub: '连接本地文件与目录',
    empty: {
      icon: Library,
      title: '还没有添加文件夹',
      description: '连接本地文件夹,让助手参考你的资料。',
    },
    action: { label: '添加文件夹', icon: FolderPlus },
  },
  {
    key: 'calendar',
    label: '日历',
    icon: Calendar,
    sub: '同步你的日程',
    empty: {
      icon: Calendar,
      title: '还没有连接日历',
      description: '连接日历,让助手了解你的日程安排。',
    },
    action: { label: '连接日历', icon: CalendarPlus },
  },
];

const FOLDER_TYPES = [
  { icon: FolderOpen, title: '本地文件夹', desc: '索引本地目录里的文档,作为可检索的上下文。' },
  { icon: FileText, title: '单个文件', desc: '添加单份文档或笔记,纳入知识范围。' },
];

const useStyles = createStyles(({ token, css }) => ({
  root: css`
    flex: 1;
    min-width: 0;
    height: 100%;
    display: flex;
  `,
  list: css`
    width: 300px;
    flex: none;
    height: 100%;
    display: flex;
    flex-direction: column;
    background: ${token.colorBgContainer};
    border-right: 1px solid ${token.colorBorderSecondary};
  `,
  listHeader: css`
    flex: none;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 12px;
    border-bottom: 1px solid ${token.colorBorderSecondary};
  `,
  listTitle: css`
    font-size: 15px;
    font-weight: 600;
    color: ${token.colorText};
  `,
  listScroll: css`
    flex: 1;
    overflow-y: auto;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  `,
  row: css`
    position: relative;
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 9px 10px;
    border-radius: ${token.borderRadius}px;
    cursor: pointer;
    transition: background 0.15s;
    &:hover {
      background: ${token.colorFillTertiary};
    }
  `,
  rowActive: css`
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
  rowIcon: css`
    flex: none;
    color: ${token.colorTextSecondary};
  `,
  rowIconActive: css`
    color: ${token.colorPrimary};
  `,
  rowText: css`
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  `,
  rowLabel: css`
    font-size: 13px;
    font-weight: 500;
    color: ${token.colorText};
  `,
  rowSub: css`
    font-size: 11px;
    color: ${token.colorTextTertiary};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  detail: css`
    flex: 1;
    min-width: 0;
    height: 100%;
    display: flex;
    flex-direction: column;
    background: ${token.colorBgLayout};
  `,
  detailHeader: css`
    flex: none;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 0 20px;
    border-bottom: 1px solid ${token.colorBorderSecondary};
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
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 20px;
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
    gap: 12px;
  `,
  card: css`
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    cursor: pointer;
    transition: border-color 0.15s ease;
    &:hover {
      border-color: ${token.colorPrimaryBorder};
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

export default function KnowledgeView() {
  const { styles, cx } = useStyles();
  const [tab, setTab] = useState<TabKey>('notes');

  const active = CATEGORIES.find((c) => c.key === tab) ?? CATEGORIES[0];

  return (
    <div className={styles.root}>
      <div className={styles.list}>
        <div className={styles.listHeader}>
          <Text className={styles.listTitle}>知识库</Text>
        </div>
        <div className={styles.listScroll}>
          {CATEGORIES.map((c) => {
            const isActive = c.key === tab;
            return (
              <div
                key={c.key}
                className={cx(styles.row, isActive && styles.rowActive)}
                onClick={() => setTab(c.key)}
              >
                <Icon
                  className={cx(styles.rowIcon, isActive && styles.rowIconActive)}
                  icon={c.icon}
                  size={18}
                />
                <span className={styles.rowText}>
                  <span className={styles.rowLabel}>{c.label}</span>
                  <span className={styles.rowSub}>{c.sub}</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.detail}>
        <div className={styles.detailHeader}>
          <span className={styles.detailTitle}>{active.label}</span>
          <Button type="primary" size="small" icon={<Icon icon={active.action.icon} size={15} />}>
            {active.action.label}
          </Button>
        </div>
        <div className={styles.detailScroll}>
          <div className={styles.detailInner}>
            <Block variant="outlined" paddingBlock={40}>
              <Empty
                icon={active.empty.icon}
                title={active.empty.title}
                description={active.empty.description}
              />
            </Block>

            {tab === 'folders' && (
              <>
                <Text className={styles.sectionLabel}>支持的类型</Text>
                <div className={styles.grid}>
                  {FOLDER_TYPES.map(({ icon: CardIcon, title, desc }) => (
                    <Block key={title} variant="outlined" className={styles.card}>
                      <div className={styles.cardIcon}>
                        <Icon icon={CardIcon} size={20} />
                      </div>
                      <Flexbox direction="vertical" gap={4}>
                        <Text className={styles.cardTitle}>{title}</Text>
                        <Text className={styles.cardDesc}>{desc}</Text>
                      </Flexbox>
                    </Block>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
