import { useState } from 'react';
import { Button } from 'antd';
import { createStyles } from 'antd-style';
import { Sparkles } from 'lucide-react';

import { savePrefs } from '../../api/system';
import PersonaInterview from './PersonaInterview';

// A calm, dismissible invitation shown at the top of the daily panel only while
// the user hasn't onboarded. It opens the interview or, on 以后再说, sets onboarded
// so it stops appearing. Never a modal gate — just a soft card.

const useStyles = createStyles(({ token, css }) => ({
  card: css`
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0 0 10px;
    padding: 12px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorFillQuaternary};
  `,
  head: css`
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 600;
    color: ${token.colorText};
  `,
  sub: css`
    font-size: 12px;
    line-height: 1.6;
    color: ${token.colorTextTertiary};
  `,
  actions: css`
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 2px;
  `,
}));

export default function PersonaNudge({ onDone }: { onDone?: () => void }) {
  const { styles, theme } = useStyles();
  const [open, setOpen] = useState(false);

  const later = async () => {
    try {
      await savePrefs({ onboarded: true });
    } catch {
      /* hiding locally is enough; a failed flag just shows the card next launch */
    }
    onDone?.();
  };

  return (
    <>
      <div className={styles.card}>
        <div className={styles.head}>
          <Sparkles size={14} color={theme.colorPrimary} />
          花 2 分钟让 Snowan 更懂你?
        </div>
        <div className={styles.sub}>
          聊几句你在意的事,Snowan 会据此为你起草一份画像,以后的建议会更贴合你。
        </div>
        <div className={styles.actions}>
          <Button type="primary" size="small" onClick={() => setOpen(true)}>
            开始
          </Button>
          <Button type="text" size="small" onClick={later}>
            以后再说
          </Button>
        </div>
      </div>
      <PersonaInterview
        open={open}
        onClose={() => {
          setOpen(false);
          onDone?.();
        }}
      />
    </>
  );
}
