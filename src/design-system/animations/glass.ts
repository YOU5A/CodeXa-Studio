/**
 * Liquid Glass Motion Presets
 *
 * Apple-style glass animations for entrance, hover, press, and transitions.
 * All presets use Framer Motion spring physics for natural, fluid motion.
 *
 * Performance: Filter blur() animation is omitted — it forces expensive GPU
 * repaints on every frame. Blur is handled by static backdrop-filter layers.
 *
 * @module design-system/animations/glass
 */

import type { Transition, Variants, TargetAndTransition } from "framer-motion";

/* ─── Shared Spring Configs ─── */

const springEntrance: Transition = {
  type: "spring",
  stiffness: 280,
  damping: 32,
  mass: 0.9,
};

const springInteractive: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 34,
  mass: 0.7,
};

const springPress: Transition = {
  type: "spring",
  stiffness: 550,
  damping: 38,
  mass: 0.5,
};

/* ─── Glass Entrance Variants ─── */

/**
 * Standard glass surface entrance — fade + slight scale + subtle Y slide.
 * For cards, panels, and general content surfaces.
 * Uses staggered children for nested content reveal.
 */
export const glassEntrance: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.97,
    y: 8,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      ...springEntrance,
      staggerChildren: 0.04,
    } satisfies Transition,
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    y: -4,
    transition: { duration: 0.15, ease: "easeIn" as const } satisfies Transition,
  },
};

/**
 * Gentle glass reveal — slower, more dramatic entrance for hero surfaces.
 * Higher scale range, longer duration.
 */
export const glassReveal: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.94,
    y: 14,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 180,
      damping: 26,
      mass: 1,
      staggerChildren: 0.06,
    } satisfies Transition,
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    transition: { duration: 0.2, ease: "easeIn" as const } satisfies Transition,
  },
};

/**
 * Pop-in entrance for modals, dialogs, and overlays.
 * Quick scale bounce — no blur for performance.
 */
export const glassPopIn: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.88,
    y: 6,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 320,
      damping: 26,
      mass: 0.8,
    } satisfies Transition,
  },
  exit: {
    opacity: 0,
    scale: 0.93,
    transition: { duration: 0.15, ease: "easeIn" as const } satisfies Transition,
  },
};

/* ─── Glass Hover Presets ─── */

/**
 * Subtle glass hover — gentle scale + shadow lift + border glow.
 * For cards and interactive glass surfaces.
 */
export const glassHover: {
  whileHover: TargetAndTransition;
  whileTap: TargetAndTransition;
} = {
  whileHover: {
    scale: 1.015,
    y: -2,
    boxShadow: "0 12px 40px rgba(0,0,0,0.10)",
    borderColor: "var(--border-strong)",
    transition: springInteractive,
  },
  whileTap: {
    scale: 0.985,
    y: 0,
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
    transition: springPress,
  },
};

/**
 * Pronounced glass lift — stronger scale and shadow for featured cards.
 */
export const glassLift: {
  whileHover: TargetAndTransition;
  whileTap: TargetAndTransition;
} = {
  whileHover: {
    scale: 1.03,
    y: -4,
    boxShadow: "0 20px 56px rgba(0,0,0,0.12)",
    borderColor: "var(--accent)",
    transition: springInteractive,
  },
  whileTap: {
    scale: 0.98,
    y: -1,
    boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
    transition: springPress,
  },
};

/**
 * Ghost hover — minimal feedback for subtle interactive areas.
 * No scale change, just a background tint shift.
 */
export const glassGhostHover: {
  whileHover: TargetAndTransition;
  whileTap: TargetAndTransition;
} = {
  whileHover: {
    background: "var(--bg-elevated)",
    transition: { duration: 0.15, ease: "easeOut" },
  },
  whileTap: {
    background: "var(--bg-tertiary)",
    transition: { duration: 0.08, ease: "easeOut" },
  },
};

/* ─── Glass Press Presets ─── */

/**
 * Standard glass press — subtle scale down + shadow collapse.
 * For buttons, toggles, and tappable elements.
 */
export const glassPress: {
  whileTap: TargetAndTransition;
  transition: Transition;
} = {
  whileTap: {
    scale: 0.96,
    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
  },
  transition: springPress,
};

/**
 * Heavy press — deeper scale reduction for prominent interactive elements.
 */
export const glassPressDeep: {
  whileTap: TargetAndTransition;
  transition: Transition;
} = {
  whileTap: {
    scale: 0.94,
    y: 1,
    boxShadow: "inset 0 1px 3px rgba(0,0,0,0.06)",
  },
  transition: springPress,
};

/* ─── Page Transition Variants ─── */

/**
 * Smooth page transition — crossfade with subtle slide.
 * For route-level page switching as seen in App.tsx.
 */
export const pageTransition: Variants = {
  initial: {
    opacity: 0,
    y: 8,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.25,
      ease: [0.16, 1, 0.3, 1],
    } satisfies Transition,
  },
  exit: {
    opacity: 0,
    y: -6,
    transition: {
      duration: 0.18,
      ease: "easeIn",
    } satisfies Transition,
  },
};

/**
 * Content swap transition — for inline content changes within a page.
 * Pure crossfade, no movement — keeps layout stable.
 */
export const contentTransition: Variants = {
  initial: {
    opacity: 0,
  },
  animate: {
    opacity: 1,
    transition: {
      duration: 0.2,
      ease: [0.16, 1, 0.3, 1],
    } satisfies Transition,
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.12,
      ease: "easeIn",
    } satisfies Transition,
  },
};

/* ─── Glass Focus Ring ─── */

/**
 * Focus ring animation — subtle glow pulse for input focus states.
 */
export const glassFocusRing: TargetAndTransition = {
  borderColor: "var(--accent)",
  boxShadow: "0 0 0 3px var(--accent-bg), 0 0 16px rgba(99,102,241,0.08)",
  transition: {
    type: "spring",
    stiffness: 400,
    damping: 30,
    mass: 0.6,
  },
};

export const glassFocusRingOut: TargetAndTransition = {
  borderColor: "var(--border-color)",
  boxShadow: "none",
  transition: { duration: 0.2, ease: "easeOut" },
};