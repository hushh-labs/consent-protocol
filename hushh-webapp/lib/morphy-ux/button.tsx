import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { type ColorVariant, type ComponentEffect } from "@/lib/morphy-ux/types";
import { getVariantStyles, getRippleColor } from "@/lib/morphy-ux/utils";
import { useRipple } from "@/lib/morphy-ux/ripple";
import { type IconWeight } from "@phosphor-icons/react";
import { useIconWeight } from "@/lib/morphy-ux/icon-theme-context";

// ============================================================================
// BUTTON VARIANTS
// ============================================================================

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer focus-visible:outline-none focus:outline-none focus-visible:outline-none",
  {
    variants: {
      size: {
        sm: "h-10 px-4 text-sm",
        default: "h-12 px-6 py-3",
        lg: "h-14 px-8 text-base",
        xl: "h-16 px-12 text-lg",
        icon: "h-12 w-12",
        "icon-sm": "h-10 w-10",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
);

//  ============================================================================
// BUTTON COMPONENT
// ============================================================================

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  variant?: ColorVariant;
  effect?: ComponentEffect;
  showRipple?: boolean;
  icon?: {
    icon: React.ComponentType<{ className?: string; weight?: IconWeight }>;
    title?: string;
    weight?: IconWeight;
    gradient?: boolean;
  };
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "gradient",
      effect = "glass",
      size,
      asChild = false,
      showRipple = true,
      icon,
      children,
      ...props
    },
    ref
  ) => {
    const { addRipple, resetRipple, ripple } = useRipple();
    const iconWeight = useIconWeight();
    const Comp = asChild ? Slot : "button";

    // Get centralized styles
    const variantStyles = getVariantStyles(variant, effect);

    // Icon component
    const IconComponent = icon?.icon;

    // Accent color for icon (blue in light, yellow in dark)
    const accentColor = "text-[var(--morphy-primary-start)]";

    // Decoupled icon background and color logic (muted to gradient)
    const getIconBoxStyle = (isGradient: boolean) => {
      if (isGradient) {
        // Always: solid brand gradient background
        return "bg-gradient-to-r from-[var(--morphy-primary-start)] to-[var(--morphy-primary-end)] border border-transparent";
      }
      // For false, transparent bg, accent border on hover
      return `bg-transparent border border-solid transition-colors duration-300 border-transparent`;
    };

    const getIconColor = (isGradient: boolean) => {
      if (isGradient) {
        // Always: white (light), black (dark)
        return "text-white dark:text-black";
      }
      return accentColor;
    };

    const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (showRipple) {
        addRipple(e);
      }
      props.onMouseEnter?.(e);
    };

    const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (showRipple) {
        resetRipple();
      }
      props.onMouseLeave?.(e);
    };

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      props.onClick?.(e);
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
      props.onPointerDown?.(e);
    };

    // Helper to render the icon block (like Card)
    const renderIconBlock = () => {
      if (!IconComponent) return null;
      const isGradientIcon = icon?.gradient;
      const gradient = !!isGradientIcon;

      // Responsive icon sizing based on button size
      const getIconSize = () => {
        switch (size) {
          case "sm":
            return "h-3 w-3";
          case "lg":
            return "h-5 w-5";
          case "xl":
            return "h-6 w-6";
          default:
            return "h-4 w-4";
        }
      };

      const getIconBoxSize = () => {
        switch (size) {
          case "sm":
            return "w-6 h-6";
          case "lg":
            return "w-10 h-10";
          case "xl":
            return "w-12 h-12";
          default:
            return "w-8 h-8";
        }
      };

      return (
        <div className="relative flex items-center justify-center mr-2.5">
          <div
            className={cn(
              "rounded-lg flex items-center justify-center transition-colors duration-200 border",
              getIconBoxSize(),
              getIconBoxStyle(gradient)
            )}
          >
            <IconComponent
              className={cn(
                "transition-colors duration-400",
                getIconSize(),
                getIconColor(gradient)
              )}
              weight={icon?.weight || iconWeight}
            />
          </div>
        </div>
      );
    };

    return (
      <Comp
        className={cn(
          buttonVariants({ size }),
          variantStyles,
          showRipple ? "relative overflow-hidden" : "",
          // Add border with transition for smooth hover effect
          "border border-transparent transition-[border-color,box-shadow,background-color] duration-200",
          // Hover border effect for all buttons - silver accent in dark mode for hushh brand
          "hover:border-[var(--morphy-primary-start)] dark:hover:border-[#c0c0c0]",
          className
        )}
        style={{ outline: "none" }}
        ref={ref}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        type={props.type || "button"}
        {...props}
      >
        {IconComponent && renderIconBlock()}
        {children}
        {/* Ripple element - Material 3 expanding ripple */}
        {showRipple && ripple && (
          <span
            key={ripple.id}
            className={cn(
              "absolute rounded-full pointer-events-none animate-ripple",
              getRippleColor(variant, effect)
            )}
            style={{
              left: ripple.x,
              top: ripple.y,
              width: ripple.size,
              height: ripple.size,
              transform: "translate(-50%, -50%)",
            }}
          />
        )}
      </Comp>
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };
