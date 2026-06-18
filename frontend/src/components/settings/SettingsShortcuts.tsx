import { Hotkey } from '@lobehub/ui';
import { createStyles } from 'antd-style';
import { Row, Section } from './_kit';

type Shortcut = { action: string; keys: string };

const SHORTCUTS: Shortcut[] = [
  { action: '新建会话', keys: 'mod+n' },
  { action: '发送', keys: 'enter' },
  { action: '换行', keys: 'shift+enter' },
  { action: '切换深色', keys: 'mod+shift+l' },
  { action: '打开设置', keys: 'mod+comma' },
];

const useStyles = createStyles(({ css }) => ({
  wrap: css`
    display: flex;
    flex-direction: column;
    gap: 28px;
  `,
}));

export default function SettingsShortcuts() {
  const { styles } = useStyles();

  return (
    <div className={styles.wrap}>
      <Section title="快捷键" subtitle="键盘操作一览">
        {SHORTCUTS.map((s) => (
          <Row key={s.action} label={s.action} control={<Hotkey keys={s.keys} variant="outlined" />} />
        ))}
      </Section>
    </div>
  );
}
