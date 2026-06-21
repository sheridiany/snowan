import type { ReactNode } from 'react';
import { createStyles } from 'antd-style';

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
  glow: css`
    background: ${token.colorSurfaceGlow}, ${token.colorBgContainer};
  `,
  header: css`
    flex: none;
    height: 52px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 16px;
  `,
  center: css`
    justify-content: center;
  `,
  between: css`
    justify-content: space-between;
  `,
  title: css`
    font-size: 14px;
    font-weight: 600;
    color: ${token.colorText};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
}));

export default function DetailPane({
  title,
  align = 'center',
  extra,
  glow,
  children,
}: {
  title?: ReactNode;
  align?: 'center' | 'between';
  extra?: ReactNode;
  glow?: boolean;
  children: ReactNode;
}) {
  const { styles, cx } = useStyles();
  return (
    <section className={cx(styles.detail, glow && styles.glow)}>
      <header className={cx(styles.header, align === 'between' ? styles.between : styles.center)}>
        <span className={styles.title}>{title}</span>
        {align === 'between' && extra}
      </header>
      {children}
    </section>
  );
}
