import { useState } from 'react';
import { Text } from '@lobehub/ui';
import { createStyles } from 'antd-style';
import { Check, ChevronRight } from 'lucide-react';
import ToolCallCard, { summarize } from './ToolCallCard';
import type { ToolStep } from './types';

const useStyles = createStyles(({ token, css }) => ({
  header: css`
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    padding: 6px 8px;
    border-radius: ${token.borderRadius}px;
    cursor: pointer;
    transition: background 0.15s ease;
    &:hover {
      background: ${token.colorFillQuaternary};
    }
  `,
  icon: css`
    flex: none;
    width: 14px;
    height: 14px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  `,
  dot: css`
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: ${token.colorWarning};
  `,
  spin: css`
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2px solid ${token.colorFillSecondary};
    border-top-color: ${token.colorPrimary};
    animation: groupspin 0.8s linear infinite;
    @keyframes groupspin {
      to {
        transform: rotate(360deg);
      }
    }
  `,
  done: css`
    color: ${token.colorSuccess};
  `,
  name: css`
    flex: none;
    font-family: ${token.fontFamilyCode};
    font-size: 12.5px;
    font-weight: 600;
    color: ${token.colorText};
  `,
  count: css`
    flex: none;
    font-size: 11px;
    font-weight: 600;
    color: ${token.colorTextTertiary};
  `,
  preview: css`
    flex: 1;
    min-width: 0;
    font-size: 12.5px;
    color: ${token.colorTextTertiary};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `,
  chevron: css`
    flex: none;
    color: ${token.colorTextQuaternary};
    transition: transform 0.15s ease;
  `,
  chevronOpen: css`
    transform: rotate(90deg);
  `,
  body: css`
    margin: 2px 0 6px 14px;
    padding-left: 14px;
    border-left: 2px solid ${token.colorFillSecondary};
    display: flex;
    flex-direction: column;
    gap: 2px;
  `,
}));

// A run of consecutive tool calls. One call renders as a plain row; two or more
// collapse into a count header (like ChatGPT/Claude) — auto-expanded while the
// run is still working, collapsed once it finishes, and toggleable either way.
export default function ToolGroup({ steps }: { steps: ToolStep[] }) {
  const { styles, cx } = useStyles();
  const [open, setOpen] = useState(false);

  if (steps.length === 1) return <ToolCallCard step={steps[0]} />;

  const pending = steps.some((s) => s.approval === 'pending');
  const running = steps.some(
    (s) => s.approval !== 'pending' && s.approval !== 'denied' && s.result === undefined,
  );
  const live = pending || running;
  const expanded = open || live;

  const allSame = steps.every((s) => s.name === steps[0].name);
  const previews = steps.map(summarize).filter(Boolean);
  const preview = previews.slice(0, 2).join(' · ') + (previews.length > 2 ? ' …' : '');

  return (
    <div>
      <div className={styles.header} onClick={() => setOpen((v) => !v)}>
        <span className={styles.icon}>
          {running ? (
            <span className={styles.spin} />
          ) : pending ? (
            <span className={styles.dot} />
          ) : (
            <Check size={14} className={styles.done} />
          )}
        </span>
        {allSame ? (
          <Text className={styles.name}>{steps[0].name}</Text>
        ) : (
          <Text className={styles.name}>工具调用</Text>
        )}
        <span className={styles.count}>{steps.length} 次</span>
        {!expanded && preview && <span className={styles.preview}>{preview}</span>}
        <ChevronRight size={14} className={cx(styles.chevron, expanded && styles.chevronOpen)} />
      </div>
      {expanded && (
        <div className={styles.body}>
          {steps.map((s) => (
            <ToolCallCard key={s.id} step={s} />
          ))}
        </div>
      )}
    </div>
  );
}
