import { ActionIcon, Empty } from '@lobehub/ui';
import { Image, Modal } from 'antd';
import { createStyles } from 'antd-style';
import { Copy, Heart, Trash2 } from 'lucide-react';

import { imageFileUrl, type LibraryEntry } from '../../api/imagegen';
import { useResizableWidth } from '../shell/useResizableWidth';
import { LAYOUT } from '../../theme/themes';

const useStyles = createStyles(({ token, css }) => ({
  panel: css`
    position: relative;
    flex: none;
    display: flex;
    flex-direction: column;
    background: ${token.colorBgContainer};
    border-radius: ${token.borderRadiusLG}px;
    box-shadow: ${token.boxShadowTertiary};
    overflow: hidden;
  `,
  handle: css`
    position: absolute;
    top: 8px;
    bottom: 8px;
    left: 0;
    width: ${LAYOUT.handle}px;
    cursor: col-resize;
    z-index: 5;
    &:hover::after {
      content: '';
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      width: 2px;
      border-radius: 2px;
      background: ${token.colorPrimary};
      opacity: 0.5;
    }
  `,
  header: css`
    flex: none;
    height: ${LAYOUT.headerHeight}px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 14px;
    font-size: 14px;
    font-weight: 600;
    color: ${token.colorText};
  `,
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
  embedded?: boolean;
};

export default function ImgLibraryPanel({ library, onUsePrompt, onDelete, embedded }: Props) {
  const { styles } = useStyles();
  const { width, onResizeStart } = useResizableWidth({
    key: 'snowan.imagegen.libraryWidth',
    initial: 300,
    min: 240,
    max: 480,
    side: 'left',
  });

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
        description="在生成的图上点收藏,它会出现在这里。"
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
                title="复制提示词到输入框"
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

  if (embedded) {
    return (
      <div className={styles.embeddedRoot}>
        <div className={styles.scroll}>{content}</div>
      </div>
    );
  }

  return (
    <aside className={styles.panel} style={{ width }}>
      <div className={styles.header}>
        <Heart size={16} />
        收藏
      </div>
      <div className={styles.scroll}>{content}</div>
      <div className={styles.handle} onPointerDown={onResizeStart} />
    </aside>
  );
}
