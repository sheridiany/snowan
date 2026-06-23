import { useState } from 'react';
import { ActionIcon, Markdown } from '@lobehub/ui';
import { Input, Tooltip } from 'antd';
import { createStyles, cx } from 'antd-style';
import { ArrowUp, BookmarkPlus } from 'lucide-react';
import type { CompanionMode } from '../../api/books';

export type CompanionSource = { chapter: string; snippet: string };
export type CompanionMessage =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string; sources?: CompanionSource[] };

// The 伴读 modes match the backend CompanionMode union; switching one posts the
// AI's opening turn (see useBooks.setMode / books.startMode).
const MODES: { key: CompanionMode; label: string }[] = [
  { key: 'qa', label: '问答' },
  { key: 'socratic', label: '苏格拉底' },
  { key: 'feynman', label: '费曼' },
];

const useStyles = createStyles(({ token, css }) => ({
  pane: css`
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    background: ${token.colorBgContainer};
    border-radius: ${token.borderRadiusLG}px;
    box-shadow: ${token.boxShadowTertiary};
    overflow: hidden;
  `,
  // Embedded inside RightPanel: no panel chrome (the host provides it) and no
  // title (the host's source dropdown already reads 伴读).
  paneEmbedded: css`
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    overflow: hidden;
  `,
  header: css`
    padding: 14px 18px 12px;
    border-bottom: 1px solid ${token.colorFillQuaternary};
  `,
  title: css`
    font-size: 14px;
    font-weight: 600;
    color: ${token.colorText};
  `,
  modes: css`
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 10px;
  `,
  chip: css`
    font-size: 12px;
    line-height: 1;
    padding: 5px 10px;
    border-radius: ${token.borderRadiusSM}px;
    background: ${token.colorFillTertiary};
    color: ${token.colorTextSecondary};
    cursor: pointer;
    user-select: none;
    transition: all 0.15s;
    &:hover {
      color: ${token.colorText};
      background: ${token.colorFillSecondary};
    }
  `,
  chipActive: css`
    background: ${token.colorPrimaryBg};
    color: ${token.colorPrimary};
    font-weight: 600;
    &:hover {
      background: ${token.colorPrimaryBgHover};
      color: ${token.colorPrimary};
    }
  `,
  chat: css`
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 16px 18px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  `,
  empty: css`
    margin: auto;
    text-align: center;
    font-size: 13px;
    color: ${token.colorTextTertiary};
    line-height: 1.7;
  `,
  user: css`
    align-self: flex-end;
    max-width: 88%;
    font-size: 13px;
    background: ${token.colorPrimaryBg};
    color: ${token.colorText};
    border-radius: ${token.borderRadius}px;
    padding: 8px 12px;
    white-space: pre-wrap;
    word-break: break-word;
  `,
  answer: css`
    align-self: flex-start;
    max-width: 92%;
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
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 220px;
  `,
  answerFoot: css`
    display: flex;
    justify-content: flex-end;
    margin-top: 6px;
  `,
  inputRow: css`
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 12px 18px 16px;
    border-top: 1px solid ${token.colorFillQuaternary};
  `,
}));

type Props = {
  messages: CompanionMessage[];
  busy: boolean;
  onAsk: (question: string) => void;
  mode: CompanionMode;
  onSetMode: (mode: CompanionMode) => void;
  onSaveInsight: (text: string) => void;
  embedded?: boolean;
};

export default function BookCompanion({
  messages,
  busy,
  onAsk,
  mode,
  onSetMode,
  onSaveInsight,
  embedded,
}: Props) {
  const { styles } = useStyles();
  const [q, setQ] = useState('');

  const submit = () => {
    const text = q.trim();
    if (!text || busy) return;
    onAsk(text);
    setQ('');
  };

  return (
    <div className={embedded ? styles.paneEmbedded : styles.pane}>
      <div className={styles.header}>
        {!embedded && <span className={styles.title}>AI 伴读</span>}
        <div className={styles.modes} style={embedded ? { marginTop: 0 } : undefined}>
          {MODES.map((m) => (
            <span
              key={m.key}
              className={cx(styles.chip, m.key === mode && styles.chipActive)}
              onClick={() => onSetMode(m.key)}
            >
              {m.label}
            </span>
          ))}
        </div>
      </div>

      <div className={styles.chat}>
        {messages.length === 0 ? (
          <div className={styles.empty}>
            选一本书,问点什么吧。
            <br />
            回答会基于书中内容,并附上来源章节。
          </div>
        ) : (
          messages.map((m, i) =>
            m.role === 'user' ? (
              <div key={i} className={styles.user}>
                {m.text}
              </div>
            ) : (
              <div key={i} className={styles.answer}>
                <Markdown variant="chat">{m.text}</Markdown>
                {m.sources && m.sources.length > 0 && (
                  <div className={styles.sources}>
                    {m.sources.map((s, j) => (
                      <span key={j} className={styles.src} title={s.snippet}>
                        ↳ {s.chapter}
                      </span>
                    ))}
                  </div>
                )}
                <div className={styles.answerFoot}>
                  <Tooltip title="存入知识库">
                    <ActionIcon
                      icon={BookmarkPlus}
                      size="small"
                      onClick={() => onSaveInsight(m.text)}
                    />
                  </Tooltip>
                </div>
              </div>
            ),
          )
        )}
      </div>

      <div className={styles.inputRow}>
        <Input
          value={q}
          placeholder="基于这本书提问…"
          onChange={(e) => setQ(e.target.value)}
          onPressEnter={submit}
          disabled={busy}
        />
        <ActionIcon icon={ArrowUp} loading={busy} onClick={submit} title="提问" />
      </div>
    </div>
  );
}
