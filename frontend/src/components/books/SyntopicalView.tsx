import { useState } from 'react';
import { Markdown } from '@lobehub/ui';
import { Input } from 'antd';
import { createStyles, cx } from 'antd-style';
import { ArrowUp, Layers } from 'lucide-react';
import type { BookOut, SyntopicalResult } from '../../api/books';

// 主题阅读 (Adler syntopical): pick a set of books, ask one question, get a
// synthesized cross-book answer with sources. Reuses BookCompanion's source-chip
// + Markdown visual language; the answer cites 《书名·章节》 inline.
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
  header: css`
    padding: 16px 20px 14px;
    border-bottom: 1px solid ${token.colorFillQuaternary};
  `,
  title: css`
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 15px;
    font-weight: 600;
    color: ${token.colorText};
  `,
  hint: css`
    margin-top: 4px;
    font-size: 12px;
    color: ${token.colorTextTertiary};
  `,
  books: css`
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 12px;
  `,
  bookChip: css`
    font-size: 12px;
    line-height: 1;
    padding: 6px 11px;
    border-radius: ${token.borderRadiusSM}px;
    background: ${token.colorFillTertiary};
    color: ${token.colorTextSecondary};
    cursor: pointer;
    user-select: none;
    transition: all 0.15s;
    max-width: 220px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    &:hover {
      color: ${token.colorText};
      background: ${token.colorFillSecondary};
    }
  `,
  bookChipActive: css`
    background: ${token.colorPrimaryBg};
    color: ${token.colorPrimary};
    font-weight: 600;
    &:hover {
      background: ${token.colorPrimaryBgHover};
      color: ${token.colorPrimary};
    }
  `,
  body: css`
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 18px 20px;
  `,
  empty: css`
    margin: 64px auto 0;
    max-width: 420px;
    text-align: center;
    font-size: 13px;
    color: ${token.colorTextTertiary};
    line-height: 1.8;
  `,
  answer: css`
    font-size: 14px;
    color: ${token.colorText};
    line-height: 1.8;
  `,
  used: css`
    margin-top: 16px;
    font-size: 12px;
    font-weight: 600;
    color: ${token.colorTextSecondary};
  `,
  group: css`
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.03em;
    color: ${token.colorTextTertiary};
    margin: 18px 0 8px;
  `,
  bookGroup: css`
    margin-bottom: 14px;
  `,
  bookGroupTitle: css`
    font-size: 12px;
    font-weight: 600;
    color: ${token.colorTextSecondary};
    margin-bottom: 6px;
  `,
  sources: css`
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
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
    max-width: 260px;
  `,
  inputRow: css`
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 12px 20px 16px;
    border-top: 1px solid ${token.colorFillQuaternary};
  `,
}));

type Props = {
  books: BookOut[];
  selected: string[];
  onToggleBook: (id: string) => void;
  busy: boolean;
  result: SyntopicalResult | null;
  onAsk: (question: string) => void;
};

export default function SyntopicalView({
  books,
  selected,
  onToggleBook,
  busy,
  result,
  onAsk,
}: Props) {
  const { styles } = useStyles();
  const [q, setQ] = useState('');

  const submit = () => {
    const text = q.trim();
    if (!text || busy) return;
    onAsk(text);
  };

  // Sources carry only {chapter, snippet}; group them by chapter so the
  // 参考来源 list mirrors the books_used breakdown as closely as the data allows.
  const grouped = new Map<string, SyntopicalResult['sources']>();
  for (const s of result?.sources ?? []) {
    const arr = grouped.get(s.chapter) ?? [];
    arr.push(s);
    grouped.set(s.chapter, arr);
  }

  return (
    <div className={styles.pane}>
      <div className={styles.header}>
        <div className={styles.title}>
          <Layers size={18} />
          主题阅读 · 跨书对照
        </div>
        <div className={styles.hint}>
          选几本书,问同一个问题,看它们怎么说、在哪一致、在哪分歧。不选 = 全部书架。
        </div>
        <div className={styles.books}>
          {books.map((b) => (
            <span
              key={b.id}
              className={cx(
                styles.bookChip,
                selected.includes(b.id) && styles.bookChipActive,
              )}
              title={b.title || '无标题'}
              onClick={() => onToggleBook(b.id)}
            >
              {b.title || '无标题'}
            </span>
          ))}
        </div>
      </div>

      <div className={styles.body}>
        {!result ? (
          <div className={styles.empty}>
            还没有对照结果。
            <br />
            选好书、提一个问题,AI 会综合多本书给出回答。
          </div>
        ) : (
          <>
            <Markdown variant="chat" className={styles.answer}>{result.answer}</Markdown>

            {result.books_used.length > 0 && (
              <div className={styles.used}>
                本次用到 {result.books_used.length} 本书 ·{' '}
                {result.books_used.map((b) => b.book_title).join('、')}
              </div>
            )}

            {grouped.size > 0 && (
              <>
                <div className={styles.group}>参考来源</div>
                {[...grouped.entries()].map(([chapter, items]) => (
                  <div key={chapter} className={styles.bookGroup}>
                    <div className={styles.bookGroupTitle}>{chapter}</div>
                    <div className={styles.sources}>
                      {items.map((s, j) => (
                        <span key={j} className={styles.src} title={s.snippet}>
                          ↳ {s.snippet}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>

      <div className={styles.inputRow}>
        <Input
          value={q}
          placeholder="想对照着问什么?例如:它们怎么看待自由?"
          onChange={(e) => setQ(e.target.value)}
          onPressEnter={submit}
          disabled={busy}
        />
        <Button onAsk={submit} busy={busy} />
      </div>
    </div>
  );
}

// 开始对照 submit affordance, kept inline to avoid leaking another export.
function Button({ onAsk, busy }: { onAsk: () => void; busy: boolean }) {
  const { styles } = useButtonStyles();
  return (
    <button type="button" className={styles.btn} disabled={busy} onClick={onAsk}>
      <ArrowUp size={15} />
      开始对照
    </button>
  );
}

const useButtonStyles = createStyles(({ token, css }) => ({
  btn: css`
    display: inline-flex;
    align-items: center;
    gap: 5px;
    flex: none;
    height: 32px;
    padding: 0 14px;
    border: none;
    border-radius: ${token.borderRadius}px;
    background: ${token.colorPrimary};
    color: ${token.colorTextLightSolid};
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
    &:hover {
      background: ${token.colorPrimaryHover};
    }
    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  `,
}));
