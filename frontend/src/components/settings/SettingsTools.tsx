import { useEffect, useState } from 'react';
import { App, Switch, Tag } from 'antd';
import { createStyles } from 'antd-style';
import { Row, Section } from './_kit';
import { getTools, savePrefs, type ToolInfo } from '../../api/system';

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
  control: css`
    display: inline-flex;
    align-items: center;
    gap: 10px;
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

  const toggle = async (t: ToolInfo) => {
    const next = tools.map((x) => (x.name === t.name ? { ...x, enabled: !x.enabled } : x));
    setTools(next);
    try {
      await savePrefs({ disabled_tools: next.filter((x) => !x.enabled).map((x) => x.name) });
    } catch {
      message.error('保存失败');
    }
  };

  return (
    <div className={styles.wrap}>
      <Section
        title="可用工具"
        subtitle="关掉的工具助手就用不了;可写工具是否需要确认由「权限」的审批模式决定。"
      >
        {tools.map((tool) => (
          <Row
            key={tool.name}
            label={<span className={styles.toolName}>{tool.name}</span>}
            subtitle={tool.description}
            control={
              <span className={styles.control}>
                {tool.mutating ? <Tag color="warning">可写</Tag> : <Tag color="success">只读</Tag>}
                <Switch size="small" checked={tool.enabled} onChange={() => toggle(tool)} />
              </span>
            }
          />
        ))}
      </Section>
    </div>
  );
}
