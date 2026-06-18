import { Empty, ListItem, Tag, Text } from '@lobehub/ui';
import { createStyles } from 'antd-style';
import { MessageSquare } from 'lucide-react';

const useStyles = createStyles(({ token, css }) => ({
  scroll: css`
    flex: 1;
    overflow-y: auto;
  `,
  page: css`
    width: 100%;
    max-width: 760px;
    margin: 0 auto;
    padding: 28px 24px 32px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  `,
  header: css`
    display: flex;
    flex-direction: column;
    gap: 4px;
  `,
  title: css`
    font-size: 24px;
    font-weight: 700;
    color: ${token.colorText};
  `,
  sub: css`
    font-size: 13px;
    color: ${token.colorTextTertiary};
  `,
  list: css`
    display: flex;
    flex-direction: column;
    gap: 4px;
  `,
  avatar: css`
    width: 34px;
    height: 34px;
    flex: none;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: ${token.colorFillTertiary};
    color: ${token.colorTextSecondary};
  `,
  avatarActive: css`
    background: ${token.colorPrimary};
    color: #fff;
  `,
}));

export default function SessionsView({
  sessions,
  activeId,
  onSelect,
}: {
  sessions: { id: string; title: string }[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const { styles, cx } = useStyles();

  return (
    <div className={styles.scroll}>
      <div className={styles.page}>
        <div className={styles.header}>
          <Text className={styles.title}>所有会话</Text>
          <Text className={styles.sub}>
            {sessions.length > 0
              ? `共 ${sessions.length} 个会话`
              : '你的对话历史会显示在这里'}
          </Text>
        </div>

        {sessions.length === 0 ? (
          <Empty
            icon={MessageSquare}
            title="还没有会话"
            description="开始一段新对话,它会出现在这里。"
            paddingBlock={48}
          />
        ) : (
          <div className={styles.list}>
            {sessions.map((s) => {
              const active = s.id === activeId;
              return (
                <ListItem
                  key={s.id}
                  active={active}
                  title={s.title}
                  onClick={() => onSelect(s.id)}
                  avatar={
                    <div className={cx(styles.avatar, active && styles.avatarActive)}>
                      <MessageSquare size={18} strokeWidth={1.8} />
                    </div>
                  }
                  actions={active ? <Tag color="success">当前</Tag> : undefined}
                  showAction={active}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
