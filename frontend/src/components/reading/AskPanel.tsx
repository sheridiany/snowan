import { useState } from 'react';
import { ActionIcon, Markdown } from '@lobehub/ui';
import { Input } from 'antd';
import { createStyles } from 'antd-style';
import { ArrowUp } from 'lucide-react';

import { ask, type AskSource } from '../../api/reading';

const useStyles = createStyles(({ token, css }) => ({
  wrap: css`
    border-top: 1px solid ${token.colorFillQuaternary};
    padding: 12px 18px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  `,
  label: css`
    font-size: 12px;
    font-weight: 600;
    color: ${token.colorTextSecondary};
  `,
  inputRow: css`
    display: flex;
    gap: 8px;
    align-items: center;
  `,
  answer: css`
    font-size: 13px;
    background: ${token.colorFillQuaternary};
    border-radius: ${token.borderRadius}px;
    padding: 10px 12px;
  `,
  sources: css`
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
  `,
  src: css`
    font-size: 11px;
    color: ${token.colorTextSecondary};
    background: ${token.colorFillTertiary};
    border-radius: ${token.borderRadiusSM}px;
    padding: 2px 8px;
    cursor: pointer;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 220px;
    &:hover {
      color: ${token.colorPrimary};
    }
  `,
}));

export default function AskPanel({ onOpenSource }: { onOpenSource: (id: string) => void }) {
  const { styles } = useStyles();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [sources, setSources] = useState<AskSource[]>([]);

  const submit = () => {
    const text = q.trim();
    if (!text || busy) return;
    setBusy(true);
    setAnswer(null);
    ask(text)
      .then((r) => {
        setAnswer(r.answer);
        setSources(r.sources);
      })
      .catch(() => setAnswer('问答失败,请稍后再试。'))
      .finally(() => setBusy(false));
  };

  return (
    <div className={styles.wrap}>
      <span className={styles.label}>问阅读</span>
      <div className={styles.inputRow}>
        <Input
          value={q}
          placeholder="基于你订阅的文章提问…"
          onChange={(e) => setQ(e.target.value)}
          onPressEnter={submit}
          disabled={busy}
        />
        <ActionIcon icon={ArrowUp} loading={busy} onClick={submit} title="提问" />
      </div>
      {answer != null && (
        <div className={styles.answer}>
          <Markdown>{answer}</Markdown>
          {sources.length > 0 && (
            <div className={styles.sources}>
              {sources.map((s) => (
                <span key={s.id} className={styles.src} onClick={() => onOpenSource(s.id)}>
                  {s.title || '无标题'}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
