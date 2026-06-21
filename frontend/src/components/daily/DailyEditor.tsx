import { useEffect, useRef, useState } from 'react';
import { Markdown } from '@lobehub/ui';
import { createStyles } from 'antd-style';
import { Eye, Pencil } from 'lucide-react';
import { Tooltip } from 'antd';
import type { ComponentProps } from 'react';

import { toggleTaskByOrdinal } from './markdownSource';

// Byte-stable markdown editor: the source .md is the truth. View mode renders
// read-only XMarkdown but lets a task checkbox toggle ONE source line in place;
// edit mode is a plain textarea over the raw bytes. No WYSIWYG reserializer.
// CJK/IME-safe: we never transform or autosave mid-composition.

const useStyles = createStyles(({ token, css }) => ({
  wrap: css`
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  `,
  toolbar: css`
    flex: none;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
    padding: 4px 0 8px;
  `,
  modeBtn: css`
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 28px;
    padding: 0 10px;
    border-radius: ${token.borderRadius}px;
    font-size: 12px;
    color: ${token.colorTextSecondary};
    cursor: pointer;
    transition: background 0.12s ease, color 0.12s ease;
    &:hover {
      background: ${token.colorFillTertiary};
      color: ${token.colorText};
    }
  `,
  scroll: css`
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  `,
  view: css`
    max-width: 760px;
    margin: 0 auto;
    padding: 4px 20px 40px;
    /* Task checkboxes are the only interactive bit of the read-only render. */
    input[type='checkbox'] {
      cursor: pointer;
    }
  `,
  ta: css`
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    max-width: 820px;
    margin: 0 auto;
    display: block;
    padding: 4px 20px 40px;
    border: none;
    outline: none;
    resize: none;
    background: transparent;
    color: ${token.colorText};
    font-family:
      ui-monospace, 'SF Mono', 'JetBrains Mono', 'PingFang SC', 'Microsoft YaHei', monospace;
    font-size: 14px;
    line-height: 1.75;
    tab-size: 2;
  `,
}));

type Props = {
  body: string;
  /** `defer` skips arming autosave (set while an IME composition is in flight). */
  onChange: (next: string, defer?: boolean) => void;
  onBlur: () => void;
  /** Bumped by the host to force edit mode (e.g. right after an AI draft insert). */
  editSignal?: number;
};

export default function DailyEditor({ body, onChange, onBlur, editSignal }: Props) {
  const { styles } = useStyles();
  const [editing, setEditing] = useState(false);
  const composing = useRef(false);

  // The host can request edit mode after inserting an AI draft so the user lands
  // directly in the text to keep/trim it.
  useEffect(() => {
    if (editSignal) setEditing(true);
  }, [editSignal]);

  // A checkbox toggle in the read-only view edits only its own source line. We map
  // the clicked checkbox back to its task ordinal via its document order.
  const orderRef = useRef(0);
  const InputRenderer = ({ node: _node, ...rest }: ComponentProps<'input'> & { node?: unknown }) => {
    if (rest.type !== 'checkbox') return <input {...rest} />;
    const ordinal = orderRef.current;
    orderRef.current += 1;
    return (
      <input
        {...rest}
        disabled={false}
        readOnly
        onClick={() => onChange(toggleTaskByOrdinal(body, ordinal))}
      />
    );
  };
  const components = { input: InputRenderer };
  // Reset the per-render ordinal counter before each render pass.
  orderRef.current = 0;

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        {editing ? (
          <Tooltip title="阅读">
            <span className={styles.modeBtn} onClick={() => setEditing(false)}>
              <Eye size={14} /> 阅读
            </span>
          </Tooltip>
        ) : (
          <Tooltip title="编辑">
            <span className={styles.modeBtn} onClick={() => setEditing(true)}>
              <Pencil size={14} /> 编辑
            </span>
          </Tooltip>
        )}
      </div>
      <div className={styles.scroll}>
        {editing ? (
          <textarea
            className={styles.ta}
            value={body}
            autoFocus
            placeholder="写点什么…早计划 / 随手记 / 晚复盘"
            onChange={(e) => onChange(e.target.value, composing.current)}
            onBlur={onBlur}
            onCompositionStart={() => {
              composing.current = true;
            }}
            onCompositionEnd={(e) => {
              composing.current = false;
              // Commit the now-complete string and (re)arm autosave.
              onChange((e.target as HTMLTextAreaElement).value, false);
            }}
          />
        ) : (
          <div className={styles.view} onDoubleClick={() => setEditing(true)}>
            {body.trim() ? (
              // animated={false} pins the non-streaming Markdown path: the checkbox
              // ordinal->source-line mapping relies on a single document-order render
              // pass; the streaming renderer splits into independent subtrees and
              // would map a clicked checkbox to the wrong task line.
              <Markdown animated={false} components={components}>
                {body}
              </Markdown>
            ) : (
              <div style={{ opacity: 0.45, padding: '8px 4px' }}>
                今天还没有内容,点「编辑」开始写。
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
