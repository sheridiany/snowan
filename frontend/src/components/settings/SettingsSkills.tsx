import { Button, Icon } from '@lobehub/ui';
import { createStyles } from 'antd-style';
import { Chrome, Download, FileText, FileType } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Row, Section } from './_kit';

type Skill = {
  id: string;
  name: string;
  icon: LucideIcon;
  desc: string;
};

const SKILLS: Skill[] = [
  {
    id: 'docx',
    name: 'docx',
    icon: FileText,
    desc: '读取、生成与编辑 Word 文档,排版表格与图文,导出可直接发送的成稿。',
  },
  {
    id: 'pdf',
    name: 'pdf',
    icon: FileType,
    desc: '解析 PDF 内容,提取文本、表格与结构,基于原文生成摘要或报告。',
  },
  {
    id: 'browser',
    name: 'browser',
    icon: Chrome,
    desc: '驱动浏览器访问网页、点击与填写表单,把网页操作交给助手完成。',
  },
];

const useStyles = createStyles(({ token, css }) => ({
  wrap: css`
    display: flex;
    flex-direction: column;
    gap: 28px;
  `,
  name: css`
    font-family: ${token.fontFamilyCode};
    font-size: 13px;
    color: ${token.colorText};
  `,
}));

export default function SettingsSkills() {
  const { styles } = useStyles();

  return (
    <div className={styles.wrap}>
      <Section
        title="技能"
        subtitle="安装后,助手会在合适的会话里自动调用它 —— 执行范围由「权限」控制。"
      >
        {SKILLS.map((skill) => (
          <Row
            key={skill.id}
            icon={<Icon icon={skill.icon} size={16} />}
            label={<span className={styles.name}>{skill.name}</span>}
            subtitle={skill.desc}
            control={
              <Button size="small" icon={<Icon icon={Download} size={14} />}>
                安装
              </Button>
            }
          />
        ))}
      </Section>
    </div>
  );
}
