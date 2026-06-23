import { useState } from 'react';
import { Segmented, ThemeSwitch } from '@lobehub/ui';
import { Select, Switch } from 'antd';
import { createStyles, cx, useThemeMode } from 'antd-style';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { Row, Section } from './_kit';
import { THEME_PRESETS, useThemePreset } from '../../theme/themes';
import { EASING } from '../../ui/motion';

const useStyles = createStyles(({ token, css }) => ({
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
  grid: css`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(134px, 1fr));
    gap: 12px;
  `,
  preset: css`
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px;
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorBgContainer};
    box-shadow: ${token.boxShadowTertiary};
    cursor: pointer;
    text-align: left;
    border: none;
    transition: transform 0.16s ${EASING.standard},
      box-shadow 0.16s ${EASING.standard};
    &:hover {
      transform: translateY(-2px);
      box-shadow: ${token.boxShadowSecondary};
    }
    @media (prefers-reduced-motion: reduce) {
      transition: box-shadow 0.16s ${EASING.standard};
      &:hover {
        transform: none;
      }
    }
  `,
  presetActive: css`
    box-shadow: ${token.boxShadowTertiary}, 0 0 0 2px ${token.colorPrimary};
    &:hover {
      box-shadow: ${token.boxShadowSecondary}, 0 0 0 2px ${token.colorPrimary};
    }
  `,
  // A miniature "window" rendered in the preset's own palette.
  preview: css`
    position: relative;
    height: 58px;
    border-radius: 8px;
    padding: 10px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 6px;
    overflow: hidden;
  `,
  dot: css`
    position: absolute;
    top: 8px;
    right: 8px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
  `,
  bar: css`
    height: 5px;
    border-radius: 3px;
  `,
  name: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    padding: 0 2px;
    font-size: 12.5px;
    font-weight: 500;
    color: ${token.colorText};
  `,
  check: css`
    display: inline-flex;
    color: ${token.colorPrimary};
  `,
}));

export default function SettingsAppearance() {
  const { styles } = useStyles();
  const { themeMode, setThemeMode } = useThemeMode();
  const [themeId, setThemeId] = useThemePreset();

  // Render each preset preview in the palette that matches the live appearance.
  const appearance =
    themeMode === 'auto'
      ? typeof window !== 'undefined' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : themeMode;

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

      <Section title="外观" subtitle="浅色、深色或跟随系统">
        <Row
          label="模式"
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
              <ThemeSwitch themeMode={themeMode} onThemeSwitch={setThemeMode} />
            </div>
          }
        />
      </Section>

      <Section title="配色预设" subtitle="整套配色方案,作用于整个应用" bare>
        <div className={styles.grid}>
          {THEME_PRESETS.map((t) => {
            const pal = appearance === 'dark' ? t.dark : t.light;
            const active = t.id === themeId;
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={active}
                className={cx(styles.preset, active && styles.presetActive)}
                onClick={() => setThemeId(t.id)}
              >
                <div
                  className={styles.preview}
                  style={{ background: pal.surface, border: `1px solid ${pal.border}` }}
                >
                  <span className={styles.dot} style={{ background: pal.accent }} />
                  <span
                    className={styles.bar}
                    style={{ background: pal.text, width: '62%' }}
                  />
                  <span
                    className={styles.bar}
                    style={{ background: pal.textTertiary, width: '42%' }}
                  />
                  <span
                    className={styles.bar}
                    style={{ background: pal.accent, width: '30%', height: 6 }}
                  />
                </div>
                <span className={styles.name}>
                  {t.name}
                  {active && (
                    <span className={styles.check}>
                      <Check size={14} strokeWidth={2.5} />
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
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
