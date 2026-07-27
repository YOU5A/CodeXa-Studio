/**
 * CodeXa-Studio Liquid Glass Design System
 *
 * @module design-system
 *
 * Apple Liquid Glass inspired UI primitives.
 * All components consume the existing CSS variable theme system
 * managed by useTheme() — no theme state duplication.
 *
 * Usage:
 *   import { GlassSurface, GlassCard, GlassPanel } from '@/design-system';
 *   import { materials, springDefault } from '@/design-system';
 */

/* ─── Tokens ─── */
export {
  CSS_VARS,
  glass,
  surface,
  blurHierarchy,
  getBackdropFilter,
  space,
  radii,
  fontSizes,
  iconSizes,
  zLayers,
} from './tokens';
export type { GlassTier, BlurConfig } from './tokens';

/* ─── Materials ─── */
export { materials, getMaterial, materialToStyle, generateGlassSeed } from './materials';
export type { GlassMaterial, GlassSeed } from './materials';

/* ─── Animations ─── */
export {
  springDefault,
  springSnappy,
  springBouncy,
  springGentle,
  springSmooth,
  fadeSlideUp,
  fadeOnly,
  scaleBounce,
  cardVariants,
  modalVariants,
  listItemVariants,
  hoverScale,
  hoverLift,
  /* Glass motion system */
  glassEntrance,
  glassReveal,
  glassPopIn,
  glassHover,
  glassLift,
  glassGhostHover,
  glassPress,
  glassPressDeep,
  pageTransition,
  contentTransition,
  glassFocusRing,
  glassFocusRingOut,
} from './animations';

/* ─── Components ─── */
export {
  GlassSurface,
  GlassCard,
  GlassPanel,
  GlassButton,
  GlassInput,
  GlassModal,
  GlassSelect,
  GlassToggle,
  GlassProgressBar,
  GlassBadge,
  GlassEmptyState,
  GlassGlow,
  GlassPillButton,
  GlassFloat,
  GlassTooltip,
  GlassSlider,
  GlassScrollArea,
  GlassSVGFilter,
} from './components';
export type {
  GlassSurfaceProps,
  GlassCardProps,
  GlassPanelProps,
  GlassButtonProps,
  ButtonVariant,
  ButtonSize,
  GlassInputProps,
  GlassModalProps,
  GlassSelectProps,
  SelectOption,
  GlassToggleProps,
  GlassProgressBarProps,
  ProgressColor,
  GlassBadgeProps,
  BadgeVariant,
  GlassEmptyStateProps,
  GlassGlowProps,
  GlassPillButtonProps,
  GlassFloatProps,
  GlassSliderProps,
  GlassScrollAreaProps,
} from './components';

/* ─── Layouts ─── */
export {
  GlassBackground,
  GlassLayout,
  GlassMain,
} from './layouts';
export type {
  GlassBackgroundProps,
  GlassLayoutProps,
  GlassMainProps,
} from './layouts';