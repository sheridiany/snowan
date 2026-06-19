import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

// Panel-toggle icons adapted from Craft Agents OSS (Apache-2.0): a rounded
// "squircle" container with a side divider, no arrow — Craft's signature
// sidebar/panel collapse affordance. lucide's PanelLeft/Right do NOT look like
// this, which is why swapping lucide names alone never matched the reference.
const BASE: IconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

// The shared squircle container outline.
const SQUIRCLE =
  'M3.5 11.5L3.5 12.5C3.5 16.2712 3.5 18.1569 4.67157 19.3284C5.84315 20.5 7.72876 20.5 11.5 20.5L12.5 20.5C16.2712 20.5 18.1569 20.5 19.3284 19.3284C20.5 18.1569 20.5 16.2712 20.5 12.5L20.5 11.5C20.5 7.72876 20.5 5.84315 19.3284 4.67157C18.1569 3.5 16.2712 3.5 12.5 3.5L11.5 3.5C7.72876 3.5 5.84315 3.5 4.67157 4.67157C3.5 5.84315 3.5 7.72876 3.5 11.5Z';

export function PanelLeftRounded({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...BASE} {...props}>
      <path d="M9 4V20" />
      <path d={SQUIRCLE} />
    </svg>
  );
}

export function PanelRightRounded({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...BASE} {...props}>
      <path d={SQUIRCLE} />
      <path d="M15 3.5C15.5506 9.19817 15.5506 14.8018 15 20.5" />
    </svg>
  );
}

// New-session pencil: lucide square-pen with a softer corner radius, matching
// Craft's SquarePenRounded.
export function SquarePenRounded({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...BASE} strokeWidth={2} {...props}>
      <path d="M12 3H7a4 4 0 0 0-4 4v10a4 4 0 0 0 4 4h10a4 4 0 0 0 4-4v-5" />
      <path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z" />
    </svg>
  );
}
