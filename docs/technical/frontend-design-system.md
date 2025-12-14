# HushhRules Design System (v3.0)

> Comprehensive design rules for the Hushh Agent Platform
> Based on hushh.ai official branding + Morphy-UX physics

---

## 🎯 Core Philosophy

**Hushh = 🤫 Privacy-first AI**  
The brand name implies keeping things quiet until YOU decide to share.

---

## 1. Components - CRITICAL RULES

### Navigation (Client-Side Routing)

**ALWAYS** use `next/link` for internal navigation to prevent page reloads.

```tsx
import Link from "next/link";
import { BreadcrumbLink } from "@/components/ui/breadcrumb";

// ✅ CORRECT - Use asChild pattern
<BreadcrumbLink asChild>
  <Link href="/dashboard">Dashboard</Link>
</BreadcrumbLink>

// ❌ WRONG - Direct href (causes full reload)
<BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
```

### Button (PRIMARY INTERACTIVE ELEMENT)

```tsx
import { Button } from "@/components/ui/button";

// ✅ CORRECT - Use Button with showRipple
<Button
  variant="gradient" // ColorVariant
  effect="glass" // "fill" | "glass" | "fade"
  showRipple // Ripple on CLICK only
  size="lg" // "sm" | "default" | "lg" | "xl"
>
  Action
</Button>;

// ❌ WRONG - Do NOT use RippleButton (deleted)
// RippleButton was redundant - Button has showRipple
```

### Card

```tsx
import { Card, CardTitle, CardDescription } from "@/components/ui/card";

<Card
  variant="none"
  effect="glass"
  showRipple // Only for clickable cards
  onClick={handler}
  icon={{ icon: HeartIcon, gradient: true }}
>
  <CardTitle>Title</CardTitle>
  <CardDescription>Description</CardDescription>
</Card>;
```

### ColorVariant Options

`"none"` | `"link"` | `"gradient"` | `"blue"` | `"purple"` | `"green"` | `"orange"` | `"metallic"` | `"multi"`

### Effect Options

- `"fill"` — Solid background (default)
- `"glass"` — Frosted glass effect
- `"fade"` — Soft faded background

---

## 2. Ripple Rules - CRITICAL

**ALWAYS:**

- Ripple triggers on **click/pointerDown only** — NOT on hover
- Ripple stays **within component bounds** via `overflow: hidden`
- Use `showRipple={true}` only for **actionable elements**

**NEVER:**

- ❌ Do NOT wrap elements with `<Ripple>` component
- ❌ Do NOT use `RippleButton` (deleted - use `Button showRipple`)

```tsx
// ✅ CORRECT - Click ripple via showRipple prop
<Card showRipple onClick={handleClick}>...</Card>
<Button showRipple>Click</Button>

// ❌ WRONG - Ripple wrapper (triggers on hover)
<Ripple><Card>...</Card></Ripple>
```

---

## 3. NO Hover Scale Effects

```css
/* ❌ WRONG - Never use scale on hover */
.card:hover {
  transform: scale(1.05);
}

/* ✅ CORRECT - Use opacity, background, shadow */
.card:hover {
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}
```

---

## 4. Glass Classes (globals.css)

| Class                | Usage                  |
| -------------------- | ---------------------- |
| `.glass`             | Standard frosted glass |
| `.glass-subtle`      | Lighter glass          |
| `.glass-prominent`   | Heavy glass (sidebars) |
| `.glass-interactive` | With hover refraction  |
| `.card-glass`        | Card with glass        |
| `.nav-glass`         | Navigation bar         |

---

## 5. Colors (CSS Variables) - HUSHH BRAND

| Token                   | Value     | Usage          |
| ----------------------- | --------- | -------------- |
| `--color-hushh-blue`    | `#0071e3` | Primary CTAs   |
| `--color-hushh-emerald` | `#10b981` | Secondary      |
| `--color-hushh-teal`    | `#0d7590` | Tertiary       |
| `--color-hushh-navy`    | `#13405d` | Dark accents   |
| `--color-background`    | `#FAFAFA` | Page bg        |
| `--color-success`       | `#10b981` | Success states |
| `--color-info`          | `#0071e3` | Info states    |

### Morphy-UX Gradients

| Token                      | Value     |
| -------------------------- | --------- |
| `--morphy-primary-start`   | `#0071e3` |
| `--morphy-primary-end`     | `#0051a8` |
| `--morphy-secondary-start` | `#10b981` |
| `--morphy-secondary-end`   | `#059669` |

---

## 6. Typography

| Class            | Usage                 |
| ---------------- | --------------------- |
| `.text-headline` | 2.5rem/700 - H1       |
| `.text-title`    | 1.375rem/600 - H2     |
| `.text-body`     | 1rem - Body           |
| `.text-caption`  | 0.8125rem - Secondary |
| `.text-small`    | 0.75rem - Tertiary    |

**Fonts:** Quicksand (body), Economica (headings)

---

## 7. Icons

Use **Phosphor Icons** with `Icon` suffix:

```tsx
import { HeartIcon, CalendarIcon, UserIcon } from "@phosphor-icons/react";

// Use icon prop on Card/Button
<Card icon={{ icon: HeartIcon, gradient: true }}>...</Card>;
```

---

## 8. Motion Standards

### Transitions

- Main: `transition-all 0.3s cubic-bezier(0.4, 0, 0.2, 1)`
- Opacity: `transition-opacity 0.2s`
- Colors: `transition-colors 0.2s`

### Animation

- Use Framer Motion for page transitions
- `initial={{ opacity: 0, y: 20 }}`
- `animate={{ opacity: 1, y: 0 }}`

---

## 9. Agent Modes & Data Categories

### Agent Modes

| Mode         | ID             | Color     | Icon |
| ------------ | -------------- | --------- | ---- |
| Optimizer    | `optimizer`    | `#0071e3` | 📈   |
| Curator      | `curator`      | `#10b981` | 🎯   |
| Professional | `professional` | `#0d7590` | 💼   |
| Food         | `food_dining`  | `#FF9F0A` | 🍽️   |
| Orchestrator | `orchestrator` | `#13405d` | 🔗   |

### Data Categories

| Category     | ID             | Color     |
| ------------ | -------------- | --------- |
| Financial    | `financial`    | `#10b981` |
| Calendar     | `calendar`     | `#0071e3` |
| Professional | `professional` | `#BF5AF2` |
| Health       | `health`       | `#FF453A` |
| Food         | `food`         | `#FF9F0A` |
| Preferences  | `preferences`  | `#FF9F0A` |

---

## 10. Common Mistakes to AVOID

| ❌ WRONG                      | ✅ CORRECT                      |
| ----------------------------- | ------------------------------- |
| `<RippleButton>`              | `<Button showRipple>`           |
| `<Ripple><Card>`              | `<Card showRipple>`             |
| `transform: scale()` on hover | `background`, `shadow` on hover |
| Raw `<button>` element        | `<Button>` component            |
| Hardcoded colors              | CSS variables                   |
| Manual icon rendering         | `icon={{ icon: IconName }}`     |

---

## 11. File References

- `hushh-webapp/app/globals.css` — Glass classes, colors, typography
- `hushh-webapp/components/ui/button.tsx` — Button with showRipple
- `hushh-webapp/components/ui/card.tsx` — Card with showRipple
- `hushh-webapp/lib/morphy-ux/` — Ripple effects, GSAP animations
- `hushh-webapp/tailwind.config.ts` — Hushh color palette

---

_Version: 3.0 | Updated 2024-12-13 | Centralized in consent-protocol/docs_
