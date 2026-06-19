import { useEffect, useState } from 'react';
import { App, Input, InputNumber, Switch } from 'antd';
import { createStyles } from 'antd-style';
import { Row, Section } from './_kit';
import { getPrefs, savePrefs, type Prefs } from '../../api/system';

const useStyles = createStyles(({ css }) => ({
  wrap: css`
    display: flex;
    flex-direction: column;
    gap: 28px;
  `,
  textarea: css`
    width: 100%;
  `,
}));

export default function SettingsRun() {
  const { styles } = useStyles();
  const { message } = App.useApp();
  const [prefs, setPrefs] = useState<Prefs | null>(null);

  useEffect(() => {
    getPrefs().then(setPrefs);
  }, []);

  const persist = async (patch: Partial<Prefs>) => {
    const next = await savePrefs(patch);
    setPrefs(next);
    message.success('已保存');
  };

  if (!prefs) return null;

  return (
    <div className={styles.wrap}>
      <Section title="运行">
        <Row
          label="最大迭代步数"
          control={
            <InputNumber
              min={1}
              max={200}
              value={prefs.max_iters}
              onChange={(v) => {
                if (v != null) persist({ max_iters: v });
              }}
            />
          }
        />
        <Row
          label="时区"
          subtitle="时间工具默认使用的时区"
          control={
            <Input
              value={prefs.timezone}
              placeholder="Asia/Shanghai"
              style={{ width: 200 }}
              onChange={(e) =>
                setPrefs({ ...prefs, timezone: e.target.value })
              }
              onBlur={(e) => persist({ timezone: e.target.value })}
            />
          }
        />
        <Row
          label="自动生成标题"
          control={
            <Switch
              checked={prefs.auto_title}
              onChange={(v) => persist({ auto_title: v })}
            />
          }
        />
      </Section>

      <Section
        title="附加系统指令"
        subtitle="追加到系统提示,影响助手的风格与行为"
        bare
      >
        <Input.TextArea
          className={styles.textarea}
          autoSize={{ minRows: 3, maxRows: 8 }}
          value={prefs.system_prompt}
          onChange={(e) =>
            setPrefs({ ...prefs, system_prompt: e.target.value })
          }
          onBlur={(e) => persist({ system_prompt: e.target.value })}
        />
      </Section>
    </div>
  );
}
