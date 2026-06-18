import { useEffect, useState } from 'react';
import { App, Tag } from 'antd';
import { createStyles } from 'antd-style';
import { Row, Section } from './_kit';
import { getTools, type ToolInfo } from '../../api/system';

const useStyles = createStyles(({ token, css }) => ({
  wrap: css`
    display: flex;
    flex-direction: column;
    gap: 28px;
  `,
  toolName: css`
    font-family: ${token.fontFamilyCode};
    font-size: 13px;
    color: ${token.colorText};
  `,
}));

export default function SettingsTools() {
  const { styles } = useStyles();
  const { message } = App.useApp();
  const [tools, setTools] = useState<ToolInfo[]>([]);

  useEffect(() => {
    getTools()
      .then(setTools)
      .catch(() => message.error('加载工具列表失败'));
  }, [message]);

  return (
    <div className={styles.wrap}>
      <Section
        title="可用工具"
        subtitle="可写工具是否需要确认由「权限」里的审批模式决定。"
      >
        {tools.map((tool) => (
          <Row
            key={tool.name}
            label={<span className={styles.toolName}>{tool.name}</span>}
            subtitle={tool.description}
            control={
              tool.mutating ? (
                <Tag color="warning">可写</Tag>
              ) : (
                <Tag color="success">只读</Tag>
              )
            }
          />
        ))}
      </Section>
    </div>
  );
}
