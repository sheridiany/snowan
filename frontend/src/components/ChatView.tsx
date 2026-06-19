import { useEffect, useRef, useState } from 'react';
import { ActionIcon, Empty, Markdown } from '@lobehub/ui';
import { createStyles, useTheme } from 'antd-style';
import { Check, Copy, NotebookPen, Paperclip, Sparkles } from 'lucide-react';
import ToolGroup from './ToolGroup';
import ApprovalCard from './ApprovalCard';
import type { Block, Message, ToolStep } from './types';

// Render blocks in order, but coalesce consecutive tool calls into one run so
// they can collapse into a single grouped card.
type RenderItem =
  | { kind: 'text'; key: string; text: string }
  | { kind: 'tools'; key: string; steps: ToolStep[] };

function groupBlocks(blocks: Block[]): RenderItem[] {
  const items: RenderItem[] = [];
  blocks.forEach((b, j) => {
    if (b.kind === 'tool') {
      const last = items[items.length - 1];
      if (last && last.kind === 'tools') last.steps.push(b.step);
      else items.push({ kind: 'tools', key: b.step.id || `t${j}`, steps: [b.step] });
    } else if (b.kind === 'text') {
      items.push({ kind: 'text', key: `x${j}`, text: b.text });
    }
  });
  return items;
}

const useStyles = createStyles(({ token, css }) => ({
  scroll: css`
    flex: 1;
    overflow-y: auto;
  `,
  list: css`
    width: 100%;
    max-width: 760px;
    margin: 0 auto;
    padding: 28px 16px 24px;
    display: flex;
    flex-direction: column;
    gap: 22px;
  `,
  emptyScroll: css`
    flex: 1;
    min-height: 0;
    display: flex;
  `,
  user: css`
    align-self: flex-end;
    max-width: 80%;
    padding: 11px 15px;
    border-radius: 16px;
    background: ${token.colorPrimary};
    color: #fff;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
    box-shadow: 0 2px 6px -2px rgba(0, 0, 0, 0.18);
  `,
  attachRow: css`
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-bottom: 7px;
  `,
  attachChip: css`
    display: inline-flex;
    align-items: center;
    gap: 4px;
    max-width: 200px;
    padding: 2px 8px;
    border-radius: 7px;
    background: rgba(255, 255, 255, 0.2);
    font-size: 11.5px;
    line-height: 1.5;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `,
  assistant: css`
    align-self: stretch;
    display: flex;
    flex-direction: column;
    gap: 8px;
    color: ${token.colorText};
    /* reveal per-message actions on hover */
    &:hover .msg-actions {
      opacity: 1;
    }
  `,
  tool: css`
    align-self: stretch;
    width: 100%;
  `,
  actions: css`
    display: flex;
    align-items: center;
    gap: 2px;
    margin-top: -2px;
    opacity: 0;
    transition: opacity 0.15s ease;
  `,
  thinking: css`
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 0;
    & span {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: ${token.colorTextQuaternary};
      animation: dotpulse 1.2s ease-in-out infinite both;
    }
    & span:nth-child(2) {
      animation-delay: 0.18s;
    }
    & span:nth-child(3) {
      animation-delay: 0.36s;
    }
    @keyframes dotpulse {
      0%,
      80%,
      100% {
        opacity: 0.25;
        transform: scale(0.85);
      }
      40% {
        opacity: 1;
        transform: scale(1);
      }
    }
  `,
  caret: css`
    display: inline-block;
    width: 7px;
    height: 1.05em;
    margin-top: 2px;
    border-radius: 1px;
    background: ${token.colorText};
    animation: caretblink 1s steps(2, start) infinite;
    @keyframes caretblink {
      50% {
        opacity: 0;
      }
    }
  `,
}));

function CopyAction({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1400);
    } catch {
      // clipboard unavailable — nothing to recover, the user can select manually
    }
  };
  return (
    <ActionIcon
      icon={done ? Check : Copy}
      size="small"
      title={done ? '已复制' : '复制'}
      onClick={copy}
    />
  );
}

type Props = {
  messages: Message[];
  busy?: boolean;
  onApprovalDecision?: (messageIndex: number, approve: boolean) => void;
  onSaveNote?: (messageIndex: number) => void;
};

export default function ChatView({ messages, busy, onApprovalDecision, onSaveNote }: Props) {
  const { styles } = useStyles();
  const theme = useTheme();
  const scrollRef = useRef<HTMLDivElement>(null);
  // Stick to the bottom only while the user is already there; if they scroll up
  // to read history, streamed updates must not yank them back down.
  const stickRef = useRef(true);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // A message the user just sent always pins us to the bottom.
    if (messages[messages.length - 1]?.role === 'user') stickRef.current = true;
    if (stickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className={styles.emptyScroll} ref={scrollRef}>
        <Empty
          flex={1}
          icon={Sparkles}
          iconColor={theme.colorPrimary}
          title="晚上好"
          description="开启一段新对话,Snowan 在这里。"
        />
      </div>
    );
  }

  return (
    <div className={styles.scroll} ref={scrollRef} onScroll={onScroll}>
      <div className={styles.list}>
        {messages.map((m, i) =>
          m.role === 'user' ? (
            <div key={i} className={styles.user}>
              {m.attachments && m.attachments.length > 0 && (
                <div className={styles.attachRow}>
                  {m.attachments.map((a, k) => (
                    <span key={k} className={styles.attachChip} title={a.name}>
                      <Paperclip size={11} />
                      {a.name}
                    </span>
                  ))}
                </div>
              )}
              {m.blocks.map((b) => (b.kind === 'text' ? b.text : '')).join('')}
            </div>
          ) : (
            (() => {
              const isStreaming = !!busy && i === messages.length - 1;
              const textContent = m.blocks
                .map((b) => (b.kind === 'text' ? b.text : ''))
                .join('');
              const hasTool = m.blocks.some((b) => b.kind === 'tool');
              const lastBlock = m.blocks[m.blocks.length - 1];
              const showThinking = isStreaming && !textContent && !hasTool;
              const showCaret = isStreaming && lastBlock?.kind === 'text' && !!textContent;
              const pending = m.blocks.filter(
                (b) => b.kind === 'tool' && b.step.approval === 'pending',
              ).length;

              return (
                <div key={i} className={styles.assistant}>
                  {groupBlocks(m.blocks).map((item) =>
                    item.kind === 'text' ? (
                      item.text ? (
                        <Markdown key={item.key} variant="chat">
                          {item.text}
                        </Markdown>
                      ) : null
                    ) : (
                      <div key={item.key} className={styles.tool}>
                        <ToolGroup steps={item.steps} />
                      </div>
                    ),
                  )}

                  {showThinking && (
                    <div className={styles.thinking}>
                      <span />
                      <span />
                      <span />
                    </div>
                  )}
                  {showCaret && <span className={styles.caret} />}

                  {pending > 0 && (
                    <div className={styles.tool}>
                      <ApprovalCard
                        count={pending}
                        onDecide={(approve) => onApprovalDecision?.(i, approve)}
                      />
                    </div>
                  )}

                  {textContent && !isStreaming && (
                    <div className={`${styles.actions} msg-actions`}>
                      <CopyAction text={textContent} />
                      {onSaveNote && (
                        <ActionIcon
                          icon={NotebookPen}
                          size="small"
                          title="存为笔记"
                          onClick={() => onSaveNote(i)}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })()
          ),
        )}
      </div>
    </div>
  );
}
