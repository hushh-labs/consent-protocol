import { type ColorVariant, type ComponentEffect } from "./types";

// ============================================================================
// UNIVERSITY-FOCUSED GRADIENT PRESETS
// ============================================================================

export const gradientPresets = {
  // Primary university gradient - blue to blue (professional)
  primary: "from-[#13405d] via-[#06a0c8] to-[#0d7590]",

  // Secondary university gradient - yellow to yellow (accent)
  secondary: "from-[#fbbf24] to-[#f59e0b]",

  // Success - blue family (trustworthy)
  success: "from-[#13405d] via-[#06a0c8] to-[#0d7590]",

  // Warning - yellow family (attention)
  warning: "from-[#fbbf24] to-[#f59e0b]",

  // Multi - blue to blue (light mode) / yellow to yellow (dark mode) - like active navbar
  multi:
    "from-[#13405d] via-[#06a0c8] to-[#0d7590] dark:from-[#fbbf24] dark:to-[#f59e0b]",

  // Base colors - simplified university palette
  blue: "from-[#13405d] via-[#06a0c8] to-[#0d7590]",
  yellow: "from-[#fbbf24] via-[#f8c13a] to-[#f59e0b]",

  // Gradient variants - university focused
  "blue-gradient": "from-[#13405d] via-[#06a0c8] to-[#0d7590]",
  "yellow-gradient": "from-[#fbbf24] via-[#f8c13a] to-[#f59e0b]",

  // Metallic variant - silver in both light and dark modes
  metallic: "from-gray-50 via-gray-100 to-gray-200",
  // Adaptive metallic gradient (intentional spelling per request)
  // Cool silver (light) and smooth metallic transition (dark) around #afafaf to #c6c6c6
  "mettalic-gradient":
    "from-[#f7f9fb] via-[#e5ebf2] to-[#cfd8e3] dark:from-[#8a8a8a] dark:via-[#afafaf] dark:to-[#c6c6c6]",
} as const;

// ============================================================================
// VARIANT STYLES - UNIVERSITY FOCUSED
// ============================================================================

