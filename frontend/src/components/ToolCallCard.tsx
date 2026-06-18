import { useState } from 'react';
import { Block, Highlighter, Text } from '@lobehub/ui';
import { createStyles } from 'antd-style';
import type { ToolStep } from './types';

const useStyles = createStyles(({ token, css }) => ({
  card: css`
    width: 100%;
    border-radius: ${token.borderRadiusLG}px;
    overflow: hidden;
  `,
  head: css`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    cursor: pointer;
    user-select: none;
    transition: background 0.15s ease;
    &:hover {
      background: ${token.colorFillQuaternary};
    }
  `,
  dot: css`
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex: none;
    background: ${token.colorPrimary};
  `,
  spin: css`
    width: 12px;
    height: 12px;
    flex: none;
    border-radius: 50%;
    border: 2px solid ${token.colorFillSecondary};
    border-top-color: ${token.colorPrimary};
    animation: toolspin 0.8s linear infinite;
    @keyframes toolspin {
      to {
        transform: rotate(360deg);
      }
    }
  `,
  name: css`
    font-family: ${token.fontFamilyCode};
    font-size: 13px;
    font-weight: 600;
    color: ${token.colorText};
  `,
  chevron: css`
    margin-left: auto;
    font-size: 11px;
    color: ${token.colorTextTertiary};
  `,
  body: css`
    padding: 0 12px 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  `,
  label: css`
    font-size: 11px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: ${token.colorTextTertiary};
  `,
  code: css`
    font-size: 12px;
    max-height: 240px;
    overflow: auto;
  `,
}));

function pretty(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function looksLikeJson(text: string): boolean {
  const t = text.trim();
  return (t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'));
}

export default function ToolCallCard({ step }: { step: ToolStep }) {
  const { styles } = useStyles();
  const [open, setOpen] = useState(false);
  const running = step.result === undefined;
  const hasArgs = step.args && Object.keys(step.args).length > 0;

  return (
    <Block variant="outlined" className={styles.card}>
      <div className={styles.head} onClick={() => setOpen((v) => !v)}>
        {running ? <span className={styles.spin} /> : <span className={styles.dot} />}
        <Text className={styles.name}>{step.name}</Text>
        <Text className={styles.chevron}>{open ? '收起' : '展开'}</Text>
      </div>
      {open && (
        <div className={styles.body}>
          {hasArgs && (
            <>
              <span className={styles.label}>参数</span>
              <Highlighter
                language="json"
                variant="filled"
                copyable={false}
                className={styles.code}
              >
                {pretty(step.args)}
              </Highlighter>
            </>
          )}
          <span className={styles.label}>{running ? '运行中…' : '结果'}</span>
          {running ? (
            <Text className={styles.label}>…</Text>
          ) : (
            <Highlighter
              language={looksLikeJson(step.result ?? '') ? 'json' : 'text'}
              variant="filled"
              copyable
              className={styles.code}
            >
              {step.result ?? ''}
            </Highlighter>
          )}
        </div>
      )}
    </Block>
  );
}
