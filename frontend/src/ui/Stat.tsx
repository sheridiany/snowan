import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { createStyles } from 'antd-style';
import IconOrb from './IconOrb';
import StatusBadge, { type BadgeStatus } from './StatusBadge';

const useStyles = createStyles(({ token, css }) => ({
  root: css`
    display: flex;
    flex-direction: column;
    gap: 6px;
  `,
  head: css`
    display: flex;
    align-items: center;
    gap: 10px;
  `,
  value: css`
    font-family: ${token.fontFamilyDisplay};
    font-variant-numeric: tabular-nums;
    font-size: 32px;
    font-weight: 480;
    line-height: 1.05;
    letter-spacing: -0.02em;
    color: ${token.colorText};
  `,
  label: css`
    font-size: 12px;
    font-weight: 500;
    color: ${token.colorTextSecondary};
  `,
  row: css`
    display: flex;
    align-items: center;
    gap: 8px;
  `,
}));

export default function Stat({
  value,
  label,
  icon,
  trend,
  accent,
}: {
  value: ReactNode;
  label: ReactNode;
  icon?: LucideIcon;
  // Optional status pill (e.g. { status: 'success', text: '+12%' }).
  trend?: { status?: BadgeStatus; text: ReactNode };
  // Brand-tone the icon orb when true.
  accent?: boolean;
}) {
  const { styles } = useStyles();
  return (
    <div className={styles.root}>
      <div className={styles.head}>
        {icon && <IconOrb icon={icon} size="md" tone={accent ? 'brand' : 'neutral'} />}
        <span className={styles.value}>{value}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>{label}</span>
        {trend && (
          <StatusBadge status={trend.status ?? 'neutral'} size="sm">
            {trend.text}
          </StatusBadge>
        )}
      </div>
    </div>
  );
}
