import { useState } from 'react';
import { Button, TextArea } from '@lobehub/ui';
import { createStyles } from 'antd-style';
import { ArrowUp, Square } from 'lucide-react';
import ModelSelect from './ModelSelect';

const useStyles = createStyles(({ token, css }) => ({
  wrap: css`
    width: 100%;
    max-width: 760px;
    margin: 0 auto;
    padding: 12px 16px 18px;
  `,
  card: css`
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 12px 10px;
    border-radius: 16px;
    background: ${token.colorBgElevated};
    border: 1px solid ${token.colorBorderSecondary};
    box-shadow: ${token.boxShadowTertiary};
    transition: border-color 0.15s ease;
    &:focus-within {
      border-color: ${token.colorPrimaryBorder};
    }
  `,
  ta: css`
    border: none !important;
    box-shadow: none !important;
    background: transparent !important;
    padding: 2px 4px 0 !important;
    resize: none;
    font-size: 15px;
  `,
  bottomRow: css`
    display: flex;
    align-items: center;
    gap: 8px;
  `,
  spacer: css`
    flex: 1;
  `,
  send: css`
    width: 32px;
    height: 32px;
    border-radius: 8px !important;
    display: inline-flex !important;
    align-items: center;
    justify-content: center;
    padding: 0 !important;
  `,
  hint: css`
    margin-top: 8px;
    text-align: center;
    font-size: 11px;
    color: ${token.colorTextQuaternary};
  `,
}));

export interface ComposerProps {
  busy: boolean;
  onSend: (text: string) => void;
  onStop?: () => void;
}

export default function Composer({ busy, onSend, onStop }: ComposerProps) {
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
      <div className={styles.card}>
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
        <div className={styles.bottomRow}>
          <span className={styles.spacer} />
          <ModelSelect />
          {busy && onStop ? (
            <Button
              type="primary"
              className={styles.send}
              onClick={onStop}
              title="停止"
              aria-label="停止"
              icon={<Square size={13} fill="currentColor" />}
            />
          ) : (
            <Button
              type="primary"
              className={styles.send}
              loading={busy}
              onClick={submit}
              title="发送"
              aria-label="发送"
              icon={busy ? undefined : <ArrowUp size={18} />}
            />
          )}
        </div>
      </div>
      <div className={styles.hint}>Enter 发送 · Shift + Enter 换行</div>
    </div>
  );
}
