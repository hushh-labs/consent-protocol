# Hushh Frontend Design System (v4.1)

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
  variant="gradient" // "none" | "link" | "gradient" | "blue" | "purple" | "green" | "orange" | "metallic"
  effect="glass" // "fill" | "glass" | "fade"
  showRipple // Ripple on CLICK only
  size="lg" // "sm" | "default" | "lg" | "xl"
>
  Action
</Button>;
```

### Card

```tsx
import { Card, CardTitle, CardDescription } from "@/components/ui/card";

<Card
  variant="none"
  effect="glass"
  showRipple // Only for clickable cards
  onClick={handler}
>
  <CardContent>...</CardContent>
</Card>;
```

### VaultFlow (Authentication)

The centralized component for all vault operations.

```tsx
import { VaultFlow } from "@/components/vault/vault-flow";

<VaultFlow
  user={currentUser}
  onSuccess={handleSuccess}
  onStepChange={(step) => handleHeaderVisibility(step)}
/>;
```

---

## 2. Material 3 Expressive + Morphy-UX

> Hushh uses Material 3 Expressive physics with iOS glassmorphism visuals

### Ripple Mechanics (Material 3)

- Ripple is handled by `@material/web` `<md-ripple>` component
- **Automatic interaction detection** — hover, press, focus all handled internally
- Uses `showRipple` prop on Button/Card

### Animation Physics

| Property        | Value                              |
| --------------- | ---------------------------------- |
| Hover Opacity   | 0.08                               |
| Pressed Opacity | 0.12                               |
| Timing          | Spring-physics (Material 3 native) |

### Color Mapping

| Mode  | Ripple Color                    |
| ----- | ------------------------------- |
| Light | `--morphy-primary-start` (Blue) |
| Dark  | `--morphy-primary-start` (Blue) |

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

### Morphy-UX Gradients (CSS Variables)

| Token                      | Light Mode         | Dark Mode          |
| -------------------------- | ------------------ | ------------------ |
| `--morphy-primary-start`   | `#0071e3` (Blue)   | `#0071e3` (Blue)   |
| `--morphy-primary-end`     | `#bb62fc` (Purple) | `#bb62fc` (Purple) |
| `--morphy-secondary-start` | `#0071e3` (Blue)   | `#0071e3` (Blue)   |
| `--morphy-secondary-end`   | `#bb62fc` (Purple) | `#bb62fc` (Purple) |

### Background Gradient Classes

| Class                   | Usage                          |
| ----------------------- | ------------------------------ |
| `.morphy-app-bg`        | Subtle app background gradient |
| `.morphy-app-bg-radial` | Centered glow effect           |

---

## 6. Typography

**Fonts:** `Figtree` (Primary), `Quicksand` (Body fallback)

| Class            | Usage                 |
| ---------------- | --------------------- |
| `.text-headline` | 2.5rem/700 - H1       |
| `.text-title`    | 1.375rem/600 - H2     |
| `.text-body`     | 1rem - Body           |
| `.text-caption`  | 0.8125rem - Secondary |
| `.text-small`    | 0.75rem - Tertiary    |

---

## 7. Icons

Use **Lucide React** (`lucide-react`) for all UI icons.
Use **Phosphor Icons** (`@phosphor-icons/react`) ONLY if a specific icon is missing in Lucide.

```tsx
import { Shield, Lock } from "lucide-react";
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

## 9. Mobile-First Layout Rules

1. **Viewport Height**: use `100dvh` for full-screen containers to handle mobile browser bars.
2. **Safe Areas (Hardware Notch)**:
   - **Formula**: `max(env(safe-area-inset-top), 32px)`
   - _Why 32px?_ Ensures functional padding on emulators or web views that report 0px.
   - **Header Spacing**: `calc(Safe Area + 48px)` for fixed Top App Bars.
3. **Toast Positioning**:
   - Place toasts at `margin-top: max(env(safe-area-inset-top), 4rem)` to avoid blocking the header or status bar.
   - Use `z-index: 9999` to float above all sheets/modals.
4. **Overscroll**: Disable body overscroll to prevent "rubber banding" on iOS.
   ```css
   html,
   body {
     overscroll-behavior: none;
   }
   ```
5. **Backgrounds**: Use fixed, oversized backgrounds (`h-[120vh]`) to prevent white gaps during scroll bounces.

---

## 10. Authentication & Vault Patterns

### Unified Vault Flow

- **Component**: `VaultFlow`
- **Location**: `components/vault/vault-flow.tsx`
- **Usage**:
  - **Home Page**: Main entry point. Only shows "Welcome Back" header in `create` or `recovery` modes. **Hides header** in `unlock` mode for focus.
  - **Dashboard**: Uses `VaultFlow` as an **overlay** if the vault is locked (e.g. after refresh). This prevents redirects and maintains navigational context.

### Recovery Key

- Users are forced to download/copy the Recovery Key upon creation.
- Keep recovery logic integrated within `VaultFlow`.

---

## 11. Component Architecture - IMPORTANT

> **RULE**: Keep shadcn/ui components stock. Morphy-UX enhancements go in `lib/morphy-ux/ui`.

### Directory Structure

| Path                | Purpose                       | Updateable       |
| ------------------- | ----------------------------- | ---------------- |
| `components/ui/`    | Stock Shadcn/UI components    | ✅ Yes (via CLI) |
| `lib/morphy-ux/`    | Core Morphy-UX utilities      | 🛠 Custom         |
| `lib/morphy-ux/ui/` | Morphy-enhanced UI components | 🛠 Custom         |

---

## 12. File References

- `hushh-webapp/app/globals.css` — Glass classes, colors, typography, Material 3 tokens
- `hushh-webapp/components/vault/vault-flow.tsx` — **Core Vault Component**
- `hushh-webapp/lib/morphy-ux/` — Morphy-UX system

---

_Version: 5.1 | Updated 2026-01-03 | VaultFlow & Mobile Layouts_
