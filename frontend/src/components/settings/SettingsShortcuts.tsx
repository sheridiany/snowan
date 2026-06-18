import { Block, Text } from '@lobehub/ui';
import { createStyles } from 'antd-style';

type Shortcut = { action: string; keys: string[] };

const SHORTCUTS: Shortcut[] = [
  { action: '新建会话', keys: ['⌘', 'N'] },
  { action: '发送消息', keys: ['Enter'] },
  { action: '换行', keys: ['⇧', 'Enter'] },
  { action: '切换深色模式', keys: ['⌘', '⇧', 'L'] },
];

const useStyles = createStyles(({ token, css }) => ({
  card: css`
    padding: 18px;
    border-radius: ${token.borderRadiusLG}px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  `,
  title: css`
    font-size: 14px;
    font-weight: 600;
    color: ${token.colorText};
  `,
  list: css`
    display: flex;
    flex-direction: column;
  `,
  row: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 4px;
    border-bottom: 1px solid ${token.colorBorderSecondary};
    &:last-child {
      border-bottom: none;
    }
  `,
  action: css`
    font-size: 13px;
    color: ${token.colorText};
  `,
  keys: css`
    display: flex;
    align-items: center;
    gap: 6px;
  `,
  key: css`
    min-width: 24px;
    height: 24px;
    padding: 0 7px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 7px;
    background: ${token.colorFillQuaternary};
    border: 1px solid ${token.colorBorderSecondary};
    box-shadow: 0 1px 0 ${token.colorBorderSecondary};
    font-family: ${token.fontFamilyCode};
    font-size: 12px;
    color: ${token.colorTextSecondary};
  `,
}));

export default function SettingsShortcuts() {
  const { styles } = useStyles();

  return (
    <Block variant="outlined" className={styles.card}>
      <Text className={styles.title}>快捷键</Text>
      <div className={styles.list}>
        {SHORTCUTS.map((s) => (
          <div className={styles.row} key={s.action}>
            <span className={styles.action}>{s.action}</span>
            <span className={styles.keys}>
              {s.keys.map((k, i) => (
                <kbd className={styles.key} key={i}>
                  {k}
                </kbd>
              ))}
            </span>
          </div>
        ))}
      </div>
    </Block>
  );
}
