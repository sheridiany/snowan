import type { ReactNode } from 'react';
import { createStyles } from 'antd-style';

const useStyles = createStyles(({ token, css }) => ({
  base: css`
    font-family: ${token.fontFamilyDisplay};
    font-optical-sizing: auto;
    color: ${token.colorText};
    margin: 0;
    text-wrap: balance;
  `,
  l1: css`
    font-size: 34px;
    font-weight: 600;
    line-height: 1.12;
    letter-spacing: -0.02em;
  `,
  l2: css`
    font-size: 24px;
    font-weight: 600;
    line-height: 1.18;
    letter-spacing: -0.015em;
  `,
  l3: css`
    font-size: 18px;
    font-weight: 600;
    line-height: 1.25;
    letter-spacing: -0.01em;
  `,
}));

export default function DisplayHeading({
  level = 2,
  className,
  children,
}: {
  level?: 1 | 2 | 3;
  className?: string;
  children: ReactNode;
}) {
  const { styles, cx } = useStyles();
  const Tag = (`h${level}` as const) satisfies 'h1' | 'h2' | 'h3';
  const sizeClass = level === 1 ? styles.l1 : level === 2 ? styles.l2 : styles.l3;
  return <Tag className={cx(styles.base, sizeClass, className)}>{children}</Tag>;
}
