import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { createStyles } from 'antd-style';

// Legible ink over the accent fill — white or near-black, whichever wins
// contrast (mirrors themes.ts onAccent so light themes stay readable).
const useStyles = createStyles(({ token, css }) => {
  const relLum = (hex: string) => {
    const c = hex.replace('#', '');
    const ch = (i: number) => {
      const x = parseInt(c.slice(i, i + 2), 16) / 255;
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * ch(0) + 0.7152 * ch(2) + 0.0722 * ch(4);
  };
  const contrast = (a: number, b: number) =>
    (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  const la = relLum(token.colorPrimary);
  const ink = contrast(la, 1) >= contrast(la, relLum('#1a1a1a')) ? '#ffffff' : '#1a1a1a';
  const dim = ink === '#ffffff' ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.35)';
  return {
    thumb: css`
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: none;
      overflow: hidden;
      color: ${ink};
      font-weight: 600;
      background: ${token.colorBrandGradient};
      /* Hairline top highlight — single inset, keeps the lit-edge feel. */
      box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.25);
    `,
    glyph: css`
      position: relative;
      z-index: 1;
      display: inline-flex;
      filter: drop-shadow(0 1px 2px ${dim});
    `,
  };
});

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
  // seed is retained for API compatibility but no longer drives color — the
  // fill is the single brand gradient (no per-item neon).
  void seed;
  return (
    <span
      className={styles.thumb}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        fontSize: Math.round(size * 0.4),
      }}
    >
      <span className={styles.glyph}>
        {Icon ? <Icon size={Math.round(size * 0.42)} strokeWidth={1.9} /> : children}
      </span>
    </span>
  );
}
