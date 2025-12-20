// =============================================================================
// Morphy Motion Tokens (Material 3 expressive inspired)
// =============================================================================

export const motionDurations = {
  // Enter/exit
  xs: 120,
  sm: 180,
  md: 240,
  lg: 320,
  xl: 450,
  // Long sequences / marquee fallbacks
  xxl: 600,
} as const;

export type MotionDurationKey = keyof typeof motionDurations;

export const motionEasings = {
  standard: "cubic-bezier(0.2, 0.0, 0.0, 1)",
  accelerate: "cubic-bezier(0.3, 0.0, 1, 1)",
  decelerate: "cubic-bezier(0.0, 0.0, 0.2, 1)",
  emphasized: "cubic-bezier(0.2, 0.0, 0, 1)",
} as const;

export type MotionEasingKey = keyof typeof motionEasings;

export const motionDistances = {
  // Translate distances for enter transitions
  tiny: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
} as const;

export type MotionDistanceKey = keyof typeof motionDistances;

export const motionOpacity = {
  from: 0.0,
  to: 1.0,
} as const;

export const motionDefaults = {
  durationMs: motionDurations.md,
  easing: motionEasings.emphasized,
  distancePx: motionDistances.md,
} as const;

export const motionVariants = {
  // Shared axis Y (enter from below)
  enterFromBottom: {
    y: motionDistances.lg,
    opacity: motionOpacity.from,
  },
  // Fade only
  fadeIn: {
    y: 0,
    opacity: motionOpacity.from,
  },
  // Slight scale for elevation emphasis
  elevate: {
    scale: 0.98,
    opacity: motionOpacity.from,
  },
} as const;

export type MotionVariantKey = keyof typeof motionVariants;
