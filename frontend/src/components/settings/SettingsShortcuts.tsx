import { createStyles } from 'antd-style';
import { Row, Section } from './_kit';

type Shortcut = { action: string; keys: string[] };

const SHORTCUTS: Shortcut[] = [
  { action: '新建会话', keys: ['⌘', 'N'] },
  { action: '发送', keys: ['Enter'] },
  { action: '换行', keys: ['⇧', 'Enter'] },
  { action: '切换深色', keys: ['⌘', '⇧', 'L'] },
  { action: '打开设置', keys: ['⌘', ','] },
];

const useStyles = createStyles(({ token, css }) => ({
  wrap: css`
    display: flex;
    flex-direction: column;
    gap: 28px;
  `,
  keys: css`
    display: flex;
    align-items: center;
    gap: 5px;
  `,
  key: css`
    min-width: 26px;
    height: 26px;
    padding: 0 8px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 7px;
    background: ${token.colorBgElevated};
    border: 1px solid ${token.colorBorderSecondary};
    box-shadow: 0 1px 0 ${token.colorBorder};
    font-family: ${token.fontFamilyCode};
    font-size: 12.5px;
    font-weight: 500;
    color: ${token.colorTextSecondary};
  `,
}));

export default function SettingsShortcuts() {
  const { styles } = useStyles();

  return (
    <div className={styles.wrap}>
      <Section title="快捷键" subtitle="键盘操作一览">
        {SHORTCUTS.map((s) => (
          <Row
            key={s.action}
            label={s.action}
            control={
              <span className={styles.keys}>
                {s.keys.map((k, i) => (
                  <kbd className={styles.key} key={i}>
                    {k}
                  </kbd>
                ))}
              </span>
            }
          />
        ))}
      </Section>
    </div>
  );
}
