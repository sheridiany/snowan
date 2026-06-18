import { useEffect, useRef } from 'react';
import { Empty, Markdown } from '@lobehub/ui';
import { createStyles, useTheme } from 'antd-style';
import { Paperclip, Sparkles } from 'lucide-react';
import ToolCallCard from './ToolCallCard';
import ApprovalCard from './ApprovalCard';
import type { Message } from './types';

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
    box-shadow: 0 4px 14px ${token.colorPrimaryBorder};
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
    gap: 12px;
    color: ${token.colorText};
  `,
  tool: css`
    align-self: flex-start;
    width: 100%;
    max-width: 560px;
  `,
}));

type Props = {
  messages: Message[];
  onApprovalDecision?: (messageIndex: number, blockIndex: number, approve: boolean) => void;
};

export default function ChatView({ messages, onApprovalDecision }: Props) {
  const { styles } = useStyles();
  const theme = useTheme();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
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
    <div className={styles.scroll} ref={scrollRef}>
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
            <div key={i} className={styles.assistant}>
              {m.blocks.map((b, j) => {
                if (b.kind === 'text') {
                  return b.text ? (
                    <Markdown key={j} variant="chat">
                      {b.text}
                    </Markdown>
                  ) : null;
                }
                if (b.kind === 'approval') {
                  return (
                    <div key={j} className={styles.tool}>
                      <ApprovalCard
                        calls={b.calls}
                        decided={b.decided}
                        approved={b.approved}
                        onDecide={(approve) => onApprovalDecision?.(i, j, approve)}
                      />
                    </div>
                  );
                }
                return (
                  <div key={j} className={styles.tool}>
                    <ToolCallCard step={b.step} />
                  </div>
                );
              })}
            </div>
          ),
        )}
      </div>
    </div>
  );
}