export const getVariantStyles = (
  variant: ColorVariant,
  effect: ComponentEffect = "fill"
): string => {
  switch (variant) {
    case "gradient":
      if (effect === "fill") {
        return `bg-gradient-to-r from-[var(--morphy-primary-start)] to-[var(--morphy-primary-end)] hover:from-[var(--morphy-primary-start)]/90 hover:to-[var(--morphy-primary-end)]/90 text-white dark:text-black shadow-md transition-shadow,transition-colors duration-200`;
      } else if (effect === "fade") {
        return "bg-gradient-to-r from-[var(--morphy-primary-start)]/10 to-[var(--morphy-primary-end)]/10 dark:from-[#fbbf24]/10 dark:to-[#f59e0b]/10 border border-[var(--morphy-primary-start)]/20 dark:border-[#fbbf24]/20 text-[var(--morphy-primary-start)] dark:text-[#fbbf24] transition-colors duration-200";
      } else {
        return "bg-[var(--activeGlassColor)] shadow-[0px_4px_12px_var(--activeShadowColor)] border border-[var(--morphy-primary-start)]/20 dark:border-[#fbbf24]/20 hover:shadow-[0px_6px_16px_var(--activeShadowColor)] transition-shadow,transition-colors duration-200";
      }

    case "blue":
      if (effect === "fill") {
        return "bg-gradient-to-r from-[var(--morphy-primary-end)] to-[var(--morphy-primary-start)] text-white shadow-md transition-shadow,transition-colors duration-200 dark:from-[#fbbf24] dark:to-[#f59e0b] dark:text-black";
      } else if (effect === "fade") {
        return "bg-gradient-to-r from-[var(--morphy-primary-start)]/10 to-[var(--morphy-primary-end)]/10 border border-[var(--morphy-primary-start)]/20 text-[var(--morphy-primary-start)] transition-colors duration-200";
      } else {
        return "bg-[var(--activeGlassColor)] shadow-[0px_4px_12px_var(--activeShadowColor)] border border-[var(--morphy-primary-start)]/20 hover:shadow-[0px_6px_16px_var(--activeShadowColor)] transition-shadow,transition-colors duration-200";
      }

    case "blue-gradient":
      if (effect === "fill") {
        return `bg-gradient-to-r ${gradientPresets["blue-gradient"]} hover:from-university-blue-400/90 hover:to-university-blue-600/90 text-white shadow-md transition-shadow,transition-colors duration-200`;
      } else if (effect === "fade") {
        return "bg-gradient-to-r from-[var(--morphy-primary-start)]/10 to-[var(--morphy-primary-end)]/10 border border-[var(--morphy-primary-start)]/20 text-[var(--morphy-primary-start)] transition-colors duration-200";
      } else {
        return "bg-[var(--activeGlassColor)] shadow-[0px_4px_12px_var(--activeShadowColor)] border border-university-blue-500/20 hover:shadow-[0px_6px_16px_var(--activeShadowColor)] transition-shadow,transition-colors duration-200";
      }

    case "yellow":
      if (effect === "fill") {
        return `bg-gradient-to-r ${gradientPresets.yellow} hover:from-university-yellow-300/90 hover:to-university-yellow-500/90 text-black shadow-md transition-shadow,transition-colors duration-200`;
      } else if (effect === "fade") {
        return "bg-gradient-to-r from-[#fbbf24]/10 to-[#f59e0b]/10 border border-[#fbbf24]/20 text-[#fbbf24] transition-colors duration-200";
      } else {
        return "bg-[var(--activeGlassColor)] shadow-[0px_4px_12px_var(--activeShadowColor)] border border-university-yellow-500/20 hover:shadow-[0px_6px_16px_var(--activeShadowColor)] transition-shadow,transition-colors duration-200";
      }

    case "yellow-gradient":
      if (effect === "fill") {
        return `bg-gradient-to-r ${gradientPresets["yellow-gradient"]} hover:from-university-yellow-300/90 hover:to-university-yellow-500/90 text-black shadow-lg transition-shadow,transition-colors duration-200`;
      } else if (effect === "fade") {
        return "bg-gradient-to-r from-[#fbbf24]/10 to-[#f59e0b]/10 border border-[#fbbf24]/20 text-[#fbbf24] transition-colors duration-200";
      } else {
        return "bg-[var(--activeGlassColor)] shadow-[3px_3px_15px_var(--activeShadowColor)] border border-university-yellow-500/20 hover:shadow-[3px_3px_20px_var(--activeShadowColor)] transition-shadow,transition-colors duration-200";
      }

    case "purple":
    case "purple-gradient":
      // Fallback to blue for university consistency
      if (effect === "fill") {
        return `bg-gradient-to-r ${gradientPresets.blue} hover:from-university-blue-400/90 hover:to-university-blue-600/90 text-white shadow-md transition-shadow,transition-colors duration-200`;
      } else if (effect === "fade") {
        return "bg-gradient-to-r from-[#7c3aed]/10 to-[#8b5cf6]/10 border border-[#7c3aed]/20 text-[#7c3aed] transition-colors duration-200";
      } else {
        return "bg-[var(--activeGlassColor)] shadow-[0px_4px_12px_var(--activeShadowColor)] border border-university-blue-500/20 hover:shadow-[0px_6px_16px_var(--activeShadowColor)] transition-shadow,transition-colors duration-200";
      }

    case "green":
    case "green-gradient":
      // Fallback to blue for university consistency
      if (effect === "fill") {
        return `bg-gradient-to-r ${gradientPresets.blue} hover:from-university-blue-400/90 hover:to-university-blue-600/90 text-white shadow-md transition-shadow,transition-colors duration-200`;
      } else if (effect === "fade") {
        return "bg-gradient-to-r from-[#10b981]/10 to-[#059669]/10 border border-[#10b981]/20 text-[#10b981] transition-colors duration-200";
      } else {
        return "bg-[var(--activeGlassColor)] shadow-[0px_4px_12px_var(--activeShadowColor)] border border-university-blue-500/20 hover:shadow-[0px_6px_16px_var(--activeShadowColor)] transition-shadow,transition-colors duration-200";
      }

    case "orange":
    case "orange-gradient":
      // Fallback to yellow for university consistency
      if (effect === "fill") {
        return `bg-gradient-to-r ${gradientPresets.yellow} hover:from-university-yellow-300/90 hover:to-university-yellow-500/90 text-black shadow-md transition-shadow,transition-colors duration-200`;
      } else if (effect === "fade") {
        return "bg-gradient-to-r from-[#f59e0b]/10 to-[#d97706]/10 border border-[#f59e0b]/20 text-[#f59e0b] transition-colors duration-200";
      } else {
        return "bg-[var(--activeGlassColor)] shadow-[0px_4px_12px_var(--activeShadowColor)] border border-university-yellow-500/20 hover:shadow-[0px_6px_16px_var(--activeShadowColor)] transition-shadow,transition-colors duration-200";
      }

    case "metallic":
      if (effect === "fill") {
        return `bg-gradient-to-br ${gradientPresets.metallic} text-gray-900 shadow-md transition-shadow,transition-colors duration-200`;
      } else if (effect === "fade") {
        return "bg-gradient-to-br from-gray-50/10 via-gray-100/10 to-gray-200/10 border border-gray-200/20 text-gray-700 transition-colors duration-200";
      } else {
        return `bg-gradient-to-br ${gradientPresets.metallic} shadow-[0px_4px_12px_rgba(0,0,0,0.1)] border border-gray-200/20 backdrop-blur-[6px] transition-shadow,transition-colors duration-200`;
      }

    case "mettalic-gradient":
      if (effect === "fill") {
        return [
          `bg-gradient-to-br ${gradientPresets["mettalic-gradient"]}`,
          // Subtle gloss highlight to prevent logo camouflage
          "bg-[radial-gradient(120%_120%_at_30%_10%,rgba(255,255,255,0.35)_0%,rgba(255,255,255,0.12)_38%,transparent_62%)]",
          "dark:bg-[radial-gradient(120%_120%_at_30%_10%,rgba(255,255,255,0.10)_0%,rgba(255,255,255,0.06)_34%,transparent_60%)]",
          "bg-blend-overlay",
          // Gentle inner-edges for depth
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.20),inset_0_-1px_0_rgba(0,0,0,0.12),0px_6px_18px_rgba(0,0,0,0.12)]",
          // Slight ring to separate from page background
          "ring-1 ring-gray-300/40 dark:ring-gray-700/50",
          "text-gray-900 dark:text-gray-100 transition-shadow,transition-colors duration-200",
        ].join(" ");
      } else if (effect === "fade") {
        return [
          `bg-gradient-to-br ${gradientPresets["mettalic-gradient"]}`,
          "bg-[radial-gradient(120%_120%_at_30%_10%,rgba(255,255,255,0.25)_0%,rgba(255,255,255,0.10)_35%,transparent_60%)]",
          "dark:bg-[radial-gradient(120%_120%_at_30%_10%,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.05)_30%,transparent_58%)]",
          "bg-blend-overlay",
          "border border-gray-300/30 dark:border-gray-700/40",
          "text-gray-800 dark:text-gray-100 transition-colors duration-200",
        ].join(" ");
      } else {
        // glass: render gradient plus subtle gloss with reduced blur
        return [
          `bg-gradient-to-br ${gradientPresets["mettalic-gradient"]}`,
          "bg-[radial-gradient(120%_120%_at_30%_10%,rgba(255,255,255,0.22)_0%,rgba(255,255,255,0.10)_34%,transparent_60%)]",
          "dark:bg-[radial-gradient(120%_120%_at_30%_10%,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.04)_28%,transparent_56%)]",
          "bg-blend-overlay",
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-1px_0_rgba(0,0,0,0.10),0px_6px_18px_rgba(0,0,0,0.12)]",
          "border border-gray-300/30 dark:border-gray-700/40",
          "backdrop-blur-[4px] transition-shadow,transition-colors duration-200",
        ].join(" ");
      }

    case "multi":
      if (effect === "fill") {
        return "bg-gradient-to-r from-[var(--morphy-primary-start)] to-[var(--morphy-primary-end)] dark:from-[#fbbf24] dark:to-[#f59e0b] text-white dark:text-black shadow-md transition-shadow,transition-colors duration-200";
      } else if (effect === "fade") {
        return "bg-gradient-to-r from-[var(--morphy-primary-start)]/10 to-[var(--morphy-primary-end)]/10 dark:from-[#fbbf24]/10 dark:to-[#f59e0b]/10 border border-[var(--morphy-primary-start)]/20 dark:border-[#fbbf24]/20 text-[var(--morphy-primary-start)] dark:text-[#fbbf24] transition-colors duration-200";
      } else {
        return "bg-[var(--activeGlassColor)] shadow-[0px_4px_12px_var(--activeShadowColor)] border border-[var(--morphy-primary-start)]/20 hover:shadow-[0px_6px_16px_var(--activeShadowColor)] transition-shadow,transition-colors duration-200";
      }

    case "black":
      return "text-black hover:text-black/80 transition-colors duration-200 bg-transparent border-none shadow-none";

    case "link":
      return "text-[#374151] dark:text-[#e5e7eb] hover:text-[var(--morphy-primary-start)] dark:hover:text-[#fbbf24] underline-offset-4 hover:underline transition-colors duration-200 bg-transparent border-none shadow-none";

    case "none":
    default:
      if (effect === "fill") {
        return "bg-transparent border-transparent hover:bg-transparent hover:text-accent-foreground transition-colors duration-200";
      } else {
        return "bg-transparent border-transparent backdrop-blur-[6px] hover:bg-transparent transition-all duration-200";
      }
  }
};

