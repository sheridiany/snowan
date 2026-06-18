import { useState } from 'react';
import { Block, Segmented, Text } from '@lobehub/ui';
import { Switch } from 'antd';
import { createStyles } from 'antd-style';

const useStyles = createStyles(({ token, css }) => ({
  card: css`
    padding: 18px;
    border-radius: ${token.borderRadiusLG}px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  `,
  title: css`
    font-size: 14px;
    font-weight: 600;
    color: ${token.colorText};
  `,
  row: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  `,
  rowText: css`
    display: flex;
    flex-direction: column;
    gap: 2px;
  `,
  label: css`
    font-size: 13px;
    font-weight: 500;
    color: ${token.colorText};
  `,
  sub: css`
    font-size: 12px;
    color: ${token.colorTextTertiary};
  `,
  divider: css`
    height: 1px;
    background: ${token.colorBorderSecondary};
  `,
}));

export default function SettingsPreferences() {
  const { styles } = useStyles();
  const [lang, setLang] = useState<'zh' | 'en'>('zh');
  const [enterToSend, setEnterToSend] = useState(true);
  const [sound, setSound] = useState(false);

  return (
    <Block variant="outlined" className={styles.card}>
      <Text className={styles.title}>偏好</Text>

      <div className={styles.row}>
        <div className={styles.rowText}>
          <span className={styles.label}>界面语言</span>
          <span className={styles.sub}>切换应用显示语言</span>
        </div>
        <Segmented
          value={lang}
          onChange={(v) => setLang(v as 'zh' | 'en')}
          options={[
            { value: 'zh', label: '中文' },
            { value: 'en', label: 'English' },
          ]}
        />
      </div>

      <div className={styles.divider} />

      <div className={styles.row}>
        <div className={styles.rowText}>
          <span className={styles.label}>Enter 发送</span>
          <span className={styles.sub}>关闭后使用 ⌘ + Enter 发送</span>
        </div>
        <Switch checked={enterToSend} onChange={setEnterToSend} />
      </div>

      <div className={styles.divider} />

      <div className={styles.row}>
        <div className={styles.rowText}>
          <span className={styles.label}>完成提示音</span>
          <span className={styles.sub}>回复结束时播放提示音</span>
        </div>
        <Switch checked={sound} onChange={setSound} />
      </div>
    </Block>
  );
}
