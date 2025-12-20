/**
 * Morphy-UX
 * 
 * A self-contained, portable physics-based UI library for React + Tailwind.
 * Built for the Hushh Agent Platform.
 * 
 * @example
 * import { cn, useRipple, hushhColors, morphyGradients } from "@/lib/morphy-ux";
 */

// Core utilities
export { cn } from "./cn";

// Ripple physics
export { useRipple, Ripple, rippleKeyframes } from "./ripple";

// Design tokens
export * from "./tokens";

// Variant styles and utilities
export {
  gradientPresets,
  getVariantStyles,
  getVariantStylesNoHover,
  getIconColor,
  getRippleColor,
  createGradient,
  getVariantGradient,
  getRippleGradient,
  glassEffect,
  opacityTransitions,
  opacityStates,
  createOpacityTransition,
} from "./utils";

// Types
export type {
  ColorVariant,
  ComponentEffect,
  GradientDirection,
  IconPosition,
  IconConfig,
  ButtonVariant,
  CardVariant,
  EffectPreset,
  RippleState,
  RippleProps,
  RippleHookReturn,
} from "./types";

// GSAP animations
export * from "./gsap";

// Motion presets (GSAP-based)
export * from "./motion";

// Icon utilities
export { useIconWeight } from "./icon-theme-context";
export * from "./icon-utils";