// ============================================================================
// VARIANT STYLES WITHOUT HOVER (FOR NON-RIPPLE CARDS)
// ============================================================================

export const getVariantStylesNoHover = (
  variant: ColorVariant,
  effect: ComponentEffect = "fill"
): string => {
  switch (variant) {
    case "gradient":
      if (effect === "fill") {
        return `bg-gradient-to-r from-[var(--morphy-primary-start)] to-[var(--morphy-primary-end)] dark:from-[#fbbf24] dark:to-[#f59e0b] text-white dark:text-black shadow-md transition-all duration-200`;
      } else if (effect === "fade") {
        return "bg-gradient-to-r from-[var(--morphy-primary-start)]/10 to-[var(--morphy-primary-end)]/10 dark:from-[#fbbf24]/10 dark:to-[#f59e0b]/10 border border-[var(--morphy-primary-start)]/20 dark:border-[#fbbf24]/20 text-[var(--morphy-primary-start)] dark:text-[#fbbf24] transition-all duration-200";
      } else {
        return "bg-[var(--activeGlassColor)] shadow-[0px_4px_12px_var(--activeShadowColor)] border border-[var(--morphy-primary-start)]/20 dark:border-[#fbbf24]/20 backdrop-blur-[6px] transition-all duration-200";
      }

    case "blue":
      if (effect === "fill") {
        return "bg-gradient-to-r from-university-blue-600 to-university-blue-500 text-white shadow-md transition-all duration-200 dark:from-university-yellow-400 dark:to-university-yellow-500 dark:text-black";
      } else if (effect === "fade") {
        return "bg-gradient-to-r from-[var(--morphy-primary-start)]/10 to-[var(--morphy-primary-end)]/10 border border-[var(--morphy-primary-start)]/20 text-[var(--morphy-primary-start)] transition-all duration-200";
      } else {
        return "bg-[var(--activeGlassColor)] shadow-[0px_6px_16px_var(--activeShadowColor)] border border-university-blue-500/20 backdrop-blur-[6px] transition-all duration-200";
      }

    case "blue-gradient":
      if (effect === "fill") {
        return `bg-gradient-to-r ${gradientPresets["blue-gradient"]} text-white shadow-md transition-all duration-200`;
      } else if (effect === "fade") {
        return "bg-gradient-to-r from-[var(--morphy-primary-start)]/10 to-[var(--morphy-primary-end)]/10 border border-[var(--morphy-primary-start)]/20 text-[var(--morphy-primary-start)] transition-all duration-200";
      } else {
        return "bg-[var(--activeGlassColor)] shadow-[0px_6px_16px_var(--activeShadowColor)] border border-[var(--morphy-primary-start)]/20 backdrop-blur-[6px] transition-all duration-200";
      }

    case "yellow":
      if (effect === "fill") {
        return `bg-gradient-to-r ${gradientPresets.yellow} text-black shadow-md transition-all duration-200`;
      } else if (effect === "fade") {
        return "bg-gradient-to-r from-[#fbbf24]/10 to-[#f59e0b]/10 border border-[#fbbf24]/20 text-[#fbbf24] transition-all duration-200";
      } else {
        return "bg-[var(--activeGlassColor)] shadow-[0px_6px_16px_var(--activeShadowColor)] border border-[#fbbf24]/20 backdrop-blur-[6px] transition-all duration-200";
      }

    case "yellow-gradient":
      if (effect === "fill") {
        return `bg-gradient-to-r ${gradientPresets["yellow-gradient"]} text-black shadow-md transition-all duration-200`;
      } else if (effect === "fade") {
        return "bg-gradient-to-r from-[#fbbf24]/10 to-[#f59e0b]/10 border border-[#fbbf24]/20 text-[#fbbf24] transition-all duration-200";
      } else {
        return "bg-[var(--activeGlassColor)] shadow-[0px_6px_16px_var(--activeShadowColor)] border border-[#fbbf24]/20 backdrop-blur-[6px] transition-all duration-200";
      }

    case "purple":
    case "purple-gradient":
    case "green":
    case "green-gradient":
      // Fallback to blue for university consistency
      if (effect === "fill") {
        return `bg-gradient-to-r ${gradientPresets.blue} text-white shadow-md transition-all duration-200`;
      } else if (effect === "fade") {
        return "bg-gradient-to-r from-[#7c3aed]/10 to-[#8b5cf6]/10 border border-[#7c3aed]/20 text-[#7c3aed] transition-all duration-200";
      } else {
        return "bg-[var(--activeGlassColor)] shadow-[0px_6px_16px_var(--activeShadowColor)] border border-[var(--morphy-primary-start)]/20 backdrop-blur-[6px] transition-all duration-200";
      }

    case "orange":
    case "orange-gradient":
      // Fallback to yellow for university consistency
      if (effect === "fill") {
        return `bg-gradient-to-r ${gradientPresets.yellow} text-black shadow-md transition-all duration-200`;
      } else if (effect === "fade") {
        return "bg-gradient-to-r from-[#f59e0b]/10 to-[#d97706]/10 border border-[#f59e0b]/20 text-[#f59e0b] transition-all duration-200";
      } else {
        return "bg-[var(--activeGlassColor)] shadow-[0px_6px_16px_var(--activeShadowColor)] border border-[#fbbf24]/20 backdrop-blur-[6px] transition-all duration-200";
      }

    case "metallic":
      if (effect === "fill") {
        return `bg-gradient-to-br ${gradientPresets.metallic} text-gray-900 shadow-md transition-all duration-200`;
      } else if (effect === "fade") {
        return "bg-gradient-to-br from-gray-50/10 via-gray-100/10 to-gray-200/10 border border-gray-200/20 text-gray-700 transition-all duration-200";
      } else {
        return `bg-gradient-to-br ${gradientPresets.metallic} shadow-[0px_4px_12px_rgba(0,0,0,0.1)] border border-gray-200/20 backdrop-blur-[6px] transition-all duration-200`;
      }

    case "mettalic-gradient":
      if (effect === "fill") {
        return `bg-gradient-to-br ${gradientPresets["mettalic-gradient"]} text-gray-900 dark:text-gray-100 shadow-md transition-all duration-200`;
      } else if (effect === "fade") {
        return `bg-gradient-to-br ${gradientPresets["mettalic-gradient"]} opacity-90 border border-gray-300/30 dark:border-gray-700/30 text-gray-800 dark:text-gray-100 transition-all duration-200`;
      } else {
        // glass
        return `bg-gradient-to-br ${gradientPresets["mettalic-gradient"]} shadow-[0px_6px_18px_rgba(0,0,0,0.15)] border border-gray-300/30 dark:border-gray-700/30 backdrop-blur-[4px] transition-all duration-200`;
      }

    case "multi":
      if (effect === "fill") {
        return "bg-gradient-to-r from-[var(--morphy-primary-start)] to-[var(--morphy-primary-end)] dark:from-[#fbbf24] dark:to-[#f59e0b] text-white dark:text-black shadow-md transition-all duration-200";
      } else if (effect === "fade") {
        return "bg-gradient-to-r from-[var(--morphy-primary-start)]/10 to-[var(--morphy-primary-end)]/10 dark:from-[#fbbf24]/10 dark:to-[#f59e0b]/10 border border-[var(--morphy-primary-start)]/20 dark:border-[#fbbf24]/20 text-[var(--morphy-primary-start)] dark:text-[#fbbf24] transition-all duration-200";
      } else {
        return "bg-[var(--activeGlassColor)] shadow-[0px_6px_16px_var(--activeShadowColor)] border border-[var(--morphy-primary-start)]/20 backdrop-blur-[6px] transition-all duration-200";
      }

    case "link":
      return "text-university-gray-700 dark:text-university-gray-200 underline-offset-4 transition-colors duration-200 bg-transparent border-none shadow-none";

    case "none":
    default:
      if (effect === "fill") {
        return "bg-background border border-border transition-colors duration-200";
      } else {
        return "bg-[var(--activeGlassColor)] shadow-[0px_10px_30px_var(--activeShadowColor)] border border-[var(--fadeGrey)] backdrop-blur-[6px] transition-all duration-200";
      }
  }
};

