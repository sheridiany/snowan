import { useState } from 'react';
import { Segmented } from '@lobehub/ui';
import { Switch } from 'antd';
import { createStyles } from 'antd-style';
import { Row, Section } from './_kit';

const useStyles = createStyles(({ css }) => ({
  wrap: css`
    display: flex;
    flex-direction: column;
    gap: 28px;
  `,
}));

export default function SettingsPreferences() {
  const { styles } = useStyles();
  const [lang, setLang] = useState<'zh' | 'en'>('zh');
  const [enterToSend, setEnterToSend] = useState(true);
  const [sound, setSound] = useState(false);
  const [autoTitle, setAutoTitle] = useState(true);

  return (
    <div className={styles.wrap}>
      <Section title="通用" subtitle="语言与会话行为">
        <Row
          label="语言"
          subtitle="切换应用显示语言"
          control={
            <Segmented
              value={lang}
              onChange={(v) => setLang(v as 'zh' | 'en')}
              options={[
                { value: 'zh', label: '中文' },
                { value: 'en', label: 'English' },
              ]}
            />
          }
        />
        <Row
          label="Enter 发送"
          subtitle="关闭后使用 ⌘ + Enter 发送"
          control={<Switch checked={enterToSend} onChange={setEnterToSend} />}
        />
        <Row
          label="完成提示音"
          subtitle="回复结束时播放提示音"
          control={<Switch checked={sound} onChange={setSound} />}
        />
        <Row
          label="自动生成标题"
          subtitle="根据首条消息为会话生成标题"
          control={<Switch checked={autoTitle} onChange={setAutoTitle} />}
        />
      </Section>
    </div>
  );
}
