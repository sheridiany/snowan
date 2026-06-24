import type { CSSProperties, ElementType, ReactNode } from 'react';
import { createStyles } from 'antd-style';

const useStyles = createStyles(({ token, css }) => ({
  base: css`
    position: relative;
    border-radius: ${token.borderRadiusLG}px;
  `,
  solid: css`
    background: ${token.colorBgContainer};
    box-shadow: ${token.boxShadowTertiary};
  `,
  glass: css`
    background: ${token.colorGlassBg};
    backdrop-filter: blur(${token.glassBlur});
    -webkit-backdrop-filter: blur(${token.glassBlur});
    border: 1px solid ${token.colorGlassBorder};
    box-shadow: ${token.shadowGlass};
  `,
  hero: css`
    background: ${token.colorHeroGlow}, ${token.colorBgContainer};
    box-shadow: ${token.boxShadowTertiary};
    overflow: hidden;
  `,
  glow: css`
    background: ${token.colorSurfaceGlow}, ${token.colorBgContainer};
  `,
}));

export type SurfaceVariant = 'solid' | 'glass' | 'hero';

// hero already layers its own scene spotlight + hero glow, and glass has no
// solid fill to tint — so the `glow` accent only composes with the solid variant.
type SolidWithGlow = { variant?: 'solid'; glow?: boolean };
type DecoratedVariant = { variant: Exclude<SurfaceVariant, 'solid'>; glow?: never };

type SurfaceProps = {
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
} & (SolidWithGlow | DecoratedVariant);

export default function Surface({
  variant = 'solid',
  glow,
  as,
  className,
  style,
  children,
}: SurfaceProps) {
  const { styles, cx } = useStyles();
  const Tag = as ?? 'div';
  return (
    <Tag
      className={cx(
        styles.base,
        styles[variant],
        glow && variant === 'solid' && styles.glow,
        className,
      )}
      style={style}
    >
      {children}
    </Tag>
  );
}