// ============================================================================
// ICON COLORS - UNIVERSITY FOCUSED
// ============================================================================

export const getIconColor = (
  variant: ColorVariant,
  effect: ComponentEffect = "fill"
): string => {
  switch (variant) {
    case "gradient":
    case "blue":
    case "blue-gradient":
    case "purple":
    case "purple-gradient":
    case "green":
    case "green-gradient":
    case "multi":
      if (effect === "fill") {
        return "text-white";
      } else {
        return "text-university-blue-500";
      }

    case "yellow":
    case "yellow-gradient":
    case "orange":
    case "orange-gradient":
      if (effect === "fill") {
        return "text-black";
      } else {
        return "text-university-yellow-500";
      }

    case "metallic":
      if (effect === "fill") {
        return "text-gray-900";
      } else {
        return "text-gray-700";
      }

    case "link":
      return "text-[#374151] dark:text-[#e5e7eb]";

    case "none":
    default:
      if (effect === "fill") {
        return "text-foreground";
      } else {
        return "text-foreground";
      }
  }
};

// ============================================================================
// RIPPLE COLORS - UNIVERSITY FOCUSED
// ============================================================================

export const getRippleColor = (
  variant: ColorVariant,
  effect: ComponentEffect = "fill"
): string => {
  // For glass/fade, use visible color-matched ripple
  if (effect === "glass" || effect === "fade") {
    switch (variant) {
      case "gradient":
      case "multi":
      case "blue":
      case "blue-gradient":
        return "bg-[var(--morphy-primary-start)]/30 dark:bg-[#fbbf24]/30";
      case "yellow":
      case "yellow-gradient":
        return "bg-[#fbbf24]/30";
      case "purple":
      case "purple-gradient":
        return "bg-[#7c3aed]/30";
      case "green":
      case "green-gradient":
        return "bg-[#10b981]/30";
      case "orange":
      case "orange-gradient":
        return "bg-[#f59e0b]/30";
      case "metallic":
        return "bg-gray-400/30";
      case "link":
        return "bg-[var(--morphy-primary-start)]/20 dark:bg-[#fbbf24]/20";
      case "black":
        return "bg-black/20";
      case "none":
      default:
        return "bg-foreground/10";
    }
  }
  // Default: fill (legacy logic)
  switch (variant) {
    case "gradient":
    case "blue":
    case "blue-gradient":
    case "purple":
    case "purple-gradient":
    case "green":
    case "green-gradient":
    case "multi":
      return "bg-white/20";
    case "yellow":
    case "yellow-gradient":
    case "orange":
    case "orange-gradient":
      return "bg-black/10";
    case "metallic":
      return "bg-gray-400/20";
    case "link":
      return "bg-[var(--morphy-primary-start)]/20 dark:bg-[#fbbf24]/20";
    case "none":
    default:
      return "bg-foreground/10";
  }
};

