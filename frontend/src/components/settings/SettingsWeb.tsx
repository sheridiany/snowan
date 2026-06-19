import { useEffect, useState } from 'react';
import { App, Select } from 'antd';
import { createStyles } from 'antd-style';
import { Row, Section, SecretField } from './_kit';
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

  const setProvider = async (v: string) => {
    setP((prev) => (prev ? { ...prev, web_search_provider: v } : prev));
    try {
      await savePrefs({ web_search_provider: v });
      message.success('已保存');
    } catch {
      message.error('保存失败');
    }
  };

  const saveKey = (field: 'tavily_api_key' | 'brave_api_key' | 'jina_api_key') => async (val: string) => {
    await savePrefs({ [field]: val } as Partial<Prefs>);
    setP((prev) => (prev ? { ...prev, [field]: val } : prev));
  };

  return (
    <div className={styles.wrap}>
      <Section
        title="网页搜索"
        subtitle="助手联网搜索时用的引擎。没填 key 时默认用免费的 DuckDuckGo,首次即可用。"
      >
        <Row
          label="搜索引擎"
          control={
            <Select
              style={{ width: 260 }}
              value={p?.web_search_provider ?? 'duckduckgo'}
              options={PROVIDERS}
              onChange={setProvider}
            />
          }
        />
        {p?.web_search_provider === 'tavily' && (
          <Row
            label="Tavily API Key"
            subtitle="在 app.tavily.com 注册,每月 1000 次免费、免信用卡"
            control={<SecretField value={p.tavily_api_key} onSave={saveKey('tavily_api_key')} />}
          />
        )}
        {p?.web_search_provider === 'brave' && (
          <Row
            label="Brave API Key"
            subtitle="在 api.search.brave.com 获取"
            control={<SecretField value={p.brave_api_key} onSave={saveKey('brave_api_key')} />}
          />
        )}
      </Section>

      <Section title="网页抓取" subtitle="抓取网页正文在本地完成(trafilatura);JS 较重的页面会回退到 r.jina.ai。">
        <Row
          label="Jina API Key（可选）"
          subtitle="留空也能用,填了抓取 JS 页面的速率更高"
          control={<SecretField value={p?.jina_api_key ?? ''} onSave={saveKey('jina_api_key')} />}
        />
      </Section>

      <span className={styles.note}>
        填好 key 会显示「已保存 ✓」并长期保留,下次进来无需重填。web_search / web_fetch 是只读工具、自动运行,已列在「工具」里。
      </span>
    </div>
  );
}
