/**
 * Liquid Glass Material System
 *
 * Defines the visual properties for each glass tier.
 * Combines color tokens (from CSS vars), blur config, and
 * border/shadow styling into a unified material definition.
 *
 * Three-tier hierarchy:
 *   Ultra Thin — sidebar headings, toolbars, subtle surfaces
 *   Regular    — cards, panels, primary interactive surfaces
 *   Thick      — main content panels, prominent surfaces
 *   Elevated   — modals, dialogs, overlays
 */

import { glass } from "../tokens/colors";
import { blurHierarchy } from "../tokens/blur";
import { radii } from "../tokens/spacing";
import type { GlassTier } from "../tokens";

/* ─── Glass Seed — Randomized Parameters per Surface ─── */
export interface GlassSeed {
  /** Gradient angle in degrees (light: 105-165, dark: 285-345) */
  angle: number;
  /** Specular highlight intensity multiplier (0.7-1.4) */
  intensity: number;
  /** Noise texture opacity (0.02-0.06) */
  noiseStrength: number;
  /** Seed value for deterministic recreation */
  seed: number;
}

/** Generate a random glass seed. Use useRef(Math.random()) per component mount. */
export function generateGlassSeed(): GlassSeed {
  const s = Math.random();
  return {
    angle: 105 + s * 60,        // 105-165 deg for light theme base
    intensity: 0.5 + s * 0.5,   // 0.5-1.0
    noiseStrength: 0.02 + s * 0.04, // 0.02-0.06
    seed: s,
  };
}

/* ─── Material Properties ─── */
export interface GlassMaterial {
  /** Background color (CSS variable reference) */
  bg: string;
  /** Border color (CSS variable reference) */
  border: string;
  /** Backdrop-filter blur radius in px */
  blur: number;
  /** Saturation multiplier */
  saturation: number;
  /** Background opacity */
  opacity: number;
  /** Full CSS backdrop-filter string */
  backdropFilter: string;
  /** Default border-radius for this tier */
  radius: number;
  /** Box-shadow when elevated/hovered */
  shadow: string;
  /** Specular highlight CSS gradient (multi-layer with bg) */
  specularHighlight: string;
  /** Inner shadow for edge light catch */
  innerShadow: string;
  /** Noise texture opacity override */
  noiseOpacity: number;
}

/* ─── Shadow Presets ─── */
const SHADOWS = {
  sm: "0 1px 3px rgba(0,0,0,0.06)",
  md: "0 4px 12px rgba(0,0,0,0.08)",
  lg: "0 8px 32px rgba(0,0,0,0.10)",
  xl: "0 16px 48px rgba(0,0,0,0.08)",
} as const;

