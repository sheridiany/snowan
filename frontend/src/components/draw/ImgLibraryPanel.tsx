import { memo } from 'react';
import { ActionIcon, Empty } from '@lobehub/ui';
import { Image, Modal } from 'antd';
import { createStyles } from 'antd-style';
import { Copy, Heart, Trash2 } from 'lucide-react';

import { imageFileUrl, type LibraryEntry } from '../../api/imagegen';

const useStyles = createStyles(({ token, css }) => ({
  // Embedded inside RightPanel: the host provides the chrome, header and width.
  embeddedRoot: css`
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    overflow: hidden;
  `,
  scroll: css`
    flex: 1;
    overflow-y: auto;
    padding: 6px 10px 14px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  `,
  card: css`
    border-radius: ${token.borderRadiusLG}px;
    overflow: hidden;
    background: ${token.colorFillQuaternary};
    border: 1px solid ${token.colorBorderSecondary};
    &:hover .lib-actions {
      opacity: 1;
    }
  `,
  thumbWrap: css`
    position: relative;
    & .ant-image {
      display: block;
      width: 100%;
    }
    & .ant-image-img {
      display: block;
      width: 100%;
      height: auto;
      cursor: zoom-in;
    }
  `,
  actions: css`
    position: absolute;
    top: 6px;
    right: 6px;
    z-index: 2;
    display: flex;
    gap: 2px;
    padding: 3px;
    border-radius: ${token.borderRadius}px;
    /* Dark scrim + forced white icons: legible over any photo, both themes. */
    background: rgba(0, 0, 0, 0.55);
    backdrop-filter: blur(6px);
    opacity: 0;
    transition: opacity 0.15s ease;
    button {
      color: #fff !important;
    }
    button:hover {
      color: #fff !important;
      background: rgba(255, 255, 255, 0.22) !important;
    }
  `,
  meta: css`
    padding: 8px 10px 10px;
  `,
  prompt: css`
    font-size: 12px;
    line-height: 1.5;
    color: ${token.colorTextSecondary};
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  `,
}));

type Props = {
  library: LibraryEntry[];
  onUsePrompt: (prompt: string) => void;
  onDelete: (entry: LibraryEntry) => void;
};

function ImgLibraryPanel({ library, onUsePrompt, onDelete }: Props) {
  const { styles } = useStyles();

  const confirmDelete = (entry: LibraryEntry) =>
    Modal.confirm({
      title: '从收藏删除?',
      content: '删除后无法撤销。',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => onDelete(entry),
    });

  const content =
    library.length === 0 ? (
      <Empty
        icon={Heart}
        title="还没有收藏"
        description="生成的图会自动收藏到这里"
        paddingBlock={36}
      />
    ) : (
      library.map((e) => (
        <div key={e.id} className={styles.card}>
          <div className={styles.thumbWrap}>
            <Image src={imageFileUrl(e.previewId)} alt={e.prompt} preview={{ mask: false }} />
            <div className={`${styles.actions} lib-actions`}>
              <ActionIcon
                icon={Copy}
                size="small"
                title="复制提示词"
                onClick={() => onUsePrompt(e.prompt)}
              />
              <ActionIcon icon={Trash2} size="small" title="删除" onClick={() => confirmDelete(e)} />
            </div>
          </div>
          <div className={styles.meta}>
            <div className={styles.prompt}>{e.prompt}</div>
          </div>
        </div>
      ))
    );

  return (
    <div className={styles.embeddedRoot}>
      <div className={styles.scroll}>{content}</div>
    </div>
  );
}

export default memo(ImgLibraryPanel);
