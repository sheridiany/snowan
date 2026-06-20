import { useState } from 'react';
import { Highlighter, Text } from '@lobehub/ui';
import { createStyles, useTheme } from 'antd-style';
import { Brain, Check, ChevronRight, X } from 'lucide-react';
import type { ToolStep } from './types';

const useStyles = createStyles(({ token, css }) => ({
  row: css`
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    padding: 6px 8px;
    border-radius: ${token.borderRadius}px;
    transition: background 0.15s ease;
  `,
  clickable: css`
    cursor: pointer;
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
    animation: toolspin 0.8s linear infinite;
    @keyframes toolspin {
      to {
        transform: rotate(360deg);
      }
    }
  `,
  done: css`
    color: ${token.colorSuccess};
  `,
  denied: css`
    color: ${token.colorError};
  `,
  name: css`
    flex: none;
    font-family: ${token.fontFamilyCode};
    font-size: 12.5px;
    font-weight: 600;
    color: ${token.colorText};
  `,
  summary: css`
    flex: 1;
    min-width: 0;
    font-size: 12.5px;
    color: ${token.colorTextTertiary};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `,
  tag: css`
    flex: none;
    font-size: 11px;
    font-weight: 600;
  `,
  tagWarn: css`
    color: ${token.colorWarning};
  `,
  tagDenied: css`
    color: ${token.colorError};
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
    margin: 4px 0 6px 14px;
    padding-left: 14px;
    border-left: 2px solid ${token.colorFillSecondary};
    display: flex;
    flex-direction: column;
    gap: 6px;
  `,
  memPill: css`
    display: inline-flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
    max-width: 100%;
    padding: 5px 11px 5px 9px;
    border-radius: 999px;
    background: ${token.colorFillQuaternary};
    color: ${token.colorTextTertiary};
    font-size: 12px;
  `,
  memLabel: css`
    flex: none;
    color: ${token.colorTextSecondary};
  `,
  memContent: css`
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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

// Category accent per tool, keyed to the live colorCat* tokens so the tool
// stream isn't all-grey. Unmapped tools fall back to neutral colorText.
type ThemeToken = ReturnType<typeof useTheme>;
const CATEGORY_TOKENS: Record<string, keyof ThemeToken> = {
  web_search: 'colorCatSearch',
  execute_shell_command: 'colorCatShell',
  read_file: 'colorCatFile',
  write_file: 'colorCatFile',
  edit_file: 'colorCatFile',
  append_file: 'colorCatFile',
  list_dir: 'colorCatFile',
  glob: 'colorCatFile',
  grep: 'colorCatFile',
  knowledge_search: 'colorCatKnowledge',
  get_current_time: 'colorCatTime',
};

// First useful scalar from the call args, so the row reads e.g.
// `execute_shell_command  ls -la /tmp` without expanding.
const SUMMARY_KEYS = ['command', 'path', 'file_path', 'pattern', 'query', 'url', 'timezone'];

export function summarize(step: ToolStep): string {
  const args = step.args ?? {};
  for (const k of SUMMARY_KEYS) {
    const v = args[k];
    if (typeof v === 'string' && v.trim()) return v.split('\n')[0];
  }
  const first = Object.values(args).find((v) => typeof v === 'string' && (v as string).trim());
  return typeof first === 'string' ? first.split('\n')[0] : '';
}

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
  const { styles, cx } = useStyles();
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  const categoryToken = CATEGORY_TOKENS[step.name];
  const categoryColor = categoryToken ? (theme[categoryToken] as string) : undefined;

  const pending = step.approval === 'pending';
  const denied = step.approval === 'denied';
  const done = !denied && step.result !== undefined;
  const running = !pending && !denied && !done;

  const hasArgs = !!step.args && Object.keys(step.args).length > 0;
  const expandable = hasArgs || step.result !== undefined;
  const summary = summarize(step);

  // remember runs silently — show a calm "记忆已更新" pill in the stream, not a tool row.
  if (step.name === 'remember') {
    const content = typeof step.args?.content === 'string' ? step.args.content : summary;
    return (
      <div className={styles.memPill}>
        <Brain size={13} style={{ flex: 'none', color: theme.colorPrimary }} />
        <span className={styles.memLabel}>{running ? '正在记忆…' : '记忆已更新'}</span>
        {content && <span className={styles.memContent}>{content}</span>}
      </div>
    );
  }

  return (
    <div>
      <div
        className={cx(styles.row, expandable && styles.clickable)}
        onClick={() => expandable && setOpen((v) => !v)}
      >
        <span className={styles.icon}>
          {pending && <span className={styles.dot} />}
          {running && <span className={styles.spin} />}
          {done && <Check size={14} className={styles.done} />}
          {denied && <X size={14} className={styles.denied} />}
        </span>
        <Text className={styles.name} style={categoryColor ? { color: categoryColor } : undefined}>
          {step.name}
        </Text>
        {summary && <span className={styles.summary}>{summary}</span>}
        {pending && <span className={cx(styles.tag, styles.tagWarn)}>需要确认</span>}
        {denied && <span className={cx(styles.tag, styles.tagDenied)}>已拒绝</span>}
        {expandable && (
          <ChevronRight size={14} className={cx(styles.chevron, open && styles.chevronOpen)} />
        )}
      </div>
      {open && (
        <div className={styles.body}>
          {hasArgs && (
            <>
              <span className={styles.label}>参数</span>
              <Highlighter language="json" variant="filled" copyable={false} className={styles.code}>
                {pretty(step.args)}
              </Highlighter>
            </>
          )}
          {step.result !== undefined && (
            <>
              <span className={styles.label}>结果</span>
              <Highlighter
                language={looksLikeJson(step.result) ? 'json' : 'text'}
                variant="filled"
                copyable
                className={styles.code}
              >
                {step.result}
              </Highlighter>
            </>
          )}
        </div>
      )}
    </div>
  );
}
