import type { ReactNode } from 'react';
import { createStyles } from 'antd-style';
import { TYPE } from '../theme/themes';

const useStyles = createStyles(({ token, css }) => ({
  detail: css`
    position: relative;
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    background: ${token.colorBgContainer};
    border-radius: ${token.borderRadiusLG}px;
    box-shadow: ${token.boxShadowTertiary};
    overflow: hidden;
  `,
  // A single soft hero bloom layered above the base container fill (opt-in via
  // the glow prop). No backdrop-filter here — this is a large surface.
  glow: css`
    background: ${token.colorHeroGlow}, ${token.colorBgContainer};
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
    font-size: ${TYPE.section}px;
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
      {(title || extra) && (
        <header className={cx(styles.header, align === 'between' ? styles.between : styles.center)}>
          <span className={styles.title}>{title}</span>
          {align === 'between' && extra}
        </header>
      )}
      {children}
    </section>
  );
}
