/**
 * Motion tokens. Every animated component draws from these so the product moves
 * as one system: quick, ease-out, no bounce. Reduced-motion is honoured globally
 * by <MotionConfig reducedMotion="user"> in App.tsx.
 */
import type { Transition, Variants } from 'motion/react';

export const EASE = [0.2, 0, 0, 1] as const;

export const DUR = { fast: 0.12, base: 0.18, slow: 0.24, data: 0.6 } as const;

export const t = {
  fast: { duration: DUR.fast, ease: EASE } satisfies Transition,
  base: { duration: DUR.base, ease: EASE } satisfies Transition,
  slow: { duration: DUR.slow, ease: EASE } satisfies Transition,
  /** For data marks (score bars, funnels): long enough to read as "filling", never springy. */
  data: { duration: DUR.data, ease: EASE } satisfies Transition,
  /** Shared-layout indicators (active nav item, tabs). */
  layout: { type: 'spring', stiffness: 520, damping: 42, mass: 0.7 } satisfies Transition,
};

/** Route content: a 4px rise and fade. Small enough to feel like focus, not travel. */
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 4 },
  enter: { opacity: 1, y: 0, transition: t.base },
  exit: { opacity: 0, transition: { duration: 0.08 } },
};

/** Lists that arrive together (search results, queue rows): short stagger, capped so long lists aren't slow. */
export const listVariants: Variants = {
  initial: {},
  enter: { transition: { staggerChildren: 0.025, delayChildren: 0.02 } },
};
export const itemVariants: Variants = {
  initial: { opacity: 0, y: 3 },
  enter: { opacity: 1, y: 0, transition: t.base },
};

/** Detail panels swapping content as selection changes. */
export const panelVariants: Variants = {
  initial: { opacity: 0, x: 6 },
  enter: { opacity: 1, x: 0, transition: t.base },
  exit: { opacity: 0, transition: { duration: 0.08 } },
};