// ============================================================================
// GRADIENT UTILITIES
// ============================================================================

export const createGradient = (
  direction:
    | "to-r"
    | "to-l"
    | "to-t"
    | "to-b"
    | "to-tr"
    | "to-tl"
    | "to-br"
    | "to-bl" = "to-r",
  colors: string[]
): string => {
  return `bg-gradient-${direction} ${colors.join(" ")}`;
};

export const getVariantGradient = (variant: ColorVariant): string => {
  switch (variant) {
    case "gradient":
      return gradientPresets.primary;
    case "blue":
      return gradientPresets.blue;
    case "blue-gradient":
      return gradientPresets["blue-gradient"];
    case "purple":
      return gradientPresets.blue; // Fallback to blue for university consistency
    case "purple-gradient":
      return gradientPresets.blue; // Fallback to blue for university consistency
    case "green":
      return gradientPresets.blue; // Fallback to blue for university consistency
    case "green-gradient":
      return gradientPresets.blue; // Fallback to blue for university consistency
    case "orange":
      return gradientPresets.yellow; // Fallback to yellow for university consistency
    case "orange-gradient":
      return gradientPresets["yellow-gradient"]; // Fallback to yellow for university consistency
    case "metallic":
      return gradientPresets.metallic;
    case "multi":
      return gradientPresets.multi;
    default:
      return gradientPresets.primary;
  }
};

