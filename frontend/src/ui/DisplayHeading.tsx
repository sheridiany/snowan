import type { ReactNode } from 'react';
import { createStyles } from 'antd-style';
import { TYPE } from '../theme/themes';

const useStyles = createStyles(({ token, css }) => ({
  base: css`
    font-optical-sizing: auto;
    color: ${token.colorText};
    margin: 0;
    text-wrap: balance;
  `,
  // Fraunces display only at ≥20px; negative tracking only above 18px.
  serif: css`
    font-family: ${token.fontFamilyDisplay};
  `,
  l1: css`
    font-size: ${TYPE.display}px;
    font-weight: 600;
    line-height: 1.1;
    letter-spacing: -0.02em;
  `,
  l2: css`
    font-size: ${TYPE.page}px;
    font-weight: 600;
    line-height: 1.15;
    letter-spacing: -0.018em;
  `,
  l3: css`
    font-size: ${TYPE.block}px;
    font-weight: 600;
    line-height: 1.25;
    letter-spacing: -0.012em;
  `,
  // level4: small-section heading — Inter 600, no serif, no negative tracking.
  l4: css`
    font-size: ${TYPE.section}px;
    font-weight: 600;
    line-height: 1.3;
  `,
}));

export default function DisplayHeading({
  level = 2,
  className,
  children,
}: {
  level?: 1 | 2 | 3 | 4;
  className?: string;
  children: ReactNode;
}) {
  const { styles, cx } = useStyles();
  const Tag = (`h${level}` as const) satisfies 'h1' | 'h2' | 'h3' | 'h4';
  const sizeClass =
    level === 1 ? styles.l1 : level === 2 ? styles.l2 : level === 3 ? styles.l3 : styles.l4;
  return (
    <Tag className={cx(styles.base, level !== 4 && styles.serif, sizeClass, className)}>
      {children}
    </Tag>
  );
}
