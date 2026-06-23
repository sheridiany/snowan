import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { createStyles } from 'antd-style';
import { pickGradient } from './gradients';

const useStyles = createStyles(({ css }) => ({
  thumb: css`
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    overflow: hidden;
    color: rgba(255, 255, 255, 0.92);
    font-weight: 600;
    /* Hairline highlight + soft inner shade lift the flat gradient into glass. */
    box-shadow:
      inset 0 1px 0 0 rgba(255, 255, 255, 0.35),
      inset 0 0 0 1px rgba(255, 255, 255, 0.12),
      inset 0 -10px 24px -8px rgba(0, 0, 0, 0.25);
    &::after {
      content: '';
      position: absolute;
      inset: 0;
      background: radial-gradient(
        80% 60% at 28% 18%,
        rgba(255, 255, 255, 0.3) 0%,
        transparent 60%
      );
      pointer-events: none;
    }
  `,
  glyph: css`
    position: relative;
    z-index: 1;
    display: inline-flex;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.25));
  `,
}));

export default function GradientThumb({
  seed,
  size = 40,
  radius = 12,
  icon: Icon,
  children,
}: {
  seed: string | number;
  size?: number;
  radius?: number;
  icon?: LucideIcon;
  // Falls back to a centered letter/label if no icon given.
  children?: ReactNode;
}) {
  const { styles } = useStyles();
  return (
    <span
      className={styles.thumb}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: pickGradient(seed),
        fontSize: Math.round(size * 0.4),
      }}
    >
      <span className={styles.glyph}>
        {Icon ? <Icon size={Math.round(size * 0.42)} strokeWidth={1.9} /> : children}
      </span>
    </span>
  );
}
