import { Empty } from '@lobehub/ui';
import { createStyles } from 'antd-style';
import { Newspaper, PenTool, Shapes } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { ListPane, type NavProps, type View } from '../shell/ListPane';

type PlaceholderView = Extract<View, 'draw' | 'design' | 'news'>;

const SPEC: Record<PlaceholderView, { label: string; icon: LucideIcon; description: string }> = {
  draw: {
    label: '画图',
    icon: Shapes,
    description: '把想法画成图 —— 流程图、示意图与脑图。这个板块正在规划中。',
  },
  design: {
    label: '设计',
    icon: PenTool,
    description: '探索界面与视觉设计方案。这个板块正在规划中。',
  },
  news: {
    label: '新闻',
    icon: Newspaper,
    description: '聚合并追踪你关心的资讯。这个板块正在规划中。',
  },
};

const useStyles = createStyles(({ token, css }) => ({
  detail: css`
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    background: ${token.colorBgContainer};
    border-radius: ${token.borderRadiusLG}px;
    box-shadow: ${token.boxShadowTertiary};
    overflow: hidden;
  `,
  detailHeader: css`
    flex: none;
    height: 52px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 16px;
  `,
  detailTitle: css`
    font-size: 14px;
    font-weight: 600;
    color: ${token.colorText};
  `,
  detailBody: css`
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32px;
  `,
}));

export default function ComingSoonView({
  view,
  onView,
  onNewChat,
  listCollapsed,
}: NavProps & { listCollapsed?: boolean }) {
  const { styles } = useStyles();
  const spec = SPEC[view as PlaceholderView];

  return (
    <>
      {!listCollapsed && (
        <ListPane view={view} onView={onView} onNewChat={onNewChat}>
          <Empty
            icon={spec.icon}
            title="即将上线"
            description="这个板块还在规划中。"
            paddingBlock={40}
          />
        </ListPane>
      )}

      <div className={styles.detail}>
        <div className={styles.detailHeader}>
          <span className={styles.detailTitle}>{spec.label}</span>
        </div>
        <div className={styles.detailBody}>
          <Empty icon={spec.icon} title={`${spec.label}即将上线`} description={spec.description} />
        </div>
      </div>
    </>
  );
}
