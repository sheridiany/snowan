import { useRef, useState } from 'react';
import { Button, Input } from 'antd';
import { Markdown } from '@lobehub/ui';
import { createStyles } from 'antd-style';
import { streamChat } from './api/chat';

type Msg = { role: 'user' | 'assistant'; content: string };

const useStyles = createStyles(({ token, css }) => ({
  app: css`
    height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    background: ${token.colorBgLayout};
  `,
  header: css`
    width: 100%;
    max-width: 760px;
    padding: 20px 16px 8px;
    font-size: 15px;
    font-weight: 600;
    color: ${token.colorTextSecondary};
  `,
  scroll: css`
    flex: 1;
    width: 100%;
    overflow-y: auto;
    display: flex;
    justify-content: center;
  `,
  list: css`
    width: 100%;
    max-width: 760px;
    padding: 8px 16px 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  `,
  user: css`
    align-self: flex-end;
    max-width: 80%;
    padding: 10px 14px;
    border-radius: 16px 16px 4px 16px;
    background: ${token.colorPrimary};
    color: #fff;
    white-space: pre-wrap;
  `,
  assistant: css`
    align-self: flex-start;
    max-width: 92%;
    padding: 4px 2px;
    color: ${token.colorText};
  `,
  composer: css`
    width: 100%;
    max-width: 760px;
    padding: 12px 16px 20px;
    display: flex;
    gap: 8px;
    align-items: flex-end;
  `,
}));

export default function App() {
  const { styles } = useStyles();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sessionId = useRef(crypto.randomUUID());

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    setBusy(true);
    setMessages((m) => [...m, { role: 'user', content: text }, { role: 'assistant', content: '' }]);
    try {
      await streamChat(text, sessionId.current, (delta) => {
        setMessages((m) => {
          const next = [...m];
          next[next.length - 1] = {
            role: 'assistant',
            content: next[next.length - 1].content + delta,
          };
          return next;
        });
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.app}>
      <div className={styles.header}>Snowan</div>
      <div className={styles.scroll} ref={scrollRef}>
        <div className={styles.list}>
          {messages.map((m, i) =>
            m.role === 'user' ? (
              <div key={i} className={styles.user}>
                {m.content}
              </div>
            ) : (
              <div key={i} className={styles.assistant}>
                <Markdown>{m.content || '…'}</Markdown>
              </div>
            ),
          )}
        </div>
      </div>
      <div className={styles.composer}>
        <Input.TextArea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onPressEnter={(e) => {
            if (!e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          autoSize={{ minRows: 1, maxRows: 6 }}
          placeholder="问点什么…"
        />
        <Button type="primary" loading={busy} onClick={() => void send()}>
          发送
        </Button>
      </div>
    </div>
  );
}
