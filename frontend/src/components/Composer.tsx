import { useState } from 'react';
import { Button, TextArea } from '@lobehub/ui';
import { createStyles } from 'antd-style';

const useStyles = createStyles(({ token, css }) => ({
  wrap: css`
    width: 100%;
    max-width: 760px;
    margin: 0 auto;
    padding: 12px 16px 22px;
  `,
  bar: css`
    display: flex;
    gap: 8px;
    align-items: flex-end;
    padding: 8px;
    border-radius: ${token.borderRadiusLG + 4}px;
    background: ${token.colorBgContainer};
    border: 1px solid ${token.colorBorderSecondary};
    box-shadow: 0 6px 24px ${token.colorFillQuaternary};
  `,
  ta: css`
    flex: 1;
    border: none !important;
    box-shadow: none !important;
    background: transparent !important;
    resize: none;
  `,
  hint: css`
    margin-top: 6px;
    text-align: center;
    font-size: 11px;
    color: ${token.colorTextQuaternary};
  `,
}));

export default function Composer({
  busy,
  onSend,
}: {
  busy: boolean;
  onSend: (text: string) => void;
}) {
  const { styles } = useStyles();
  const [value, setValue] = useState('');

  const submit = () => {
    const text = value.trim();
    if (!text || busy) return;
    setValue('');
    onSend(text);
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.bar}>
        <TextArea
          className={styles.ta}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onPressEnter={(e) => {
            if (!e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          autoSize={{ minRows: 1, maxRows: 8 }}
          placeholder="问点什么…"
        />
        <Button type="primary" shape="round" loading={busy} onClick={submit}>
          发送
        </Button>
      </div>
      <div className={styles.hint}>Enter 发送 · Shift + Enter 换行</div>
    </div>
  );
}
