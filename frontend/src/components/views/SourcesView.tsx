import { Block, Button, Flexbox, Text } from '@lobehub/ui';
import { createStyles } from 'antd-style';
import { Calendar, Database, FolderOpen, Globe, Plus } from 'lucide-react';
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
    padding: 36px 24px 32px;
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
  empty: css`
    padding: 40px 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    text-align: center;
  `,
  emptyIcon: css`
    width: 48px;
    height: 48px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: ${token.colorFillTertiary};
    color: ${token.colorTextTertiary};
    margin-bottom: 6px;
  `,
  emptyTitle: css`
    font-size: 15px;
    font-weight: 600;
    color: ${token.colorTextSecondary};
  `,
  emptySub: css`
    font-size: 13px;
    color: ${token.colorTextTertiary};
    margin-bottom: 8px;
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
}));

type SourceType = {
  icon: LucideIcon;
  title: string;
  desc: string;
};

const SOURCE_TYPES: SourceType[] = [
  {
    icon: FolderOpen,
    title: '本地文件夹',
    desc: '索引本地目录里的文档,作为可检索的上下文。',
  },
  {
    icon: Globe,
    title: '网页',
    desc: '抓取一个网址,把页面内容纳入知识范围。',
  },
  {
    icon: Calendar,
    title: '日历',
    desc: '连接日历,让助手了解你的日程安排。',
  },
];

export default function SourcesView() {
  const { styles } = useStyles();

  return (
    <div className={styles.scroll}>
      <div className={styles.page}>
        <div className={styles.header}>
          <Text className={styles.title}>数据源</Text>
          <Text className={styles.sub}>把外部内容接入 Snowan,作为对话的上下文。</Text>
        </div>

        <Block variant="outlined">
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>
              <Database size={22} strokeWidth={1.8} />
            </div>
            <Text className={styles.emptyTitle}>还没有数据源</Text>
            <Text className={styles.emptySub}>添加一个数据源,让助手参考你的资料。</Text>
            <Button type="primary" shape="round" icon={<Plus size={16} />}>
              添加数据源
            </Button>
          </div>
        </Block>

        <Text className={styles.sectionLabel}>支持的类型</Text>
        <div className={styles.grid}>
          {SOURCE_TYPES.map(({ icon: Icon, title, desc }) => (
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
      </div>
    </div>
  );
}
