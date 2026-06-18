import { Block, Text } from '@lobehub/ui';
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
    padding: 36px 24px 32px;
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
    gap: 8px;
  `,
  item: css`
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    cursor: pointer;
    transition:
      border-color 0.15s ease,
      background 0.15s ease;
    &:hover {
      border-color: ${token.colorPrimaryBorder};
    }
  `,
  itemActive: css`
    border-color: ${token.colorPrimary};
    background: ${token.colorPrimaryBg};
  `,
  iconWrap: css`
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
  iconWrapActive: css`
    background: ${token.colorPrimary};
    color: #fff;
  `,
  itemTitle: css`
    flex: 1;
    min-width: 0;
    font-size: 14px;
    font-weight: 500;
    color: ${token.colorText};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `,
  badge: css`
    flex: none;
    font-size: 11px;
    font-weight: 600;
    color: ${token.colorPrimary};
  `,
  empty: css`
    margin-top: 8px;
    padding: 56px 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    border-radius: ${token.borderRadiusLG}px;
    border: 1px dashed ${token.colorBorderSecondary};
    text-align: center;
  `,
  emptyIcon: css`
    width: 48px;
    height: 48px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: ${token.colorFillTertiary};
    color: ${token.colorTextTertiary};
    margin-bottom: 4px;
  `,
  emptyTitle: css`
    font-size: 15px;
    font-weight: 600;
    color: ${token.colorTextSecondary};
  `,
  emptySub: css`
    font-size: 13px;
    color: ${token.colorTextTertiary};
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
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>
              <MessageSquare size={22} strokeWidth={1.8} />
            </div>
            <Text className={styles.emptyTitle}>还没有会话</Text>
            <Text className={styles.emptySub}>开始一段新对话,它会出现在这里。</Text>
          </div>
        ) : (
          <div className={styles.list}>
            {sessions.map((s) => {
              const active = s.id === activeId;
              return (
                <Block
                  key={s.id}
                  variant="outlined"
                  className={cx(styles.item, active && styles.itemActive)}
                  onClick={() => onSelect(s.id)}
                  title={s.title}
                >
                  <div
                    className={cx(styles.iconWrap, active && styles.iconWrapActive)}
                  >
                    <MessageSquare size={18} strokeWidth={1.8} />
                  </div>
                  <Text className={styles.itemTitle}>{s.title}</Text>
                  {active && <Text className={styles.badge}>当前</Text>}
                </Block>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
