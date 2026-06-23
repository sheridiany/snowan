import { App, Upload } from 'antd';
import { ActionIcon } from '@lobehub/ui';
import { createStyles } from 'antd-style';
import { BookOpen, Layers, Plus, Sparkles, Trash2 } from 'lucide-react';

import { ListPane, ListRow, type NavProps } from '../shell/ListPane';
import { coverUrl, type BookOut } from '../../api/books';

const useStyles = createStyles(({ token, css }) => ({
  add: css`
    display: flex;
    align-items: center;
    gap: 4px;
    margin: 4px 6px 10px;
  `,
  syntActive: css`
    color: ${token.colorPrimary};
    background: ${token.colorPrimaryBg};
    border-radius: ${token.borderRadius}px;
  `,
  group: css`
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.03em;
    color: ${token.colorTextTertiary};
    padding: 10px 10px 4px;
  `,
  cover: css`
    flex: none;
    width: 28px;
    height: 38px;
    border-radius: 3px;
    object-fit: cover;
    background: ${token.colorFillTertiary};
  `,
  bookRow: css`
    position: relative;
    &:hover .book-actions {
      opacity: 1;
    }
  `,
  actions: css`
    display: inline-flex;
    align-items: center;
    gap: 2px;
    opacity: 0;
    transition: opacity 0.12s ease;
  `,
}));

export default function BookShelf({
  view,
  onView,
  onNewChat,
  books,
  activeId,
  loading,
  uploading,
  coverBusy,
  syntopicalMode,
  onToggleSyntopical,
  onSelect,
  onUpload,
  onGenCover,
  onDelete,
}: NavProps & {
  books: BookOut[];
  activeId: string | null;
  loading: boolean;
  uploading: boolean;
  coverBusy: boolean;
  syntopicalMode: boolean;
  onToggleSyntopical: () => void;
  onSelect: (id: string) => void;
  onUpload: (file: File) => Promise<unknown>;
  onGenCover: (id: string) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
}) {
  const { styles, cx } = useStyles();
  const { modal, message } = App.useApp();

  const confirmDelete = (b: BookOut) =>
    modal.confirm({
      title: '删除这本书?',
      content: `“${b.title || '无标题'}” 及其章节将被移除。`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => onDelete(b.id),
    });

  return (
    <ListPane view={view} onView={onView} onNewChat={onNewChat}>
      <div className={styles.add}>
        <Upload
          accept=".epub"
          maxCount={1}
          showUploadList={false}
          beforeUpload={(file) => {
            onUpload(file as unknown as File)
              .then(() => message.success('已上传'))
              .catch(() => message.error('上传失败'));
            return false;
          }}
        >
          <ActionIcon icon={Plus} title="上传 epub" loading={uploading} />
        </Upload>
        <ActionIcon
          icon={Layers}
          title="主题阅读 · 跨书对照"
          className={syntopicalMode ? styles.syntActive : undefined}
          onClick={onToggleSyntopical}
        />
      </div>

      <div className={styles.group}>书架</div>

      {books.map((b) => (
        <div key={b.id} className={styles.bookRow}>
          <ListRow
            icon={b.cover_url ? undefined : BookOpen}
            label={b.title || '无标题'}
            sub={b.author || `${b.n_chapters} 章`}
            active={activeId === b.id}
            onClick={() => onSelect(b.id)}
            right={
              <span className={cx(styles.actions, 'book-actions')} onClick={(e) => e.stopPropagation()}>
                <ActionIcon
                  icon={Sparkles}
                  size="small"
                  title="生成封面"
                  loading={coverBusy}
                  onClick={() => onGenCover(b.id)}
                />
                <ActionIcon
                  icon={Trash2}
                  size="small"
                  title="删除"
                  onClick={() => confirmDelete(b)}
                />
              </span>
            }
          />
          {b.cover_url && (
            <img
              className={styles.cover}
              src={coverUrl(b.id)}
              alt=""
              style={{ position: 'absolute', left: 10, top: 9 }}
            />
          )}
        </div>
      ))}

      {!loading && books.length === 0 && (
        <div className={styles.group} style={{ fontWeight: 400 }}>
          还没有书,上传一本 epub 开始。
        </div>
      )}
    </ListPane>
  );
}
