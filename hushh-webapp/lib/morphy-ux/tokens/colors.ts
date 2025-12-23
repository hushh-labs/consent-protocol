/**
 * Hushh Brand Color Tokens
 *
 * Single source of truth for all morphy-ux colors.
 * Based on hushh.ai official branding.
 *
 * NOTE: These tokens should match the CSS variables in globals.css
 * The CSS variables are the runtime source of truth.
 */

// =============================================================================
// PRIMARY BRAND COLORS - HUSHH
// =============================================================================

export const hushhColors = {
  // Primary - Hushh Blue family
  blue: {
    50: "#e6f3ff",
    100: "#cce7ff",
    200: "#99cfff",
    300: "#66b7ff",
    400: "#339fff",
    500: "#0071e3", // Primary - Hushh Blue
    600: "#005bb5",
    700: "#004587",
    800: "#002f5a",
    900: "#00192d",
  },
  // Secondary - Purple family (data sovereignty)
  purple: {
    50: "#f5e6ff",
    100: "#ebccff",
    200: "#d699ff",
    300: "#c266ff",
    400: "#ad33ff",
    500: "#bb62fc", // Primary - Hushh Purple
    600: "#954fca",
    700: "#703c97",
    800: "#4a2865",
    900: "#251432",
  },
  // Accent - Gold/Yellow (dark mode primary)
  gold: {
    50: "#fffbeb",
    100: "#fef3c7",
    200: "#fde68a",
    300: "#fcd34d",
    400: "#fbbf24", // Accent Gold
    500: "#f59e0b", // Accent Orange
    600: "#d97706",
    700: "#b45309",
    800: "#92400e",
    900: "#78350f",
  },
  // Neutral - Silver for subtle backgrounds
  silver: {
    50: "#fafafa",
    100: "#f5f5f5",
    200: "#e8e8e8",
    300: "#d4d4d4",
    400: "#c0c0c0", // Silver Start
    500: "#a3a3a3",
    600: "#737373",
    700: "#525252",
    800: "#404040",
    900: "#262626",
  },
} as const;

// =============================================================================
// MORPHY GRADIENT TOKENS
// =============================================================================

export const morphyGradients = {
  // Primary gradient (light mode) - Blue → Purple
  primary: {
    start: hushhColors.blue[500],
    end: hushhColors.purple[500],
    css: `linear-gradient(to right, ${hushhColors.blue[500]}, ${hushhColors.purple[500]})`,
    tailwind: "from-[#0071e3] to-[#bb62fc]",
  },
  // Secondary gradient - Silver (subtle backgrounds)
  secondary: {
    start: hushhColors.silver[400],
    end: hushhColors.silver[200],
    css: `linear-gradient(to right, ${hushhColors.silver[400]}, ${hushhColors.silver[200]})`,
    tailwind: "from-[#c0c0c0] to-[#e8e8e8]",
  },
  // Accent gradient (dark mode primary) - Gold → Orange
  accent: {
    start: hushhColors.gold[400],
    end: hushhColors.gold[500],
    css: `linear-gradient(to right, ${hushhColors.gold[400]}, ${hushhColors.gold[500]})`,
    tailwind: "from-[#fbbf24] to-[#f59e0b]",
  },
  // Multi (adapts to dark mode)
  multi: {
    light: "from-[#0071e3] to-[#bb62fc]",
    dark: "from-[#fbbf24] to-[#f59e0b]",
    tailwind:
      "from-[#0071e3] to-[#bb62fc] dark:from-[#fbbf24] dark:to-[#f59e0b]",
  },
} as const;

// =============================================================================
// SEMANTIC COLORS
// =============================================================================

export const semanticColors = {
  success: "#10b981", // Emerald
  warning: "#fbbf24", // Gold
  error: "#ef4444", // Red
  info: hushhColors.blue[500],
} as const;

// =============================================================================
// CSS VARIABLE MAPPING
// These should match globals.css :root and .dark definitions
// =============================================================================

export const cssVariables = {
  // Light mode (default)
  light: {
    "--morphy-primary-start": hushhColors.blue[500],
    "--morphy-primary-end": hushhColors.purple[500],
    "--morphy-secondary-start": hushhColors.silver[400],
    "--morphy-secondary-end": hushhColors.silver[200],
  },
  // Dark mode
  dark: {
    "--morphy-primary-start": hushhColors.gold[400],
    "--morphy-primary-end": hushhColors.gold[500],
    "--morphy-secondary-start": "#13405d",
    "--morphy-secondary-end": "#0d7590",
  },
} as const;
