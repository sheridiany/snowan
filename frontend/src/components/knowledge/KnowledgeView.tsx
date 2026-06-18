import { useState } from 'react';
import { Block, Button, Empty, Flexbox, Segmented, Text } from '@lobehub/ui';
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

const useStyles = createStyles(({ token, css }) => ({
  scroll: css`
    flex: 1;
    overflow-y: auto;
  `,
  page: css`
    width: 100%;
    max-width: 760px;
    margin: 0 auto;
    padding: 28px 24px 32px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  `,
  header: css`
    display: flex;
    flex-direction: column;
    gap: 4px;
  `,
  title: css`
    font-size: 24px;
    font-weight: 700;
    color: ${token.colorText};
  `,
  sub: css`
    font-size: 13px;
    color: ${token.colorTextTertiary};
  `,
  tabs: css`
    width: fit-content;
    max-width: 100%;
  `,
  sectionLabel: css`
    margin-top: 4px;
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
    border-radius: 11px;
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
  tabIcon: css`
    display: inline-flex;
    align-items: center;
    gap: 6px;
  `,
}));

type TabKey = 'notes' | 'web' | 'aichat' | 'folders' | 'calendar';

type SourceCard = {
  icon: LucideIcon;
  title: string;
  desc: string;
};

const FOLDER_TYPES: SourceCard[] = [
  {
    icon: FolderOpen,
    title: '本地文件夹',
    desc: '索引本地目录里的文档,作为可检索的上下文。',
  },
  {
    icon: FileText,
    title: '单个文件',
    desc: '添加单份文档或笔记,纳入知识范围。',
  },
];

export default function KnowledgeView() {
  const { styles } = useStyles();
  const [tab, setTab] = useState<TabKey>('notes');

  const tabIcon = (Icon: LucideIcon, label: string) => (
    <span className={styles.tabIcon}>
      <Icon size={14} strokeWidth={1.8} />
      {label}
    </span>
  );

  return (
    <div className={styles.scroll}>
      <div className={styles.page}>
        <div className={styles.header}>
          <Text className={styles.title}>知识库</Text>
          <Text className={styles.sub}>沉淀笔记、网页、对话与文件,作为 Snowan 对话的上下文。</Text>
        </div>

        <Segmented
          className={styles.tabs}
          value={tab}
          onChange={(v) => setTab(v as TabKey)}
          options={[
            { value: 'notes', label: tabIcon(StickyNote, '笔记') },
            { value: 'web', label: tabIcon(Globe, '网页') },
            { value: 'aichat', label: tabIcon(MessagesSquare, 'AI 对话') },
            { value: 'folders', label: tabIcon(FolderOpen, '文件夹') },
            { value: 'calendar', label: tabIcon(Calendar, '日历') },
          ]}
        />

        {tab === 'notes' && (
          <Block variant="outlined" paddingBlock={32}>
            <Empty
              icon={StickyNote}
              title="还没有笔记"
              description="新建一条笔记,随手记录想法,沉淀进知识库。"
              action={
                <Button type="primary" shape="round" icon={<Plus size={16} />}>
                  新建笔记
                </Button>
              }
            />
          </Block>
        )}

        {tab === 'web' && (
          <Block variant="outlined" paddingBlock={32}>
            <Empty
              icon={Globe}
              title="还没有收藏网页"
              description="抓取一个网址,把页面内容保存进知识库。"
              action={
                <Button type="primary" shape="round" icon={<Plus size={16} />}>
                  添加网页
                </Button>
              }
            />
          </Block>
        )}

        {tab === 'aichat' && (
          <Block variant="outlined" paddingBlock={32}>
            <Empty
              icon={MessagesSquare}
              title="还没有导入对话"
              description="导入来自其他 AI 工具的对话记录,沉淀为可检索的资料。"
              action={
                <Button type="primary" shape="round" icon={<Plus size={16} />}>
                  导入对话
                </Button>
              }
            />
          </Block>
        )}

        {tab === 'folders' && (
          <>
            <Block variant="outlined" paddingBlock={32}>
              <Empty
                icon={Library}
                title="还没有添加文件夹"
                description="连接本地文件夹,让助手参考你的资料。"
                action={
                  <Button
                    type="primary"
                    shape="round"
                    icon={<FolderPlus size={16} />}
                  >
                    添加文件夹
                  </Button>
                }
              />
            </Block>

            <Text className={styles.sectionLabel}>支持的类型</Text>
            <div className={styles.grid}>
              {FOLDER_TYPES.map(({ icon: Icon, title, desc }) => (
                <Block key={title} variant="outlined" className={styles.card}>
                  <div className={styles.cardIcon}>
                    <Icon size={20} strokeWidth={1.8} />
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

        {tab === 'calendar' && (
          <Block variant="outlined" paddingBlock={32}>
            <Empty
              icon={Calendar}
              title="还没有连接日历"
              description="连接日历,让助手了解你的日程安排。"
              action={
                <Button
                  type="primary"
                  shape="round"
                  icon={<CalendarPlus size={16} />}
                >
                  连接日历
                </Button>
              }
            />
          </Block>
        )}
      </div>
    </div>
  );
}