export const getRippleGradient = (variant: ColorVariant): string => {
  switch (variant) {
    case "gradient":
      return "from-white/20 to-white/10";
    case "blue":
    case "blue-gradient":
      return "from-blue-400/30 to-blue-400/15";
    case "purple":
    case "purple-gradient":
      return "from-purple-400/30 to-purple-400/15";
    case "green":
    case "green-gradient":
      return "from-green-400/30 to-green-400/15";
    case "orange":
    case "orange-gradient":
      return "from-orange-400/30 to-orange-400/15";
    case "metallic":
      return "from-gray-400/30 to-gray-400/15";
    case "multi":
      return "from-white/20 to-white/10";
    default:
      return "from-foreground/10 to-foreground/5";
  }
};

// ============================================================================
// GLASS EFFECT
// ============================================================================

export const glassEffect = {
  background: "bg-[var(--activeGlassColor)]",
  shadow: "shadow-[0px_10px_30px_var(--activeShadowColor)]",
  border: "border border-[var(--fadeGrey)]",
  blur: "backdrop-blur-[6px]",
  hover: "hover:shadow-[0px_15px_40px_var(--activeShadowColor)]",
  transition: "transition-all duration-200",
} as const;

// ============================================================================
// SMOOTH OPACITY TRANSITIONS (MORPHY STANDARD)
// All interactive elements should use smooth opacity transitions from 0-1
// This prevents layout jumps and provides professional animations
// ============================================================================

