import { Empty } from '@lobehub/ui';
import { createStyles } from 'antd-style';
import { PenTool } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { ListPane, type NavProps, type View } from '../shell/ListPane';
import DetailPane from '../../ui/DetailPane';

type PlaceholderView = Extract<View, 'design'>;

const SPEC: Record<PlaceholderView, { label: string; icon: LucideIcon; description: string }> = {
  design: {
    label: '设计',
    icon: PenTool,
    description: '探索界面与视觉设计方案。这个板块正在规划中。',
  },
};

const useStyles = createStyles(({ css }) => ({
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

      <DetailPane title={spec.label}>
        <div className={styles.detailBody}>
          <Empty icon={spec.icon} title={`${spec.label}即将上线`} description={spec.description} />
        </div>
      </DetailPane>
    </>
  );
}
