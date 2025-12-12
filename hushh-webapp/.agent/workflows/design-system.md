---
description: Design system quick reference for all pages
---

# Design System Reference

## Colors

```css
/* Primary (Iron Man) */
--color-accent-red: #dc143c;
--color-accent-gold: #c7a035;

/* Secondary */
--color-accent-blue: #007aff;
--color-accent-purple: #bf5af2;
--color-accent-green: #30d158;

/* Semantic */
--color-success: #30d158;
--color-warning: #ff9f0a;
--color-error: #ff453a;
--color-info: #007aff;

/* Backgrounds */
--color-background: #fafafa;
--color-surface: white;
```

## Typography Classes

```css
.text-headline    /* 2.5rem/700 - H1 */
/* 2.5rem/700 - H1 */
.text-title       /* 1.375rem/600 - H2 */
.text-body        /* 1rem - Paragraphs */
.text-caption     /* 0.8125rem - Secondary */
.text-small       /* 0.75rem - Tertiary */

.text-primary     /* Dark text */
.text-secondary   /* Gray text */
.text-tertiary; /* Light gray */
```

## Glass Classes

```css
.glass               /* Standard frosted glass */
/* Standard frosted glass */
.glass-subtle        /* Lighter blur */
.glass-prominent     /* Heavier blur (sidebars) */
.glass-interactive   /* With hover refraction */
.card-glass          /* Card with glass */
.nav-glass           /* Navigation bar */
.btn-glass-primary; /* Glass button */
```

## Component Quick Reference

### Button

```tsx
<Button variant="gradient" effect="glass" showRipple size="lg">
  Action
</Button>
```

### Card

```tsx
<Card variant="none" effect="glass" showRipple onClick={}>
  <CardTitle>Title</CardTitle>
  <CardDescription>Description</CardDescription>
</Card>
```

### Input

```tsx
<input className="surface border rounded-lg px-4 py-2 focus:ring-2" />
```

## Agent Mode Colors

| Mode         | Color | CSS Variable |
| ------------ | ----- | ------------ |
| Optimizer    | Gold  | `#C7A035`    |
| Curator      | Blue  | `#007AFF`    |
| Professional | Red   | `#DC143C`    |
| Orchestrator | Green | `#30D158`    |

## Icons

Use Phosphor icons with `Icon` suffix:

```tsx
import { HeartIcon, CalendarIcon, UserIcon } from "@phosphor-icons/react";
```

## Motion

```tsx
import { motion } from "framer-motion";

<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true }}
>
```

## NEVER DO

- ❌ `transform: scale()` on hover
- ❌ Ripple on `onMouseEnter`
- ❌ Raw `<button>` elements (use Button)
- ❌ Inline colors (use CSS variables)
- ❌ `<Ripple>` wrapper component