export const opacityTransitions = {
  // Standard opacity transition for error messages, tooltips, etc.
  smooth: "transition-opacity duration-300 ease-in-out",

  // Faster transition for hover states
  fast: "transition-opacity duration-200 ease-in-out",

  // Slower transition for major state changes
  slow: "transition-opacity duration-500 ease-in-out",

  // Instant transition for immediate feedback
  instant: "transition-opacity duration-100 ease-in-out",
} as const;

// ============================================================================
// OPACITY UTILITY CLASSES
// Pre-built classes for common opacity states
// ============================================================================

export const opacityStates = {
  // Invisible but takes space (for smooth transitions)
  invisible: "opacity-0 pointer-events-none",
  visible: "opacity-100",

  // Semi-transparent states
  subtle: "opacity-60",
  muted: "opacity-40",
  faint: "opacity-20",
} as const;

// ============================================================================
// MORPHY TRANSITION HELPER
// Combine opacity transitions with morphy colors for consistent theming
// ============================================================================

export const createOpacityTransition = (
  visible: boolean,
  transitionType: keyof typeof opacityTransitions = "smooth"
) => {
  const baseClasses = opacityTransitions[transitionType];
  const opacityClass = visible
    ? opacityStates.visible
    : opacityStates.invisible;
  return `${baseClasses} ${opacityClass}`;
};
