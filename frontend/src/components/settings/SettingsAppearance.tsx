import { useState } from 'react';
import { Segmented } from '@lobehub/ui';
import { Select, Switch } from 'antd';
import { createStyles } from 'antd-style';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { useThemeMode } from '../../theme/ThemeModeContext';
import { Row, Section } from './_kit';

const ACCENTS = ['#FF7F16', '#E5484D', '#3E63DD', '#30A46C', '#8E4EC6', '#F5B400'];

const useStyles = createStyles(({ css }) => ({
  wrap: css`
    display: flex;
    flex-direction: column;
    gap: 28px;
  `,
  seg: css`
    display: inline-flex;
    align-items: center;
    gap: 6px;
  `,
  swatches: css`
    display: flex;
    align-items: center;
    gap: 10px;
  `,
  swatch: css`
    width: 26px;
    height: 26px;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    transition:
      transform 0.12s ease,
      box-shadow 0.12s ease;
    &:hover {
      transform: scale(1.08);
    }
  `,
}));

export default function SettingsAppearance() {
  const { styles } = useStyles();
  const { isDark, toggle } = useThemeMode();

  const [font, setFont] = useState<'inter' | 'system'>('inter');
  const [lang, setLang] = useState('zh');
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>(
    isDark ? 'dark' : 'light',
  );
  const [accent, setAccent] = useState(ACCENTS[0]);
  const [showProviderIcons, setShowProviderIcons] = useState(true);
  const [richToolDesc, setRichToolDesc] = useState(true);

  const setMode = (m: 'light' | 'dark' | 'system') => {
    setThemeMode(m);
    const wantDark = m === 'dark';
    if (m !== 'system' && wantDark !== isDark) toggle();
  };

  return (
    <div className={styles.wrap}>
      <Section>
        <Row
          label="字体"
          subtitle="界面正文与标题使用的字体族"
          control={
            <Segmented
              value={font}
              onChange={(v) => setFont(v as 'inter' | 'system')}
              options={[
                { value: 'inter', label: 'Inter' },
                { value: 'system', label: '系统' },
              ]}
            />
          }
        />
        <Row
          label="语言"
          subtitle="应用界面的显示语言"
          control={
            <Select
              value={lang}
              onChange={setLang}
              style={{ width: 148 }}
              options={[
                { value: 'zh', label: '简体中文' },
                { value: 'en', label: 'English' },
              ]}
            />
          }
        />
      </Section>

      <Section title="主题" subtitle="外观与强调色">
        <Row
          label="外观"
          subtitle="选择浅色、深色或跟随系统设置"
          control={
            <Segmented
              value={themeMode}
              onChange={(v) => setMode(v as 'light' | 'dark' | 'system')}
              options={[
                {
                  value: 'light',
                  label: (
                    <span className={styles.seg}>
                      <Sun size={14} /> 浅色
                    </span>
                  ),
                },
                {
                  value: 'dark',
                  label: (
                    <span className={styles.seg}>
                      <Moon size={14} /> 深色
                    </span>
                  ),
                },
                {
                  value: 'system',
                  label: (
                    <span className={styles.seg}>
                      <Monitor size={14} /> 跟随系统
                    </span>
                  ),
                },
              ]}
            />
          }
        />
        <Row
          label="强调色"
          subtitle="用于按钮、链接与活跃状态"
          control={
            <div className={styles.swatches}>
              {ACCENTS.map((c) => (
                <span
                  key={c}
                  className={styles.swatch}
                  style={{
                    background: c,
                    boxShadow:
                      accent === c ? `0 0 0 2px ${c}55, 0 2px 8px ${c}40` : 'none',
                  }}
                  onClick={() => setAccent(c)}
                >
                  {accent === c && <Check size={15} strokeWidth={3} />}
                </span>
              ))}
            </div>
          }
        />
      </Section>

      <Section title="界面" subtitle="会话与工具的展示细节">
        <Row
          label="连接图标"
          subtitle="在会话列表和模型选择器中显示提供商图标"
          control={
            <Switch checked={showProviderIcons} onChange={setShowProviderIcons} />
          }
        />
        <Row
          label="丰富的工具描述"
          subtitle="为所有工具调用添加操作名称和意图描述"
          control={<Switch checked={richToolDesc} onChange={setRichToolDesc} />}
        />
      </Section>
    </div>
  );
}
