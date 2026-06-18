import { Block, Button, Text } from '@lobehub/ui';
import { createStyles } from 'antd-style';
import type { ApprovalCall } from './types';

const useStyles = createStyles(({ token, css }) => ({
  card: css`
    width: 100%;
    border-radius: ${token.borderRadiusLG}px;
    overflow: hidden;
    border-color: ${token.colorWarningBorder};
    background: ${token.colorWarningBg};
  `,
  head: css`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
  `,
  dot: css`
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex: none;
    background: ${token.colorWarning};
  `,
  title: css`
    font-size: 12px;
    font-weight: 600;
    color: ${token.colorWarningText};
  `,
  status: css`
    margin-left: auto;
    font-size: 12px;
    font-weight: 600;
  `,
  approved: css`
    color: ${token.colorSuccess};
  `,
  denied: css`
    color: ${token.colorError};
  `,
  body: css`
    padding: 0 12px 10px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  `,
  call: css`
    display: flex;
    flex-direction: column;
    gap: 6px;
  `,
  name: css`
    font-family: ${token.fontFamilyCode};
    font-size: 13px;
    font-weight: 600;
    color: ${token.colorText};
  `,
  label: css`
    font-size: 11px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: ${token.colorTextTertiary};
  `,
  pre: css`
    margin: 0;
    padding: 8px 10px;
    border-radius: ${token.borderRadius}px;
    background: ${token.colorFillQuaternary};
    font-family: ${token.fontFamilyCode};
    font-size: 12px;
    line-height: 1.6;
    color: ${token.colorTextSecondary};
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 240px;
    overflow: auto;
  `,
  actions: css`
    display: flex;
    gap: 8px;
    padding: 0 12px 12px;
  `,
}));

function pretty(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

type Props = {
  calls: ApprovalCall[];
  decided?: boolean;
  approved?: boolean;
  onDecide?: (approve: boolean) => void;
};

export default function ApprovalCard({ calls, decided, approved, onDecide }: Props) {
  const { styles, cx } = useStyles();

  return (
    <Block variant="outlined" className={styles.card}>
      <div className={styles.head}>
        <span className={styles.dot} />
        <Text className={styles.title}>需要确认</Text>
        {decided && (
          <Text className={cx(styles.status, approved ? styles.approved : styles.denied)}>
            {approved ? '已允许' : '已拒绝'}
          </Text>
        )}
      </div>
      <div className={styles.body}>
        {calls.map((call) => {
          const hasArgs = call.args && Object.keys(call.args).length > 0;
          return (
            <div key={call.id} className={styles.call}>
              <Text className={styles.name}>{call.name}</Text>
              {hasArgs && (
                <>
                  <span className={styles.label}>参数</span>
                  <pre className={styles.pre}>{pretty(call.args)}</pre>
                </>
              )}
            </div>
          );
        })}
      </div>
      {!decided && (
        <div className={styles.actions}>
          <Button type="primary" size="small" onClick={() => onDecide?.(true)}>
            允许
          </Button>
          <Button size="small" onClick={() => onDecide?.(false)}>
            拒绝
          </Button>
        </div>
      )}
    </Block>
  );
}
