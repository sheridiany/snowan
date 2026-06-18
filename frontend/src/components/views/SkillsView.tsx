import { Block, Button, Empty, Flexbox, Text } from '@lobehub/ui';
import { createStyles } from 'antd-style';
import { Chrome, Compass, FileText, Sparkles } from 'lucide-react';
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

type SkillCard = {
  icon: LucideIcon;
  title: string;
  desc: string;
};

const SKILLS: SkillCard[] = [
  {
    icon: FileText,
    title: 'docx',
    desc: '读取、生成与编辑 Word 文档,排版表格与图文。',
  },
  {
    icon: FileText,
    title: 'pdf',
    desc: '解析 PDF 内容,提取文本、表格并生成报告。',
  },
  {
    icon: Chrome,
    title: 'browser',
    desc: '驱动浏览器访问网页、点击与填写表单。',
  },
];

export default function SkillsView() {
  const { styles } = useStyles();

  return (
    <div className={styles.scroll}>
      <div className={styles.page}>
        <div className={styles.header}>
          <Text className={styles.title}>技能</Text>
          <Text className={styles.sub}>为 Snowan 安装技能,扩展它能做的事。</Text>
        </div>

        <Block variant="outlined" paddingBlock={32}>
          <Empty
            icon={Sparkles}
            title="还没有安装技能"
            description="从技能库里挑选,扩展助手的能力。"
            action={
              <Button type="primary" shape="round" icon={<Compass size={16} />}>
                浏览技能
              </Button>
            }
          />
        </Block>

        <Text className={styles.sectionLabel}>推荐技能</Text>
        <div className={styles.grid}>
          {SKILLS.map(({ icon: Icon, title, desc }) => (
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
