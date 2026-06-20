import { useEffect, useState } from 'react';
import { Empty, Markdown } from '@lobehub/ui';
import { App, Button } from 'antd';
import { createStyles } from 'antd-style';
import {
  BookOpen,
  Check,
  Clock,
  ExternalLink,
  Languages,
  Sparkles,
  Star,
  StickyNote,
} from 'lucide-react';

import {
  saveArticleNote,
  summarizeArticle,
  translateArticle,
  type ArticleOut,
} from '../../api/reading';
import AskPanel from './AskPanel';

function metaLine(a: ArticleOut): string {
  const parts = [a.feed_title, a.author].filter(Boolean) as string[];
  const iso = a.published_at ?? a.fetched_at;
  const d = new Date(iso);
  if (!Number.isNaN(d.getTime())) parts.push(`${d.getMonth() + 1}月${d.getDate()}日`);
  return parts.join(' · ');
}

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
  actions: css`
    flex: none;
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
    padding: 10px 16px;
    border-bottom: 1px solid ${token.colorFillQuaternary};
  `,
  spacer: css`
    flex: 1;
  `,
  scroll: css`
    flex: 1;
    overflow-y: auto;
  `,
  article: css`
    padding: 20px 28px 32px;
    max-width: 720px;
    margin: 0 auto;
  `,
  title: css`
    font-size: 22px;
    font-weight: 700;
    line-height: 1.35;
    color: ${token.colorText};
    margin-bottom: 6px;
  `,
  meta: css`
    font-size: 12px;
    color: ${token.colorTextTertiary};
    margin-bottom: 18px;
  `,
  summary: css`
    background: ${token.colorPrimaryBg};
    border: 1px solid ${token.colorPrimaryBorder};
    border-radius: ${token.borderRadius}px;
    padding: 12px 14px;
    margin-bottom: 20px;
  `,
  summaryLabel: css`
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 600;
    color: ${token.colorPrimary};
    margin-bottom: 6px;
  `,
  // Reader-rendered article HTML. Sanitized server-side by nh3 before it ever
  // reaches the client, so dangerouslySetInnerHTML is safe here.
  content: css`
    font-size: 15px;
    line-height: 1.7;
    color: ${token.colorText};
    word-break: break-word;
    img,
    figure,
    video {
      max-width: 100%;
      height: auto;
      border-radius: ${token.borderRadius}px;
    }
    a {
      color: ${token.colorLink};
    }
    pre {
      overflow-x: auto;
      background: ${token.colorFillQuaternary};
      padding: 12px;
      border-radius: ${token.borderRadius}px;
    }
    h1,
    h2,
    h3 {
      line-height: 1.4;
    }
  `,
}));

export default function Reader({
  article,
  onSetArticle,
  onToggleRead,
  onToggleStar,
  onToggleLater,
  onOpenSource,
}: {
  article: ArticleOut | null;
  onSetArticle: (a: ArticleOut) => void;
  onToggleRead: (id: string, value: boolean) => void;
  onToggleStar: (id: string, value: boolean) => void;
  onToggleLater: (id: string, value: boolean) => void;
  onOpenSource: (id: string) => void;
}) {
  const { styles } = useStyles();
  const { message } = App.useApp();
  const [summarizing, setSummarizing] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [showTranslated, setShowTranslated] = useState(false);

  // Per-article view state must not leak across article switches (AskPanel below
  // is intentionally NOT keyed — its Q&A spans the whole reading list).
  useEffect(() => {
    setShowTranslated(false);
  }, [article?.id]);

  if (!article) {
    return (
      <div className={styles.col}>
        <div className={styles.empty}>
          <Empty icon={BookOpen} title="选择一篇文章" description="从中间的列表里挑一篇开始阅读。" />
        </div>
      </div>
    );
  }

  const a = article;

  const summarize = () => {
    setSummarizing(true);
    summarizeArticle(a.id)
      .then((r) => onSetArticle({ ...a, ai_summary: r.summary }))
      .catch(() => message.error('生成摘要失败,请重试'))
      .finally(() => setSummarizing(false));
  };

  const translate = () => {
    if (a.translated_html) {
      setShowTranslated((v) => !v);
      return;
    }
    setTranslating(true);
    translateArticle(a.id, '中文')
      .then((r) => {
        onSetArticle({ ...a, translated_html: r.html, translated_lang: '中文' });
        setShowTranslated(true);
      })
      .catch(() => message.error('翻译失败,请重试'))
      .finally(() => setTranslating(false));
  };

  const saveNote = () => {
    saveArticleNote(a.id)
      .then((r) => {
        onSetArticle({ ...a, note_id: r.note_id });
        message.success('已存为笔记');
      })
      .catch(() => message.error('存为笔记失败,请重试'));
  };

  const bodyHtml = showTranslated && a.translated_html ? a.translated_html : a.extracted_html;

  return (
    <div className={styles.col}>
      <div className={styles.actions}>
        <Button
          size="small"
          type={a.is_read ? 'default' : 'primary'}
          icon={<Check size={14} />}
          onClick={() => onToggleRead(a.id, !a.is_read)}
        >
          {a.is_read ? '已读' : '标为已读'}
        </Button>
        <Button
          size="small"
          icon={<Star size={14} fill={a.is_starred ? 'currentColor' : 'none'} />}
          onClick={() => onToggleStar(a.id, !a.is_starred)}
        >
          星标
        </Button>
        <Button
          size="small"
          icon={<Clock size={14} />}
          onClick={() => onToggleLater(a.id, !a.read_later)}
        >
          {a.read_later ? '已加入稍后读' : '稍后读'}
        </Button>
        <span className={styles.spacer} />
        <Button size="small" icon={<Sparkles size={14} />} loading={summarizing} onClick={summarize}>
          摘要
        </Button>
        <Button
          size="small"
          icon={<Languages size={14} />}
          loading={translating}
          onClick={translate}
        >
          {a.translated_html ? (showTranslated ? '原文' : '翻译') : '翻译'}
        </Button>
        <Button
          size="small"
          icon={<StickyNote size={14} />}
          disabled={!!a.note_id}
          onClick={saveNote}
        >
          {a.note_id ? '已存为笔记' : '存为笔记'}
        </Button>
      </div>

      <div className={styles.scroll}>
        <div className={styles.article}>
          <div className={styles.title}>{a.title || '无标题'}</div>
          <div className={styles.meta}>
            {metaLine(a)}
            {a.url && (
              <>
                {' · '}
                <a href={a.url} target="_blank" rel="noopener noreferrer nofollow">
                  原文 <ExternalLink size={11} style={{ verticalAlign: 'middle' }} />
                </a>
              </>
            )}
          </div>

          {a.ai_summary && (
            <div className={styles.summary}>
              <div className={styles.summaryLabel}>
                <Sparkles size={13} /> AI 摘要
              </div>
              <Markdown>{a.ai_summary}</Markdown>
            </div>
          )}

          {bodyHtml ? (
            <div className={styles.content} dangerouslySetInnerHTML={{ __html: bodyHtml }} />
          ) : (
            <Empty title="正文为空" description="这篇文章没有可读取的正文,试试打开原文。" paddingBlock={32} />
          )}
        </div>
      </div>

      <AskPanel onOpenSource={onOpenSource} />
    </div>
  );
}
