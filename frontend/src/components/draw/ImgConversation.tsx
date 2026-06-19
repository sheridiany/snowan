import { useEffect, useRef } from 'react';
import { ActionIcon, Empty } from '@lobehub/ui';
import { Modal } from 'antd';
import { createStyles } from 'antd-style';
import { Copy, Download, Heart, Image as ImageIcon, Loader2, Trash2 } from 'lucide-react';

import { imageFileUrl } from '../../api/imagegen';
import type { ImgTurn } from '../../hooks/useImagegen';

const useStyles = createStyles(({ token, css }) => ({
  scroll: css`
    flex: 1;
    overflow-y: auto;
  `,
  empty: css`
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  `,
  list: css`
    width: 100%;
    max-width: 760px;
    margin: 0 auto;
    padding: 28px 16px 24px;
    display: flex;
    flex-direction: column;
    gap: 26px;
  `,
  turn: css`
    display: flex;
    flex-direction: column;
    gap: 12px;
  `,
  prompt: css`
    align-self: flex-end;
    max-width: 80%;
    padding: 11px 15px;
    border-radius: 16px;
    background: ${token.colorPrimary};
    color: #fff;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
  `,
  pending: css`
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: ${token.colorTextSecondary};
    font-size: 13px;
    & svg {
      animation: imgspin 0.9s linear infinite;
    }
    @keyframes imgspin {
      to {
        transform: rotate(360deg);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      & svg {
        animation: none;
      }
    }
  `,
  error: css`
    align-self: flex-start;
    padding: 8px 12px;
    border-radius: ${token.borderRadius}px;
    background: ${token.colorErrorBg};
    border: 1px solid ${token.colorErrorBorder};
    color: ${token.colorErrorText};
    font-size: 13px;
  `,
  grid: css`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 12px;
  `,
  card: css`
    position: relative;
    border-radius: ${token.borderRadiusLG}px;
    overflow: hidden;
    background: ${token.colorFillTertiary};
    border: 1px solid ${token.colorBorderSecondary};
    &:hover .img-actions {
      opacity: 1;
    }
  `,
  img: css`
    display: block;
    width: 100%;
    height: auto;
  `,
  actions: css`
    position: absolute;
    top: 6px;
    right: 6px;
    display: flex;
    gap: 4px;
    padding: 4px;
    border-radius: ${token.borderRadius}px;
    background: ${token.colorBgMask};
    opacity: 0;
    transition: opacity 0.15s ease;
  `,
}));

type Props = {
  turns: ImgTurn[];
  onSave: (imageId: string, prompt: string, params: ImgTurn['params']) => void;
  onDownload: (imageId: string) => void;
  onDelete: (turnId: string, imageId: string) => void;
  onCopyPrompt: (prompt: string) => void;
};

export default function ImgConversation({
  turns,
  onSave,
  onDownload,
  onDelete,
  onCopyPrompt,
}: Props) {
  const { styles } = useStyles();
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (turns[turns.length - 1]?.status === 'pending') stickRef.current = true;
    if (stickRef.current) el.scrollTop = el.scrollHeight;
  }, [turns]);

  const confirmDelete = (turnId: string, imageId: string) =>
    Modal.confirm({
      title: '删除这张图?',
      content: '删除后无法撤销。',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => onDelete(turnId, imageId),
    });

  if (turns.length === 0) {
    return (
      <div className={styles.empty} ref={scrollRef}>
        <Empty
          icon={ImageIcon}
          title="开始画图"
          description="在下方输入描述,选择画图模型,点「生成」。"
        />
      </div>
    );
  }

  return (
    <div className={styles.scroll} ref={scrollRef} onScroll={onScroll}>
      <div className={styles.list}>
        {turns.map((t) => (
          <div key={t.id} className={styles.turn}>
            <div className={styles.prompt}>{t.prompt}</div>
            {t.status === 'pending' && (
              <div className={styles.pending}>
                <Loader2 size={16} />
                生成中…
              </div>
            )}
            {t.status === 'error' && (
              <div className={styles.error}>{t.error || '生成失败,请重试。'}</div>
            )}
            {t.status === 'done' && t.images.length > 0 && (
              <div className={styles.grid}>
                {t.images.map((im) => (
                  <div key={im.id} className={styles.card}>
                    <img className={styles.img} src={imageFileUrl(im.id)} alt={t.prompt} />
                    <div className={`${styles.actions} img-actions`}>
                      <ActionIcon
                        icon={Heart}
                        size="small"
                        title="收藏"
                        onClick={() => onSave(im.id, t.prompt, t.params)}
                      />
                      <ActionIcon
                        icon={Download}
                        size="small"
                        title="下载"
                        onClick={() => onDownload(im.id)}
                      />
                      <ActionIcon
                        icon={Copy}
                        size="small"
                        title="复制提示词"
                        onClick={() => onCopyPrompt(t.prompt)}
                      />
                      <ActionIcon
                        icon={Trash2}
                        size="small"
                        title="删除"
                        onClick={() => confirmDelete(t.id, im.id)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
