import { Button, Text } from '@lobehub/ui';
import { createStyles } from 'antd-style';
import { ShieldAlert } from 'lucide-react';

const useStyles = createStyles(({ token, css }) => ({
  bar: css`
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px 8px 12px;
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorWarningBg};
    border: 1px solid ${token.colorWarningBorder};
  `,
  icon: css`
    flex: none;
    color: ${token.colorWarning};
    display: inline-flex;
  `,
  text: css`
    flex: 1;
    min-width: 0;
    font-size: 12.5px;
    color: ${token.colorWarningText};
  `,
  actions: css`
    flex: none;
    display: flex;
    gap: 8px;
  `,
}));

// Shown once below the pending tool rows of a paused turn. Allow / 拒绝 resolves
// every pending call at once; the rows then transition in place, so this bar
// just disappears — no lingering JSON dump.
export default function ApprovalCard({
  count,
  onDecide,
}: {
  count: number;
  onDecide: (approve: boolean) => void;
}) {
  const { styles } = useStyles();
  return (
    <div className={styles.bar}>
      <span className={styles.icon}>
        <ShieldAlert size={16} />
      </span>
      <Text className={styles.text}>
        {count > 1 ? `助手想执行 ${count} 个操作,需要你确认` : '助手想执行此操作,需要你确认'}
      </Text>
      <div className={styles.actions}>
        <Button type="primary" size="small" onClick={() => onDecide(true)}>
          允许
        </Button>
        <Button size="small" onClick={() => onDecide(false)}>
          拒绝
        </Button>
      </div>
    </div>
  );
}
