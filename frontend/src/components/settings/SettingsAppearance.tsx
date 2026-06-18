import { useState } from 'react';
import { Segmented, ThemeSwitch } from '@lobehub/ui';
import { Select, Switch } from 'antd';
import { createStyles } from 'antd-style';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useThemeMode } from 'antd-style';
import { Row, Section } from './_kit';
import { THEME_PRESETS, useThemePreset } from '../../theme/themes';

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
  accentRow: css`
    display: flex;
    align-items: center;
    gap: 14px;
  `,
}));

export default function SettingsAppearance() {
  const { styles } = useStyles();
  const { themeMode, setThemeMode } = useThemeMode();
  const [themeId, setThemeId] = useThemePreset();

  const [font, setFont] = useState<'inter' | 'system'>('inter');
  const [lang, setLang] = useState('zh');
  const [showProviderIcons, setShowProviderIcons] = useState(true);
  const [richToolDesc, setRichToolDesc] = useState(true);

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
            <div className={styles.accentRow}>
              <Segmented
                value={themeMode}
                onChange={(v) => setThemeMode(v as 'light' | 'dark' | 'auto')}
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
                    value: 'auto',
                    label: (
                      <span className={styles.seg}>
                        <Monitor size={14} /> 跟随系统
                      </span>
                    ),
                  },
                ]}
              />
              <ThemeSwitch
                themeMode={themeMode}
                onThemeSwitch={setThemeMode}
              />
            </div>
          }
        />
        <Row
          label="主题"
          subtitle="整套配色方案,作用于整个应用"
          control={
            <Select
              value={themeId}
              onChange={setThemeId}
              showSearch
              optionFilterProp="label"
              style={{ width: 180 }}
              options={THEME_PRESETS.map((t) => ({ value: t.id, label: t.name }))}
            />
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