/* ─── Material Catalogue ─── */
export const materials: Record<GlassTier, GlassMaterial> = {
  ultraThin: {
    bg:             glass.ultraThin.bg,
    border:         glass.ultraThin.border,
    blur:           blurHierarchy.ultraThin.blur,
    saturation:     blurHierarchy.ultraThin.saturation,
    opacity:        blurHierarchy.ultraThin.opacity,
    backdropFilter: blurHierarchy.ultraThin.cssValue,
    radius:         radii.md,
    shadow:         SHADOWS.sm,
    specularHighlight: "linear-gradient(var(--glass-angle, 135deg), rgba(var(--glass-glow-rgb,255,255,255),calc(var(--glass-highlight-opacity,0.08)*0.2)) 0%, rgba(var(--glass-glow-rgb,255,255,255),calc(var(--glass-highlight-opacity,0.08)*0.1)) 45%, rgba(var(--glass-glow-rgb,255,255,255),calc(var(--glass-highlight-opacity,0.08)*0.02)) 70%, rgba(var(--glass-glow-rgb,255,255,255),calc(var(--glass-highlight-opacity,0.08)*0.06)) 100%)",
    innerShadow:    "inset 0 1px 1px rgba(var(--glass-glow-rgb,255,255,255),0.08)",
    noiseOpacity:   0.025,
  },
  regular: {
    bg:             glass.regular.bg,
    border:         glass.regular.border,
    blur:           blurHierarchy.regular.blur,
    saturation:     blurHierarchy.regular.saturation,
    opacity:        blurHierarchy.regular.opacity,
    backdropFilter: blurHierarchy.regular.cssValue,
    radius:         radii.lg,
    shadow:         SHADOWS.md,
    specularHighlight: "linear-gradient(var(--glass-angle, 135deg), rgba(var(--glass-glow-rgb,255,255,255),var(--glass-highlight-opacity,0.08)) 0%, rgba(var(--glass-glow-rgb,255,255,255),calc(var(--glass-highlight-opacity,0.08)*0.15)) 35%, rgba(var(--glass-glow-rgb,255,255,255),calc(var(--glass-highlight-opacity,0.08)*0.02)) 55%, rgba(var(--glass-glow-rgb,255,255,255),calc(var(--glass-highlight-opacity,0.08)*0.08)) 100%)",
    innerShadow:    "inset 0 1px 1px rgba(var(--glass-glow-rgb,255,255,255),0.10)",
    noiseOpacity:   0.035,
  },
  thick: {
    bg:             glass.thick.bg,
    border:         glass.thick.border,
    blur:           blurHierarchy.thick.blur,
    saturation:     blurHierarchy.thick.saturation,
    opacity:        blurHierarchy.thick.opacity,
    backdropFilter: blurHierarchy.thick.cssValue,
    radius:         radii.xl,
    shadow:         SHADOWS.lg,
    specularHighlight: "linear-gradient(var(--glass-angle, 135deg), rgba(var(--glass-glow-rgb,255,255,255),calc(var(--glass-highlight-opacity,0.08)*0.3)) 0%, rgba(var(--glass-glow-rgb,255,255,255),calc(var(--glass-highlight-opacity,0.08)*0.2)) 30%, rgba(var(--glass-glow-rgb,255,255,255),calc(var(--glass-highlight-opacity,0.08)*0.04)) 55%, rgba(var(--glass-glow-rgb,255,255,255),calc(var(--glass-highlight-opacity,0.08)*0.15)) 100%)",
    innerShadow:    "inset 0 1px 2px rgba(var(--glass-glow-rgb,255,255,255),0.08)",
    noiseOpacity:   0.04,
  },
  elevated: {
    bg:             glass.elevated.bg,
    border:         glass.elevated.border,
    blur:           blurHierarchy.elevated.blur,
    saturation:     blurHierarchy.elevated.saturation,
    opacity:        blurHierarchy.elevated.opacity,
    backdropFilter: blurHierarchy.elevated.cssValue,
    radius:         radii["2xl"],
    shadow:         SHADOWS.xl,
    specularHighlight: "linear-gradient(var(--glass-angle, 135deg), rgba(var(--glass-glow-rgb,255,255,255),calc(var(--glass-highlight-opacity,0.08)*0.35)) 0%, rgba(var(--glass-glow-rgb,255,255,255),calc(var(--glass-highlight-opacity,0.08)*0.25)) 25%, rgba(var(--glass-glow-rgb,255,255,255),calc(var(--glass-highlight-opacity,0.08)*0.06)) 55%, rgba(var(--glass-glow-rgb,255,255,255),calc(var(--glass-highlight-opacity,0.08)*0.2)) 100%)",
    innerShadow:    "inset 0 1px 3px rgba(var(--glass-glow-rgb,255,255,255),0.15), inset 0 0 60px rgba(var(--glass-glow-rgb,255,255,255),0.02)",
    noiseOpacity:   0.05,
  },
} as const;

/** Get material definition for a glass tier */
export function getMaterial(tier: GlassTier): GlassMaterial {
  return materials[tier];
}

/** Convert material to inline CSS properties for React style */
export function materialToStyle(
  tier: GlassTier,
  overrides?: Partial<{
    radius: number;
    shadow: string;
    border: string;
  }>
): React.CSSProperties {
  const m = materials[tier];
  return {
    background: m.bg,
    backdropFilter: m.backdropFilter,
    WebkitBackdropFilter: m.backdropFilter,
    border: `1px solid ${overrides?.border ?? m.border}`,
    borderRadius: overrides?.radius ?? m.radius,
    boxShadow: overrides?.shadow ?? m.shadow,
  };
}