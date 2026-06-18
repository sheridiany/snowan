import { ActionIcon, Empty } from '@lobehub/ui';
import { createStyles } from 'antd-style';
import { PanelRightClose, Info } from 'lucide-react';

const useStyles = createStyles(({ token, css }) => ({
  panel: css`
    width: 300px;
    flex: none;
    display: flex;
    flex-direction: column;
    background: ${token.colorBgContainer};
    border-left: 1px solid ${token.colorBorderSecondary};
  `,
  header: css`
    height: 46px;
    flex: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 10px 0 16px;
    border-bottom: 1px solid ${token.colorBorderSecondary};
    font-size: 13px;
    font-weight: 600;
    color: ${token.colorText};
  `,
  body: css`
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  `,
}));

export default function RightPanel({ onClose }: { onClose: () => void }) {
  const { styles } = useStyles();
  return (
    <aside className={styles.panel}>
      <div className={styles.header}>
        <span>详情</span>
        <ActionIcon icon={PanelRightClose} size="small" title="折叠" onClick={onClose} />
      </div>
      <div className={styles.body}>
        <Empty icon={Info} title="暂无详情" description="选中内容后,这里显示上下文与来源。" />
      </div>
    </aside>
  );
}
