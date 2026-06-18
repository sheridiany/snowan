import { useState } from 'react';
import { Button, Icon, Text } from '@lobehub/ui';
import { createStyles } from 'antd-style';
import { Chrome, Download, FileText, FileType } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { ListPane, ListRow } from '../shell/ListPane';

type Skill = {
  id: string;
  name: string;
  icon: LucideIcon;
  short: string;
  desc: string;
};

const SKILLS: Skill[] = [
  {
    id: 'docx',
    name: 'docx',
    icon: FileText,
    short: 'Word 文档',
    desc: '读取、生成与编辑 Word 文档,排版表格与图文,导出可直接发送的成稿。',
  },
  {
    id: 'pdf',
    name: 'pdf',
    icon: FileType,
    short: 'PDF 解析',
    desc: '解析 PDF 内容,提取文本、表格与结构,基于原文生成摘要或报告。',
  },
  {
    id: 'browser',
    name: 'browser',
    icon: Chrome,
    short: '浏览器自动化',
    desc: '驱动浏览器访问网页、点击与填写表单,把网页操作交给助手完成。',
  },
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
    max-width: 680px;
    margin: 0 auto;
    padding: 32px;
    display: flex;
    flex-direction: column;
    gap: 18px;
  `,
  hero: css`
    display: flex;
    align-items: center;
    gap: 16px;
  `,
  heroIcon: css`
    width: 56px;
    height: 56px;
    flex: none;
    border-radius: ${token.borderRadiusLG}px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: ${token.colorPrimaryBg};
    color: ${token.colorPrimary};
  `,
  heroName: css`
    font-size: 20px;
    font-weight: 700;
    color: ${token.colorText};
  `,
  heroShort: css`
    font-size: 13px;
    color: ${token.colorTextTertiary};
  `,
  desc: css`
    font-size: 14px;
    line-height: 1.7;
    color: ${token.colorTextSecondary};
  `,
  card: css`
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorFillQuaternary};
    padding: 18px 20px;
    font-size: 13px;
    line-height: 1.7;
    color: ${token.colorTextTertiary};
  `,
}));

export default function SkillsView({ listCollapsed }: { listCollapsed?: boolean }) {
  const { styles } = useStyles();
  const [activeId, setActiveId] = useState(SKILLS[0].id);
  const active = SKILLS.find((s) => s.id === activeId) ?? SKILLS[0];

  return (
    <>
      {!listCollapsed && (
        <ListPane title="技能">
          {SKILLS.map((s) => (
            <ListRow
              key={s.id}
              icon={s.icon}
              label={s.name}
              sub={s.short}
              active={s.id === activeId}
              onClick={() => setActiveId(s.id)}
            />
          ))}
        </ListPane>
      )}

      <div className={styles.detail}>
        <div className={styles.detailHeader}>
          <span className={styles.detailTitle}>{active.name}</span>
          <Button type="primary" size="small" icon={<Icon icon={Download} size={15} />}>
            安装
          </Button>
        </div>
        <div className={styles.detailScroll}>
          <div className={styles.detailInner}>
            <div className={styles.hero}>
              <div className={styles.heroIcon}>
                <Icon icon={active.icon} size={28} />
              </div>
              <div>
                <div className={styles.heroName}>{active.name}</div>
                <div className={styles.heroShort}>{active.short}</div>
              </div>
            </div>
            <Text className={styles.desc}>{active.desc}</Text>
            <div className={styles.card}>
              该技能尚未安装。安装后,助手会在合适的会话里自动调用它 —— 你也可以在权限设置里控制它的执行范围。
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
