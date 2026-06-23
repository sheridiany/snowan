import type { TargetAndTransition, Variants } from 'motion/react';

// Shared easing curves. `standard` is the workhorse (entrances / layout);
// `emphasized` for larger expressive moves; `spring` a snappy overshoot-free
// tween; `exit` an accelerate-out for things leaving.
export const EASING = {
  standard: 'cubic-bezier(0.2, 0, 0, 1)',
  emphasized: 'cubic-bezier(0.3, 0, 0, 1)',
  spring: 'cubic-bezier(0.34, 1.2, 0.64, 1)',
  exit: 'cubic-bezier(0.4, 0, 1, 1)',
} as const;

// Numeric tuple form for framer-motion transition.ease.
const STANDARD = [0.2, 0, 0, 1] as const;
const SPRING = [0.34, 1.2, 0.64, 1] as const;

// framer-motion drives transforms via JS, so the app's global CSS
// `prefers-reduced-motion` reset (App.tsx) can't reach them. Read the
// preference here and drop the translational `y` displacement when reduce is
// requested — opacity fades stay, motion that can trigger the vestibular
// system goes. Evaluated once at module load (the toggle is OS-level and a
// reload re-reads it); SSR-safe via the matchMedia guard.
const prefersReducedMotion =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const rise = (y: number) => (prefersReducedMotion ? 0 : y);

// Fade + rise on entry.
export const fadeRise: Variants = {
  hidden: { opacity: 0, y: rise(10) },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: STANDARD },
  },
};

// Parent that staggers its children in sequence.
export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
};

// Child item for staggerContainer.
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: rise(12) },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.42, ease: STANDARD },
  },
};

// Hover lift — pass to whileHover.
export const lift: TargetAndTransition = {
  y: rise(-3),
  transition: { duration: 0.2, ease: SPRING },
};
