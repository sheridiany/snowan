import { useState } from 'react';
import { Block, Button, Text } from '@lobehub/ui';
import { createStyles } from 'antd-style';
import { Bot, Brain, Globe, Sparkles } from 'lucide-react';
import type { ComponentType } from 'react';

type Provider = {
  id: string;
  name: string;
  desc: string;
  icon: ComponentType<{ size?: number }>;
  configured: boolean;
};

const PROVIDERS: Provider[] = [
  { id: 'openai', name: 'OpenAI', desc: 'GPT 系列模型', icon: Sparkles, configured: true },
  { id: 'anthropic', name: 'Anthropic', desc: 'Claude 系列模型', icon: Bot, configured: true },
  { id: 'gemini', name: 'Gemini', desc: 'Google 多模态模型', icon: Brain, configured: false },
  { id: 'openrouter', name: 'OpenRouter', desc: '聚合多家模型路由', icon: Globe, configured: false },
];

const useStyles = createStyles(({ token, css }) => ({
  wrap: css`
    display: flex;
    flex-direction: column;
    gap: 14px;
  `,
  header: css`
    display: flex;
    flex-direction: column;
    gap: 2px;
  `,
  title: css`
    font-size: 14px;
    font-weight: 600;
    color: ${token.colorText};
  `,
  note: css`
    font-size: 12px;
    color: ${token.colorTextTertiary};
    line-height: 1.6;
  `,
  list: css`
    display: flex;
    flex-direction: column;
    gap: 10px;
  `,
  card: css`
    padding: 14px 16px;
    border-radius: ${token.borderRadiusLG}px;
    display: flex;
    align-items: center;
    gap: 14px;
  `,
  badge: css`
    width: 38px;
    height: 38px;
    flex: none;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: ${token.colorPrimary};
    background: ${token.colorFillQuaternary};
  `,
  meta: css`
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  `,
  name: css`
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 600;
    color: ${token.colorText};
  `,
  desc: css`
    font-size: 12px;
    color: ${token.colorTextTertiary};
  `,
  dot: css`
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex: none;
  `,
  dotOn: css`
    background: #2faa6e;
    box-shadow: 0 0 0 3px rgba(47, 170, 110, 0.18);
  `,
  dotOff: css`
    background: ${token.colorTextQuaternary};
  `,
  spacer: css`
    flex: 1;
  `,
}));

export default function SettingsAI() {
  const { styles, cx } = useStyles();
  const [active, setActive] = useState<string | null>(null);

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <Text className={styles.title}>模型与连接</Text>
        <Text className={styles.note}>
          连接你的模型提供方。当前 API Key 保存在后端 .env 中,前端仅展示连接状态。
        </Text>
      </div>

      <div className={styles.list}>
        {PROVIDERS.map((p) => {
          const Icon = p.icon;
          return (
            <Block key={p.id} variant="outlined" className={styles.card}>
              <span className={styles.badge}>
                <Icon size={18} />
              </span>
              <div className={styles.meta}>
                <span className={styles.name}>
                  {p.name}
                  <span
                    className={cx(styles.dot, p.configured ? styles.dotOn : styles.dotOff)}
                  />
                </span>
                <span className={styles.desc}>{p.desc}</span>
              </div>
              <span className={styles.spacer} />
              <Button
                size="small"
                shape="round"
                type={active === p.id ? 'primary' : 'default'}
                onClick={() => setActive((cur) => (cur === p.id ? null : p.id))}
              >
                配置
              </Button>
            </Block>
          );
        })}
      </div>
    </div>
  );
}
