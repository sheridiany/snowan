import { Empty, Markdown } from '@lobehub/ui';
import { Button } from 'antd';
import { createStyles } from 'antd-style';
import { BookOpen, BookText, Layers, Network, ScrollText, Sparkles, Zap } from 'lucide-react';

type WorkspaceBook = {
  id: string;
  title: string | null;
  author: string | null;
};

type ArtifactKind = 'glossary' | 'mindmap' | 'summary';

// 学习物料 cards, in display order. Each pairs an artifact kind with its visual
// identity and the empty-state hint shown before generation.
const ARTIFACT_CARDS: {
  kind: ArtifactKind;
  label: string;
  Icon: typeof BookText;
  hint: string;
}[] = [
  {
    kind: 'glossary',
    label: '术语表',
    Icon: BookText,
    hint: '提炼全书关键术语与概念 —— 一份随手可查的速查表。',
  },
  {
    kind: 'mindmap',
    label: '思维导图',
    Icon: Network,
    hint: '把全书结构画成一张导图 —— 主干脉络一目了然。',
  },
  {
    kind: 'summary',
    label: '章节摘要',
    Icon: ScrollText,
    hint: '逐章一段话讲清这一章说了什么 —— 复盘全书脉络。',
  },
];

const useStyles = createStyles(({ token, css }) => ({
  col: css`
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    background: ${token.colorBgContainer};
    border-radius: ${token.borderRadiusLG}px;
    box-shadow: ${token.boxShadowTertiary};
    overflow: hidden;
  `,
  empty: css`
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  `,
  scroll: css`
    flex: 1;
    overflow-y: auto;
  `,
  inner: css`
    padding: 22px 26px 32px;
    max-width: 720px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
  `,
  head: css`
    margin-bottom: 2px;
  `,
  title: css`
    font-size: 18px;
    font-weight: 700;
    line-height: 1.4;
    color: ${token.colorText};
    margin-bottom: 2px;
  `,
  meta: css`
    font-size: 12px;
    color: ${token.colorTextTertiary};
  `,
  card: css`
    border: 1px solid ${token.colorFillQuaternary};
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorBgContainer};
    overflow: hidden;
  `,
  cardHead: css`
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    border-bottom: 1px solid ${token.colorFillQuaternary};
  `,
  cardLabel: css`
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 600;
    color: ${token.colorText};
  `,
  cardSpacer: css`
    flex: 1;
  `,
  body: css`
    padding: 14px 16px;
  `,
  hint: css`
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 84px;
    padding: 16px;
    font-size: 12.5px;
    color: ${token.colorTextTertiary};
    text-align: center;
  `,
}));

export default function BookWorkspace({
  book,
  overview,
  skeleton,
  busy,
  onOverview,
  onSkeleton,
  artifacts,
  artifactBusy,
  onGenArtifact,
}: {
  book: WorkspaceBook | null;
  overview: string | null;
  skeleton: string | null;
  busy: { overview: boolean; skeleton: boolean };
  onOverview: () => void;
  onSkeleton: () => void;
  artifacts: Partial<Record<ArtifactKind, string>>;
  artifactBusy: Record<ArtifactKind, boolean>;
  onGenArtifact: (kind: ArtifactKind) => void;
}) {
  const { styles } = useStyles();

  if (!book) {
    return (
      <div className={styles.col}>
        <div className={styles.empty}>
          <Empty icon={BookOpen} title="选一本书,或上传 epub" description="从左边的书架挑一本开始精读。" />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.col}>
      <div className={styles.scroll}>
        <div className={styles.inner}>
          <div className={styles.head}>
            <div className={styles.title}>{book.title || '无标题'}</div>
            {book.author && <div className={styles.meta}>{book.author}</div>}
          </div>

          <section className={styles.card}>
            <div className={styles.cardHead}>
              <span className={styles.cardLabel}>
                <Zap size={14} /> 速览
              </span>
              <span className={styles.cardSpacer} />
              <Button
                size="small"
                type={overview ? 'default' : 'primary'}
                icon={<Sparkles size={14} />}
                loading={busy.overview}
                onClick={onOverview}
              >
                {overview ? '重新生成' : '生成速览'}
              </Button>
            </div>
            <div className={overview ? styles.body : styles.hint}>
              {overview ? (
                <Markdown variant="chat">{overview}</Markdown>
              ) : (
                '快速了解这本书讲了什么 —— 主旨、脉络、值不值得读。'
              )}
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardHead}>
              <span className={styles.cardLabel}>
                <Layers size={14} /> 精读骨架
              </span>
              <span className={styles.cardSpacer} />
              <Button
                size="small"
                type={skeleton ? 'default' : 'primary'}
                icon={<Sparkles size={14} />}
                loading={busy.skeleton}
                onClick={onSkeleton}
              >
                {skeleton ? '重新生成' : '生成骨架'}
              </Button>
            </div>
            <div className={skeleton ? styles.body : styles.hint}>
              {skeleton ? (
                <Markdown variant="chat">{skeleton}</Markdown>
              ) : (
                '拆出全书的结构骨架 —— 章节脉络与核心论点,带着问题去读。'
              )}
            </div>
          </section>

          {ARTIFACT_CARDS.map(({ kind, label, Icon, hint }) => {
            const content = artifacts[kind];
            return (
              <section key={kind} className={styles.card}>
                <div className={styles.cardHead}>
                  <span className={styles.cardLabel}>
                    <Icon size={14} /> {label}
                  </span>
                  <span className={styles.cardSpacer} />
                  <Button
                    size="small"
                    type={content ? 'default' : 'primary'}
                    icon={<Sparkles size={14} />}
                    loading={artifactBusy[kind]}
                    onClick={() => onGenArtifact(kind)}
                  >
                    {content ? '重新生成' : `生成${label}`}
                  </Button>
                </div>
                <div className={content ? styles.body : styles.hint}>
                  {content ? <Markdown variant="chat">{content}</Markdown> : hint}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
