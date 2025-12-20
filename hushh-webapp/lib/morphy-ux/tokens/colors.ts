/**
 * Hushh Brand Color Tokens
 * 
 * Single source of truth for all morphy-ux colors.
 * Based on hushh.ai official branding.
 */

// =============================================================================
// PRIMARY BRAND COLORS
// =============================================================================

export const hushhColors = {
  // Primary - Apple Blue family
  blue: {
    50: "#eff6ff",
    100: "#dbeafe",
    200: "#bfdbfe",
    300: "#93c5fd",
    400: "#60a5fa",
    500: "#0071e3", // Primary - Apple Blue
    600: "#0051a8",
    700: "#003d7a",
    800: "#002952",
    900: "#001429",
  },
  // Secondary - Emerald family
  emerald: {
    50: "#ecfdf5",
    100: "#d1fae5",
    200: "#a7f3d0",
    300: "#6ee7b7",
    400: "#34d399",
    500: "#10b981", // Primary - Emerald
    600: "#059669",
    700: "#047857",
    800: "#065f46",
    900: "#064e3b",
  },
  // Tertiary - Teal
  teal: {
    400: "#0d9488",
    500: "#0d7590",
    600: "#0a5a70",
  },
  // Dark accent - Navy
  navy: {
    400: "#1a5276",
    500: "#13405d",
    600: "#0d2e42",
  },
} as const;

// =============================================================================
// MORPHY GRADIENT TOKENS
// =============================================================================

export const morphyGradients = {
  // Primary gradient (buttons, CTAs)
  primary: {
    start: hushhColors.blue[500],
    end: hushhColors.blue[600],
    css: `linear-gradient(135deg, ${hushhColors.blue[500]} 0%, ${hushhColors.blue[600]} 100%)`,
    tailwind: "from-[#0071e3] to-[#0051a8]",
  },
  // Secondary gradient (accents)
  secondary: {
    start: hushhColors.emerald[500],
    end: hushhColors.emerald[600],
    css: `linear-gradient(135deg, ${hushhColors.emerald[500]} 0%, ${hushhColors.emerald[600]} 100%)`,
    tailwind: "from-[#10b981] to-[#059669]",
  },
  // Teal gradient
  teal: {
    start: hushhColors.teal[500],
    end: hushhColors.navy[500],
    css: `linear-gradient(135deg, ${hushhColors.teal[500]} 0%, ${hushhColors.navy[500]} 100%)`,
    tailwind: "from-[#0d7590] to-[#13405d]",
  },
  // Multi (adapts to dark mode)
  multi: {
    light: "from-[#0071e3] to-[#0051a8]",
    dark: "from-[#10b981] to-[#059669]",
    tailwind: "from-[#0071e3] to-[#0051a8] dark:from-[#10b981] dark:to-[#059669]",
  },
} as const;

// =============================================================================
// SEMANTIC COLORS
// =============================================================================

export const semanticColors = {
  success: hushhColors.emerald[500],
  warning: "#FFD60A",
  error: "#FF453A",
  info: hushhColors.blue[500],
} as const;

// =============================================================================
// CSS VARIABLE MAPPING
// For use with globals.css
// =============================================================================

export const cssVariables = {
  "--morphy-primary-start": hushhColors.blue[500],
  "--morphy-primary-end": hushhColors.blue[600],
  "--morphy-secondary-start": hushhColors.emerald[500],
  "--morphy-secondary-end": hushhColors.emerald[600],
  "--color-hushh-blue": hushhColors.blue[500],
  "--color-hushh-emerald": hushhColors.emerald[500],
  "--color-hushh-teal": hushhColors.teal[500],
  "--color-hushh-navy": hushhColors.navy[500],
} as const;

// =============================================================================
// TAILWIND CLASS PRESETS
// For use in Tailwind config extend
// =============================================================================

export const tailwindPreset = {
  colors: {
    hushh: hushhColors,
  },
  gradients: morphyGradients,
};
