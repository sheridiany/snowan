import { useState } from 'react';
import { Button, Tag, Text } from '@lobehub/ui';
import { Select } from 'antd';
import { createStyles } from 'antd-style';
import { Info } from 'lucide-react';
import { Row, Section } from './_kit';

type Provider = {
  id: string;
  name: string;
  desc: string;
  brand: string;
  configured: boolean;
};

const PROVIDERS: Provider[] = [
  { id: 'openai', name: 'OpenAI', desc: 'GPT 系列模型', brand: '#10A37F', configured: true },
  { id: 'anthropic', name: 'Anthropic', desc: 'Claude 系列模型', brand: '#D97757', configured: true },
  { id: 'gemini', name: 'Gemini', desc: 'Google 多模态模型', brand: '#4285F4', configured: false },
  { id: 'openrouter', name: 'OpenRouter', desc: '聚合多家模型路由', brand: '#8E8EA0', configured: false },
];

const MODELS = [
  { value: 'claude-opus-4', label: 'Claude Opus 4' },
  { value: 'claude-sonnet-4', label: 'Claude Sonnet 4' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gemini-2-flash', label: 'Gemini 2.0 Flash' },
];

const useStyles = createStyles(({ token, css }) => ({
  wrap: css`
    display: flex;
    flex-direction: column;
    gap: 28px;
  `,
  note: css`
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 14px 16px;
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorFillQuaternary};
  `,
  noteIcon: css`
    flex: none;
    margin-top: 1px;
    color: ${token.colorPrimary};
    display: inline-flex;
  `,
  noteText: css`
    font-size: 12.5px;
    line-height: 1.65;
    color: ${token.colorTextSecondary};
  `,
  dot: css`
    width: 9px;
    height: 9px;
    border-radius: 50%;
    flex: none;
  `,
}));

export default function SettingsAI() {
  const { styles } = useStyles();
  const [defaultModel, setDefaultModel] = useState('claude-opus-4');

  return (
    <div className={styles.wrap}>
      <div className={styles.note}>
        <span className={styles.noteIcon}>
          <Info size={16} />
        </span>
        <Text className={styles.noteText}>
          密钥目前保存在后端 <code>.env</code> 中,前端仅展示连接状态。配置面板用于查看每个
          提供商的连接情况,实际密钥写入由后端负责。
        </Text>
      </div>

      <Section title="提供商" subtitle="连接你的模型提供方">
        {PROVIDERS.map((p) => (
          <Row
            key={p.id}
            icon={<span className={styles.dot} style={{ background: p.brand }} />}
            label={p.name}
            subtitle={p.desc}
            control={
              <>
                {p.configured ? (
                  <Tag color="success">已连接</Tag>
                ) : (
                  <Tag>未配置</Tag>
                )}
                <Button size="small">
                  配置
                </Button>
              </>
            }
          />
        ))}
      </Section>

      <Section title="默认模型" subtitle="新会话默认使用的模型">
        <Row
          label="默认模型"
          subtitle="可在单个会话中临时切换"
          control={
            <Select
              value={defaultModel}
              onChange={setDefaultModel}
              style={{ width: 200 }}
              options={MODELS}
            />
          }
        />
      </Section>
    </div>
  );
}
