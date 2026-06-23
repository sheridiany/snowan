import type { ReactNode } from 'react';
import { createStyles } from 'antd-style';

export type BadgeStatus =
  | 'success'
  | 'info'
  | 'warning'
  | 'error'
  | 'neutral'
  | 'processing';

const useStyles = createStyles(({ token, css }) => {
  // Soft tinted pill: rgba fill derived from the status seed (no color-mix).
  // hexToRgb is inlined here so the primitive stays self-contained.
  const rgb = (hex: string) => {
    const c = hex.replace('#', '');
    if (c.length !== 6) return '120, 120, 120';
    return [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16)).join(', ');
  };
  const seeds: Record<BadgeStatus, string> = {
    success: token.colorSuccess,
    info: token.colorInfo,
    warning: token.colorWarning,
    error: token.colorError,
    processing: token.colorPrimary,
    neutral: token.colorTextSecondary,
  };
  const pill = (status: BadgeStatus) => {
    const t = rgb(seeds[status]);
    return css`
      color: rgba(${t}, 1);
      background: rgba(${t}, 0.12);
      box-shadow: inset 0 0 0 1px rgba(${t}, 0.22);
      .dot {
        background: rgba(${t}, 1);
      }
    `;
  };
  return {
    badge: css`
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border-radius: 999px;
      font-weight: 550;
      line-height: 1;
      white-space: nowrap;
      .dot {
        flex: none;
        border-radius: 50%;
      }
    `,
    sm: css`
      height: 20px;
      padding: 0 8px;
      font-size: 11px;
      .dot {
        width: 5px;
        height: 5px;
      }
    `,
    md: css`
      height: 24px;
      padding: 0 10px;
      font-size: 12px;
      .dot {
        width: 6px;
        height: 6px;
      }
    `,
    processing: css`
      .dot {
        animation: sbPulse 1.4s ease-in-out infinite;
      }
      @keyframes sbPulse {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.4;
        }
      }
    `,
    success: pill('success'),
    info: pill('info'),
    warning: pill('warning'),
    error: pill('error'),
    neutral: pill('neutral'),
    procColor: pill('processing'),
  };
});

export default function StatusBadge({
  status = 'neutral',
  size = 'md',
  children,
}: {
  status?: BadgeStatus;
  size?: 'sm' | 'md';
  children: ReactNode;
}) {
  const { styles, cx } = useStyles();
  const colorClass =
    status === 'processing' ? styles.procColor : styles[status];
  return (
    <span
      className={cx(
        styles.badge,
        size === 'sm' ? styles.sm : styles.md,
        colorClass,
        status === 'processing' && styles.processing,
      )}
    >
      <span className="dot" />
      {children}
    </span>
  );
}
