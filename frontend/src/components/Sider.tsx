import { Button, Text } from '@lobehub/ui';
import { createStyles } from 'antd-style';
import { useThemeMode } from '../theme/ThemeModeContext';
import type { Session } from './types';

const useStyles = createStyles(({ token, css }) => ({
  sider: css`
    width: 260px;
    flex: none;
    height: 100vh;
    display: flex;
    flex-direction: column;
    padding: 18px 14px 14px;
    background: ${token.colorBgContainer};
    border-right: 1px solid ${token.colorBorderSecondary};
  `,
  brand: css`
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 4px 6px 16px;
  `,
  mark: css`
    width: 28px;
    height: 28px;
    border-radius: 9px;
    flex: none;
    background: linear-gradient(135deg, ${token.colorPrimary}, #ffb066);
    box-shadow: 0 4px 12px ${token.colorPrimaryBorder};
  `,
  brandText: css`
    font-size: 18px;
    font-weight: 700;
    letter-spacing: 0.01em;
    color: ${token.colorText};
  `,
  newBtn: css`
    width: 100%;
    margin-bottom: 14px;
  `,
  listLabel: css`
    padding: 4px 8px;
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: ${token.colorTextTertiary};
  `,
  list: css`
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-top: 4px;
  `,
  item: css`
    padding: 9px 10px;
    border-radius: ${token.borderRadius}px;
    font-size: 13px;
    color: ${token.colorTextSecondary};
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: background 0.15s ease;
    &:hover {
      background: ${token.colorFillTertiary};
    }
  `,
  itemActive: css`
    background: ${token.colorFillSecondary};
    color: ${token.colorText};
    font-weight: 600;
  `,
  footer: css`
    padding-top: 10px;
    border-top: 1px solid ${token.colorBorderSecondary};
  `,
  toggle: css`
    width: 100%;
    justify-content: flex-start;
  `,
}));

export default function Sider({
  sessions,
  activeId,
  onSelect,
  onNew,
}: {
  sessions: Session[];
  activeId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  const { styles, cx } = useStyles();
  const { isDark, toggle } = useThemeMode();

  return (
    <aside className={styles.sider}>
      <div className={styles.brand}>
        <div className={styles.mark} />
        <Text className={styles.brandText}>Snowan</Text>
      </div>

      <Button className={styles.newBtn} type="primary" shape="round" onClick={onNew}>
        + 新对话
      </Button>

      <span className={styles.listLabel}>对话</span>
      <div className={styles.list}>
        {sessions.map((s) => (
          <div
            key={s.id}
            className={cx(styles.item, s.id === activeId && styles.itemActive)}
            onClick={() => onSelect(s.id)}
            title={s.title}
          >
            {s.title}
          </div>
        ))}
      </div>

      <div className={styles.footer}>
        <Button className={styles.toggle} type="text" onClick={toggle}>
          {isDark ? '☀️  浅色模式' : '🌙  深色模式'}
        </Button>
      </div>
    </aside>
  );
}
