import { useEffect, useState } from 'react';
import { App, Input, Select } from 'antd';
import { createStyles } from 'antd-style';
import { Row, Section } from './_kit';
import { getPrefs, savePrefs, type Prefs } from '../../api/system';

const PROVIDERS = [
  { value: 'duckduckgo', label: 'DuckDuckGo（免费 · 免 key）' },
  { value: 'tavily', label: 'Tavily（推荐 · 每月 1000 次免费）' },
  { value: 'brave', label: 'Brave（自带 key）' },
];

const useStyles = createStyles(({ token, css }) => ({
  wrap: css`
    display: flex;
    flex-direction: column;
    gap: 28px;
  `,
  note: css`
    font-size: 12.5px;
    line-height: 1.6;
    color: ${token.colorTextTertiary};
    padding: 0 2px;
  `,
}));

export default function SettingsWeb() {
  const { styles } = useStyles();
  const { message } = App.useApp();
  const [p, setP] = useState<Prefs | null>(null);

  useEffect(() => {
    getPrefs().then(setP).catch(() => {});
  }, []);

  const save = async (patch: Partial<Prefs>) => {
    setP((prev) => (prev ? { ...prev, ...patch } : prev));
    try {
      await savePrefs(patch);
    } catch {
      message.error('保存失败');
    }
  };

  const keyField = (label: string, field: 'tavily_api_key' | 'brave_api_key' | 'jina_api_key', hint?: string) => (
    <Row
      label={label}
      subtitle={hint}
      control={
        <Input.Password
          style={{ width: 280 }}
          value={p?.[field] ?? ''}
          placeholder="粘贴 API Key"
          onChange={(e) => setP((prev) => (prev ? { ...prev, [field]: e.target.value } : prev))}
          onBlur={(e) => save({ [field]: e.target.value } as Partial<Prefs>)}
        />
      }
    />
  );

  return (
    <div className={styles.wrap}>
      <Section title="网页搜索" subtitle="助手联网搜索时用的引擎。没填 key 时默认用免费的 DuckDuckGo,首次即可用。">
        <Row
          label="搜索引擎"
          control={
            <Select
              style={{ width: 280 }}
              value={p?.web_search_provider ?? 'duckduckgo'}
              options={PROVIDERS}
              onChange={(v) => save({ web_search_provider: v })}
            />
          }
        />
        {p?.web_search_provider === 'tavily' &&
          keyField('Tavily API Key', 'tavily_api_key', 'app.tavily.com 注册,每月 1000 次免费、免信用卡')}
        {p?.web_search_provider === 'brave' &&
          keyField('Brave API Key', 'brave_api_key', 'api.search.brave.com')}
      </Section>

      <Section title="网页抓取" subtitle="抓取网页正文在本地完成(trafilatura)。JS 较重的页面会回退到 r.jina.ai。">
        {keyField('Jina API Key（可选）', 'jina_api_key', '留空也能用,填了抓取 JS 页面的速率更高')}
      </Section>

      <span className={styles.note}>
        web_search / web_fetch 是只读工具,会自动运行(不需确认),已列在「工具」里。
      </span>
    </div>
  );
}
