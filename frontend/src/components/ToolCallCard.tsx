import { useState } from 'react';
import { Highlighter, Text } from '@lobehub/ui';
import { createStyles, useTheme } from 'antd-style';
import { Brain, Check, ChevronRight, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import StatusBadge from '../ui/StatusBadge';
import { useUiPref } from '../hooks/useUiPrefs';
import { EASING } from '../ui/motion';
import type { ToolStep } from './types';

// Human labels for the agent's tools, so a row reads "运行命令 ls -la" instead of the
// raw function name. Falls back to the raw name for anything unmapped.
const TOOL_LABELS: Record<string, string> = {
  read_file: '读取文件',
  write_file: '写入文件',
  edit_file: '编辑文件',
  append_file: '追加内容',
  execute_shell_command: '运行命令',
  grep_search: '搜索内容',
  glob_search: '查找文件',
  knowledge_search: '搜索知识库',
  read_table: '读取表格',
  create_document: '生成文档',
  create_spreadsheet: '生成表格',
  create_slides: '生成幻灯片',
  save_note: '保存笔记',
  read_note: '读取笔记',
  append_note: '追加笔记',
  rewrite_note: '整理笔记',
  daily_note: '日志',
  upcoming_events: '查看日程',
  get_current_time: '当前时间',
  recall_memory: '回忆',
  remember: '记忆',
  web_search: '联网搜索',
  web_fetch: '抓取网页',
  load_skill: '加载技能',
  read_skill_resource: '读取技能',
  create_skill: '创建技能',
  present_artifact: '生成文件',
  render_diagram: '生成图示',
};

export const toolLabel = (name: string) => TOOL_LABELS[name] ?? name;

const useStyles = createStyles(({ token, css }) => ({
  row: css`
    position: relative;
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    padding: 6px 8px 6px 10px;
    border-radius: ${token.borderRadius}px;
    transition:
      background ${EASING.standard} 0.18s,
      box-shadow ${EASING.standard} 0.18s;
  `,
  // Category accent as a soft left edge — colored via inline style from the
  // live colorCat* token, so the tool stream isn't a wall of grey.
  accent: css`
    position: absolute;
    left: 0;
    top: 6px;
    bottom: 6px;
    width: 2px;
    border-radius: 2px;
    opacity: 0.7;
  `,
  clickable: css`
    cursor: pointer;
    &:hover {
      background: ${token.colorFillQuaternary};
    }
    &:active {
      background: ${token.colorFillTertiary};
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
    box-shadow: 0 0 0 3px ${token.colorWarningBg};
  `,
  spin: css`
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2px solid ${token.colorFillSecondary};
    border-top-color: ${token.colorPrimary};
    animation: toolspin 0.7s ${EASING.standard} infinite;
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
  badge: css`
    flex: none;
  `,
  chevron: css`
    flex: none;
    color: ${token.colorTextQuaternary};
    transition: transform ${EASING.emphasized} 0.2s;
  `,
  chevronOpen: css`
    transform: rotate(90deg);
  `,
  body: css`
    overflow: hidden;
    margin-left: 14px;
    padding-left: 14px;
    border-left: 2px solid ${token.colorFillSecondary};
  `,
  bodyInner: css`
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 4px 0 6px;
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
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const richDesc = useUiPref('rich_tool_desc');

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
        {categoryColor && (
          <span className={styles.accent} style={{ background: categoryColor }} />
        )}
        <span className={styles.icon}>
          {pending && <span className={styles.dot} />}
          {running && <span className={styles.spin} />}
          {done && <Check size={14} className={styles.done} />}
          {denied && <X size={14} className={styles.denied} />}
        </span>
        <Text className={styles.name}>{toolLabel(step.name)}</Text>
        {richDesc && summary && <span className={styles.summary}>{summary}</span>}
        {pending && (
          <span className={styles.badge}>
            <StatusBadge status="warning">需要确认</StatusBadge>
          </span>
        )}
        {denied && (
          <span className={styles.badge}>
            <StatusBadge status="error">已拒绝</StatusBadge>
          </span>
        )}
        {expandable && (
          <ChevronRight size={14} className={cx(styles.chevron, open && styles.chevronOpen)} />
        )}
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            className={styles.body}
            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.2, 0, 0, 1] }}
          >
            <div className={styles.bodyInner}>
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
