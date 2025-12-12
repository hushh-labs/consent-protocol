---
description: How to add a new UI component
---

# Adding a New Component

## 1. Create Component File

```bash
touch components/ui/my-component.tsx
```

## 2. Component Template

```tsx
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { type ColorVariant, type ComponentEffect } from "@/lib/morphy-ux/types";
import { getVariantStyles, getRippleColor } from "@/lib/morphy-ux/utils";
import { useRipple } from "@/lib/morphy-ux/ripple";

export interface MyComponentProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: ColorVariant;
  effect?: ComponentEffect;
  showRipple?: boolean;
}

const MyComponent = React.forwardRef<HTMLDivElement, MyComponentProps>(
  (
    {
      className,
      variant = "none",
      effect = "glass",
      showRipple = false,
      children,
      ...props
    },
    ref
  ) => {
    const { addRipple, resetRipple, ripple } = useRipple();

    const variantStyles = getVariantStyles(variant, effect);

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
      if (showRipple) {
        addRipple(e);
      }
      props.onPointerDown?.(e);
    };

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-lg p-4 transition-all",
          variantStyles,
          showRipple ? "overflow-hidden relative" : "",
          className
        )}
        onPointerDown={handlePointerDown}
        {...props}
      >
        {children}
        {showRipple && ripple && (
          <span
            className={cn(
              "absolute rounded-full animate-ripple pointer-events-none",
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
      </div>
    );
  }
);

MyComponent.displayName = "MyComponent";

export { MyComponent };
```

## 3. Key Props to Include

| Prop         | Type                      | Purpose             |
| ------------ | ------------------------- | ------------------- |
| `variant`    | `ColorVariant`            | Color scheme        |
| `effect`     | `"fill"\|"glass"\|"fade"` | Visual style        |
| `showRipple` | `boolean`                 | Click ripple effect |

## 4. Ripple Rules

- ✅ Ripple on `onPointerDown` (click)
- ❌ Never on `onMouseEnter` (hover)
- ✅ Use `overflow-hidden` to contain ripple

## 5. Export from Index (Optional)

If creating a barrel export:

```tsx
// components/ui/index.ts
export { MyComponent } from "./my-component";
```
