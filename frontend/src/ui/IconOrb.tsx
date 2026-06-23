import type { LucideIcon } from 'lucide-react';
import { createStyles } from 'antd-style';

const useStyles = createStyles(({ token, css }) => {
  const rgb = (hex: string) => {
    const c = hex.replace('#', '');
    if (c.length !== 6) return '120, 120, 120';
    return [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16)).join(', ');
  };
  const brand = rgb(token.colorPrimary);
  return {
    orb: css`
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: none;
      border-radius: 50%;
      color: ${token.colorTextSecondary};
    `,
    neutral: css`
      background: ${token.colorFillQuaternary};
      box-shadow:
        inset 0 1px 0 0 rgba(255, 255, 255, 0.12),
        inset 0 0 0 1px ${token.colorBorderSecondary};
    `,
    brand: css`
      color: ${token.colorPrimary};
      background: rgba(${brand}, 0.12);
      box-shadow:
        inset 0 1px 0 0 rgba(255, 255, 255, 0.16),
        inset 0 0 0 1px rgba(${brand}, 0.28),
        0 0 18px -4px rgba(${brand}, 0.5);
    `,
  };
});

const SIZES: Record<'sm' | 'md' | 'lg', { box: number; icon: number }> = {
  sm: { box: 28, icon: 15 },
  md: { box: 36, icon: 18 },
  lg: { box: 48, icon: 24 },
};

export default function IconOrb({
  icon: Icon,
  size = 'md',
  tone = 'neutral',
}: {
  icon: LucideIcon;
  size?: 'sm' | 'md' | 'lg';
  tone?: 'neutral' | 'brand';
}) {
  const { styles, cx } = useStyles();
  const { box, icon } = SIZES[size];
  return (
    <span
      className={cx(styles.orb, tone === 'brand' ? styles.brand : styles.neutral)}
      style={{ width: box, height: box }}
    >
      <Icon size={icon} strokeWidth={1.75} />
    </span>
  );
}
