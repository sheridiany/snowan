import { useEffect, useRef } from 'react';
import { Markdown, Text } from '@lobehub/ui';
import { createStyles } from 'antd-style';
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
  empty: css`
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 24px;
  `,
  emptyTitle: css`
    font-size: 24px;
    font-weight: 700;
    color: ${token.colorText};
  `,
  emptySub: css`
    font-size: 14px;
    color: ${token.colorTextTertiary};
  `,
  user: css`
    align-self: flex-end;
    max-width: 80%;
    padding: 11px 15px;
    border-radius: 18px 18px 5px 18px;
    background: ${token.colorPrimary};
    color: #fff;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
    box-shadow: 0 4px 14px ${token.colorPrimaryBorder};
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
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className={styles.emptyScroll} ref={scrollRef}>
        <div className={styles.empty}>
          <Text className={styles.emptyTitle}>晚上好</Text>
          <Text className={styles.emptySub}>开启一段新对话,Snowan 在这里。</Text>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.scroll} ref={scrollRef}>
      <div className={styles.list}>
        {messages.map((m, i) =>
          m.role === 'user' ? (
            <div key={i} className={styles.user}>
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
