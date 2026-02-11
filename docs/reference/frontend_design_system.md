# Hushh Frontend Design System (v6.0)

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

**Import from Morphy-UX** for variants and effects (not stock shadcn/ui):

```tsx
import { Button } from "@/lib/morphy-ux/button";

// ✅ CORRECT - Use Morphy-UX Button with showRipple
<Button
  variant="gradient" // "none" | "link" | "gradient" | "blue" | "purple" | "green" | "orange" | "metallic" | "blue-gradient" | "yellow" | "multi"
  effect="glass" // "fill" | "glass" | "fade"
  showRipple // Ripple on CLICK only
  size="lg" // "sm" | "default" | "lg" | "xl"
>
  Action
</Button>;

// Note: Stock shadcn/ui Button is at @/components/ui/button (no variants/effects)
```

### Card

**Import from Morphy-UX** for variants and effects:

```tsx
import { Card } from "@/lib/morphy-ux/card";
import { CardContent, CardTitle, CardDescription } from "@/components/ui/card";

// ✅ CORRECT - Use Morphy-UX Card for glass/ripple effects
<Card
  variant="none"
  effect="glass"
  showRipple // Only for clickable cards
  onClick={handler}
>
  <CardContent>...</CardContent>
</Card>;

// Note: CardContent, CardTitle, etc. still come from @/components/ui/card
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
| Light | `--morphy-primary-start` (Pink) |
| Dark  | `--morphy-primary-start` (Pink) |

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

| Class                | Usage                     | Status |
| -------------------- | ------------------------- | ------ |
| `.glass-interactive` | Glass with hover effects  | Active |
| `.glass-performant`  | GPU-optimized glass layer | Active |

> Note: Use the `effect="glass"` prop on Morphy-UX components (Button, Card) for glassmorphism effects, rather than CSS classes directly.

---

## 5. Colors (CSS Variables) - HUSHH BRAND

| Token                | Value     | Usage          |
| -------------------- | --------- | -------------- |
| `--color-background` | `#FAFAFA` | Page bg        |
| `--fadeGrey`         | `#e5e7eb` | Subtle borders |

### Morphy-UX Gradients (CSS Variables)

| Token                      | Light Mode         | Dark Mode          |
| -------------------------- | ------------------ | ------------------ |
| `--morphy-primary-start`   | `#e91e63` (Pink)   | `#e91e63` (Pink)   |
| `--morphy-primary-end`     | `#9c27b0` (Purple) | `#9c27b0` (Purple) |
| `--morphy-secondary-start` | `#c0c0c0` (Silver) | `#e91e63` (Pink)   |
| `--morphy-secondary-end`   | `#e8e8e8` (Silver) | `#9c27b0` (Purple) |

> Note: The pink/purple gradient is used for primary CTAs and branding.
> Additional color tokens are defined in `lib/morphy-ux/tokens/colors.ts`.

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

### Animation (GSAP + Morphy-UX)

- Page transitions and expressive motion use **GSAP**, wired through Morphy-UX helpers in `lib/morphy-ux/gsap.ts` and tokens in `lib/morphy-ux/motion.ts`.
- Default route-change pattern:
  - Fade + small vertical shift on content container when the app router pathname changes.
  - Short durations (`xs`/`sm` tokens) tuned for mobile.
- Motion tokens:
  - Durations: `xs`, `sm`, `md`, `lg`, `xl`, `xxl` in `motionDurations`.
  - Easing: `standard`, `accelerate`, `decelerate`, `emphasized` in `motionEasings`.
  - Distances: `tiny`, `xs`, `sm`, `md`, `lg` in `motionDistances`.
- Always respect `prefers-reduced-motion` — Morphy-UX helpers bail out early when users request reduced motion.

---

## 9. Mobile-First Layout Rules

1. **Viewport Height**: use `100dvh` for full-screen containers to handle mobile browser bars.
2. **Safe Areas (Hardware Notch)**:
   - **Formula**: `max(env(safe-area-inset-top), 32px)` where a fallback is needed.
   - _Why 32px?_ Ensures functional padding on emulators or web views that report 0px.
   - **Top bar**: Fixed bar is **64px** tall (breadcrumb bar); on native, StatusBarBlur adds `env(safe-area-inset-top)` above it. Main scroll container uses `pt-[45px]` so content clears the bar and can scroll under it for the masked-blur effect.
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

**Top bar (StatusBarBlur + TopAppBar):** The app chrome uses a single "masked blur" style (`.top-bar-glass` in `globals.css`): theme-aware semi-transparent background (`color-mix` with `lab` for light/dark), `backdrop-filter: blur(3px) saturate(180%)`, and a bottom-edge mask so the bar fades into content. On native, `use-status-bar` sets the Capacitor status bar to overlay the WebView; StatusBarBlur (safe-area strip) and TopAppBar (64px breadcrumb bar) share this style so both bands match. Content scrolls under the bar; the main scroll container has `pt-[45px]` and no spacer in the layout.

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
| `lib/morphy-ux/`    | Core Morphy-UX utilities      | 🛠 Custom        |
| `lib/morphy-ux/ui/` | Morphy-enhanced UI components | 🛠 Custom        |

---

## 12. File References

- `hushh-webapp/app/globals.css` — Glass classes, colors, typography, Material 3 tokens
- `hushh-webapp/components/vault/vault-flow.tsx` — **Core Vault Component**
- `hushh-webapp/lib/morphy-ux/` — Morphy-UX system

---

## 13. Morphy-UX Component Prop Contracts

Morphy-UX primitives share a small set of **standard props** so that behavior feels consistent across the app.

### 13.1 Shared interaction props

- **`variant?: ColorVariant`**: Visual style of the surface.
  - Examples: `"gradient"`, `"muted"`, `"metallic"`, `"blue-gradient"`, `"orange-gradient"`, `"multi"`.
  - Backed by tokens in `lib/morphy-ux/tokens/colors.ts` and CSS variables (`--morphy-*`).
- **`effect?: "fill" | "glass" | "fade"`**:
  - `"fill"`: Solid surface, strongest emphasis.
  - `"glass"`: Glassmorphism with backdrop blur (used for primary cards/buttons).
  - `"fade"`: Low-emphasis surface with minimal blur.
- **`showRipple?: boolean`**:
  - Enables Material 3 state layers + ripple (`<MaterialRipple>`).
  - Use for primary actions and interactive cards; disable for purely static containers.

### 13.2 `Button` (`lib/morphy-ux/button.tsx` / `lib/morphy-ux/morphy.tsx`)

- **Core props**
  - `variant?: ColorVariant` — Defaults to `"gradient"` for primary CTAs.
  - `effect?: "fill" | "glass" | "fade"` — Defaults to `"glass"`.
  - `size?: "sm" | "default" | "lg" | "xl" | "icon" | "icon-sm"` — From `buttonVariants`.
  - `showRipple?: boolean` — Defaults to `true`.
- **Layout & state**
  - `fullWidth?: boolean` — Stretches the button to `w-full` for mobile-first layouts and bottom actions.
  - `loading?: boolean` — Sets `aria-busy`, disables the button, and applies a `cursor-wait` state.
- **Composition**
  - `asChild?: boolean` — Radix `Slot` pattern (wraps links or custom components).
  - `icon?: { icon; title?; weight?; gradient? }` — Standardized icon block:
    - `gradient: true` → solid brand gradient chip behind the icon.
    - Size scales automatically with `size`.

**Usage guidelines**

- Use `variant="gradient"` + `effect="glass"` for primary CTAs (e.g., "Unlock vault", "Continue").
- Use `fullWidth` for **single-column mobile flows** and bottom-of-screen actions.
- Use `loading` while awaiting consent/vault API responses to make wait states explicit.

### 13.3 `Card` (`lib/morphy-ux/card.tsx` / `lib/morphy-ux/morphy.tsx`)

- **Core props**
  - `variant?: ColorVariant` — Defaults to `"none"` for neutral containers.
  - `effect?: "fill" | "glass" | "fade"` — Defaults to `"glass"`.
  - `showRipple?: boolean` — Disabled by default; enable only for clickable cards.
- **Interaction & layout**
  - `interactive?: boolean` — Adds pointer cursor and subtle affordances for clickable cards.
  - `selected?: boolean` — Highlights the border using `--morphy-primary-start` (used for selected plans, portfolio tiles, etc.).
  - `fullHeight?: boolean` — Stretches the card to fill the parent height (useful in dashboard grids).
- **Icon block**
  - `icon?: { icon; title?; position?; gradient? }` — In-flow icon block with optional title.
  - `position`: `"top-left" | "top-right" | "bottom-left" | "bottom-right"`.

**Usage guidelines**

- Use `interactive` + `showRipple` for **clickable tiles** (Kai cards, navigation cards).
- Use `selected` to reflect current choice in comparisons (e.g., risk profile, plan selection).
- For read-only status summaries (e.g., consent history), keep `interactive={false}` and `showRipple={false}`.

### 13.4 Feedback & toasts (`lib/morphy-ux/toast-utils.tsx`)

- **Tone**
  - `FeedbackTone = "success" | "error" | "warning" | "info"` — Shared across toasts and status messaging.
- **Morphy Toast options**
  - `variant?: ColorVariant` — e.g., `"green-gradient"` for success, `"orange-gradient"` for warnings.
  - `duration?: number` — Default 3–5s depending on tone.
  - `description?: string` — Secondary explanatory copy.
- **Patterns**
  - Success: short, optimistic; auto-dismiss ~3s.
  - Error: actionable; longer duration (~5s) and clear next step.
  - Warning: cautionary but not blocking; ~4s.
  - Info: low-intensity, often about background tasks.

---

## 14. Human-Centered, Responsive UX (Hushh Flows)

Design every flow as if you are **personally using your own data agent on a small phone first**, then scale up to desktop.

### 14.1 Vault flows (creation, unlock, recovery)

- **Mental model**
  - Treat vault flows as **high-focus, low-distraction** experiences.
  - Avoid competing CTAs or dense content around passphrase/recovery key steps.
- **Layout**
  - Mobile: use `fullWidth` buttons for primary actions and keep the main CTA close to the thumb (bottom of the viewport where possible).
  - Desktop: center the content, but preserve the same step order and wording.
- **Feedback**
  - Use `morphyToast.success` for **unlocked vault** events with short copy (“Vault unlocked, VAULT_OWNER token issued”).
  - Use `morphyToast.error` for failures with a clear next step ("Check your passphrase and try again").

### 14.2 Consent review & history

- **Mental model**
  - Treat each consent card as a **contract snapshot**: who, what data, why, for how long.
  - Make revoke actions as visible and easy as accept/approve actions.
- **Layout**
  - On mobile, present consents in a **single-column card stack** using `Card` with `variant="muted"` and clear typography hierarchy.
  - On desktop, consider a two-column layout: left = active/pending consents, right = history/details.
- **Interaction**
  - Use `interactive` + `selected` on cards when the user is choosing between alternatives (e.g., scopes, durations).
  - Avoid hover-only affordances—everything important must be visible without hover for touch users.

### 14.3 Kai portfolio & dense dashboards

- **Mental model**
  - Kai views are for **sense-making**, not just data dumps: prioritize clarity over raw density.
  - Group related metrics into **small, focused cards** rather than one massive table.
- **Layout**
  - Use cards with `fullHeight` inside responsive grids (e.g., 1 column on mobile, 2–3 on desktop).
  - Reserve gradients and strong color for the **most important actions and KPIs**; keep secondary data subdued.
- **Responsiveness**
  - Typography should never drop below comfortable reading sizes on mobile; prefer wrapping over shrinking.
  - Ensure key CTAs remain visible without scrolling after Kai finishes a major analysis step.

### 14.4 Accessibility & touch ergonomics

- Minimum touch target: 44×44px (Apple HIG) for all tap targets, including card-level actions.
- Preserve clear focus outlines and keyboard navigation for all interactive Morphy-UX primitives.
- Avoid hover-only disclosures for critical information; always provide a tap/click alternative.

---

## 15. Step-Based Progress System

The app uses a **step-based progress system** that tracks real loading progress based on actual async operations. This replaces the previous PageLoadingProvider approach.

### 15.1 Architecture

```
StepProgressProvider (app/providers.tsx)
    └── StepProgressBar (components/ui/step-progress-bar.tsx)
    └── CacheProvider (lib/cache/cache-context.tsx)
    └── VaultProvider (lib/vault/vault-context.tsx)
    └── Page Components
```

- **`StepProgressProvider`**: Context provider that tracks step completion progress globally.
- **`StepProgressBar`**: Thin progress bar at top of viewport that shows real progress percentage.
- **`CacheProvider`**: In-memory cache for sharing data across page navigations.

### 15.2 How Pages Should Use the Progress System

**For pages with async data loading:**

```tsx
import { useStepProgress } from "@/lib/progress/step-progress-context";

export default function MyPage() {
  const { registerSteps, completeStep, reset } = useStepProgress();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      // Wait for auth to finish loading
      if (authLoading) return;

      // Register steps only once
      if (!initialized) {
        registerSteps(3); // Total number of loading steps
        setInitialized(true);
      }

      // Step 1: Auth check
      if (!isAuthenticated) {
        router.push("/");
        return;
      }
      completeStep();

      // Step 2: Fetch data
      try {
        await fetchData();
        if (!cancelled) completeStep();
      } catch (error) {
        if (!cancelled) completeStep(); // Complete on error too
      }

      // Step 3: Additional processing
      if (!cancelled) completeStep();
    }

    init();

    return () => {
      cancelled = true;
      reset();
    };
  }, [authLoading, isAuthenticated]);

  return <div>Page content</div>;
}
```

### 15.3 Key Principles

1. **Register steps once** - Use an `initialized` state to prevent duplicate registration
2. **Complete steps on error** - Always complete steps even on failure to finish the progress bar
3. **Use cancellation** - Track `cancelled` flag to prevent state updates on unmounted components
4. **Minimal dependencies** - Only include essential dependencies in useEffect to reduce re-renders

### 15.4 When to Use `HushhLoader` Directly

- **`variant="inline"` or `variant="compact"`**: For inline loading states within a component
- **Redirect pages**: For pages that immediately redirect (e.g., `/chat` redirecting to `/dashboard/kai`)

---

## 16. Caching System

The app uses a **global caching layer** to reduce API calls and improve page load performance.

### 16.1 Architecture

```
CacheService (lib/services/cache-service.ts)
    └── Singleton with TTL support
    └── In-memory Map storage

CacheProvider (lib/cache/cache-context.tsx)
    └── React context for UI reactivity
    └── Wraps CacheService for component access
```

### 16.2 CacheService Usage

```tsx
import {
  CacheService,
  CACHE_KEYS,
  CACHE_TTL,
} from "@/lib/services/cache-service";

const cache = CacheService.getInstance();

// Set with TTL
cache.set(CACHE_KEYS.WORLD_MODEL_METADATA(userId), data, CACHE_TTL.MEDIUM);

// Get (returns null if expired)
const cached = cache.get<WorldModelMetadata>(
  CACHE_KEYS.WORLD_MODEL_METADATA(userId),
);

// Invalidate
cache.invalidate(CACHE_KEYS.WORLD_MODEL_METADATA(userId));
cache.invalidatePattern("world_model_"); // Prefix match
cache.clear(); // Clear all
```

### 16.3 Cache Keys and TTLs

| Key Pattern                     | TTL   | Usage                          |
| ------------------------------- | ----- | ------------------------------ |
| `world_model_metadata_{userId}` | 5 min | User's domain metadata         |
| `vault_status_{userId}`         | 1 min | Vault status and domain counts |
| `active_consents_{userId}`      | 1 min | Active consent tokens          |
| `portfolio_data_{userId}`       | 5 min | Kai portfolio data             |

### 16.4 CacheProvider Hook

```tsx
import { useCache } from "@/lib/cache/cache-context";

function MyComponent() {
  const { getWorldModelMetadata, setWorldModelMetadata, invalidateUser } =
    useCache();

  // Check cache first
  const cached = getWorldModelMetadata(userId);
  if (cached) {
    // Use cached data
  }

  // Invalidate on logout
  invalidateUser(userId);
}
```

### 16.5 Prefetch on Vault Unlock

When the vault is unlocked, common data is prefetched in the background:

- World Model metadata
- Vault status
- Active consents

This happens automatically in `VaultProvider.unlockVault()`.

---

## 17. Page Transitions

The app uses **GSAP-powered opacity crossfade transitions** between routes.

### 17.1 Architecture

```
RootLayoutClient (app/layout-client.tsx)
    └── Two-page overlay system
    └── GSAP opacity animations
    └── Preserves flex layout during transitions
```

### 17.2 Critical Implementation Notes

**NEVER set `display: block` during transitions** - This breaks the flex layout hierarchy and causes scroll issues.

```tsx
// ❌ WRONG - Breaks flex layout
newPage.style.display = "block";

// ✅ CORRECT - Only animate opacity
newPage.style.opacity = "0";
gsap.to(newPage, { opacity: 1, ... });
```

**Always clean up inline styles** after transitions:

```tsx
onComplete: () => {
  newPage.style.removeProperty("display");
  newPage.style.removeProperty("opacity");
};
```

### 17.3 Scroll Container Hierarchy

For scrolling to work correctly, the flex hierarchy must be preserved:

```
body (h-screen, overflow-hidden)
  └── container (flex-1, min-h-0)
      └── providers wrapper (flex-1, min-h-0)
          └── scroll container (flex-1, overflow-y-auto, min-h-0)
              └── page content
```

**Key rule**: Every flex container in the chain must have `min-h-0` to allow shrinking below content size.

---

## 18. Background Styling

### 18.1 App Background Classes

| Class                   | Description                         |
| ----------------------- | ----------------------------------- |
| `.morphy-app-bg`        | Main app background gradient        |
| `.morphy-app-bg-radial` | Subtle radial glow overlay from top |

### 18.2 Light Mode Background

Clean white to subtle blue gradient:

```css
.morphy-app-bg {
  background: linear-gradient(
    180deg,
    #ffffff 0%,
    #ffffff 40%,
    #f2f8ff 70%,
    #e6f2ff 100%
  );
}
```

### 18.3 Dark Mode Background

Deep dark gradient without gold tones:

```css
.dark .morphy-app-bg {
  background: linear-gradient(
    145deg,
    #09090c 0%,
    #0c0c14 15%,
    #0f0f1a 30%,
    #121218 50%,
    #0f101a 65%,
    #0c0c14 80%,
    #09090c 100%
  );
}
```

### 18.4 Brand Colors

| Token                      | Light Mode         | Dark Mode          |
| -------------------------- | ------------------ | ------------------ |
| `--morphy-primary-start`   | `#e91e63` (Pink)   | `#e91e63` (Pink)   |
| `--morphy-primary-end`     | `#9c27b0` (Purple) | `#9c27b0` (Purple) |
| `--morphy-secondary-start` | `#c0c0c0` (Silver) | `#e91e63` (Pink)   |
| `--morphy-secondary-end`   | `#e8e8e8` (Silver) | `#9c27b0` (Purple) |

---

## 19. Kai Dashboard Components

The Kai investment dashboard uses specialized components for displaying portfolio data.

### 19.1 Component Architecture

| Component               | Location                                            | Purpose                            |
| ----------------------- | --------------------------------------------------- | ---------------------------------- |
| `PortfolioHistoryChart` | `components/kai/charts/portfolio-history-chart.tsx` | Real historical data visualization |
| `TransactionActivity`   | `components/kai/cards/transaction-activity.tsx`     | Recent trades and activity         |
| `IncomeDetailCard`      | `components/kai/cards/income-detail-card.tsx`       | Detailed income breakdown          |
| `CashFlowCard`          | `components/kai/cards/cash-flow-card.tsx`           | Cash flow summary                  |
| `AssetAllocationDonut`  | `components/kai/charts/asset-allocation-donut.tsx`  | Asset allocation pie chart         |

### 19.2 Data Integrity Principle

**Charts should only display real data.** Never use `Math.random()` or mock data in production charts.

Available data from brokerage statements:

- `historical_values[]` - Quarterly/monthly portfolio values from statement charts
- `transactions[]` - BUY, SELL, DIVIDEND, REINVEST activity
- `cash_flow` - Opening/closing balances, deposits, withdrawals
- `income_detail` - Dividends, interest, capital gains breakdown
- `ytd_metrics` - Year-to-date totals

If historical data is unavailable, show a **Period Summary** fallback instead of fake charts.

### 19.3 PortfolioHistoryChart Usage

```tsx
import { PortfolioHistoryChart } from "@/components/kai/charts/portfolio-history-chart";

// With real historical data
<PortfolioHistoryChart
  data={portfolioData.historical_values}
  beginningValue={beginningValue}
  endingValue={totalValue}
  statementPeriod="Feb 27 - Mar 31, 2021"
  height={180}
/>;

// Falls back to period summary if data.length < 2
```

### 19.4 TransactionActivity Usage

```tsx
import { TransactionActivity } from "@/components/kai/cards/transaction-activity";

<TransactionActivity transactions={portfolioData.transactions} maxItems={5} />;
```

---

## 20. Tabs and Segmented Controls

### 20.1 Component Selection

| Use Case                   | Component          | Import                                 |
| -------------------------- | ------------------ | -------------------------------------- |
| Content panels that switch | `Tabs`             | `@/lib/morphy-ux/ui/tabs`              |
| Single value selection     | `SegmentedControl` | `@/lib/morphy-ux/ui/segmented-control` |

**NEVER** import tabs from `@/components/ui/tabs` - always use Morphy-UX tabs for Material 3 ripple effects.

### 20.2 Morphy-UX Tabs

```tsx
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/lib/morphy-ux/ui/tabs";

<Tabs value={activeTab} onValueChange={setActiveTab}>
  <TabsList>
    <TabsTrigger value="overview">Overview</TabsTrigger>
    <TabsTrigger value="details">Details</TabsTrigger>
  </TabsList>
  <TabsContent value="overview">...</TabsContent>
  <TabsContent value="details">...</TabsContent>
</Tabs>;
```

### 20.3 SegmentedControl

For single-value selection (theme toggle, period selectors):

```tsx
import { SegmentedControl } from "@/lib/morphy-ux/ui/segmented-control";

// Compact variant (equal-width segments)
<SegmentedControl
  value={selectedPeriod}
  onValueChange={setSelectedPeriod}
  variant="compact"
  options={[
    { value: "1M", label: "1M" },
    { value: "3M", label: "3M" },
    { value: "1Y", label: "1Y" },
  ]}
/>

// Expanding variant (active segment expands with label)
<SegmentedControl
  value={theme}
  onValueChange={setTheme}
  variant="expanding"
  options={[
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ]}
/>
```

---

## 📚 Quick Reference

### Core Design Principles

| Principle | Description |
| --------- | ----------- |
| **Morphy UX First** | Always use Morphy UX components (`Button`, `Card`, `Input`) as the foundation. Prioritize component **props** over manual `className` overrides. |
| **Glass Morphism** | Default effect: `effect="glass"` for cards and overlays. Use `backdrop-blur-3xl` or `backdrop-blur-md`. Transparency: `bg-muted/80` or `bg-background/95`. |
| **Consistent Sizing** | Buttons: `size="xl"` (h-16) for primary actions. Inputs: `h-14 text-lg px-4` for form fields. Icons: `h-12 w-12` for headers, `h-5 w-5` for inline. |

### Design Tokens

| Scale       | Value        | Usage               |
| ----------- | ------------ | ------------------- |
| **Spacing** | `space-y-6`  | Section gaps        |
|             | `p-6`        | Card content        |
|             | `space-y-4`  | Form sections       |
|             | `gap-3`      | Standard gaps       |
| **Opacity** | `/80`, `/95` | Background overlays |
|             | `/50`        | Hover states        |
|             | `/10`        | Borders/Shadows     |

### Component Patterns

#### Vault Flows (Creation / Unlock Pattern)

- **Goal**: Focus user attention on a single primary action.
- **Key Rules**:
  - Icon size: `h-12 w-12`
  - Input: `h-14` with `text-lg`
  - Button: `size="xl"` (h-16)

**Composition:**

```tsx
<Card variant="none" effect="glass">
  <CardContent className="p-6 space-y-4">
    {/* Header */}
    <div className="text-center">
      <Icon className="h-12 w-12 mx-auto text-primary mb-4" />
      <h3 className="font-semibold text-xl">{title}</h3>
      <p className="text-base text-muted-foreground mt-2">{description}</p>
    </div>

    {/* Form Fields */}
    <div className="space-y-3">
      <Label htmlFor="field" className="text-base">
        {label}
      </Label>
      <Input
        id="field"
        type="password"
        className="h-14 text-lg px-4"
        autoFocus
      />
    </div>

    {/* Actions */}
    <div className="flex gap-3 pt-2">
      <Button variant="none" effect="glass" size="xl" className="flex-1">
        Secondary
      </Button>
      <Button variant="gradient" effect="glass" size="xl" className="flex-1">
        Primary
      </Button>
    </div>
  </CardContent>
</Card>
```

#### Pill Navigation (Bottom Nav & Theme Toggle)

- **Goal**: Floating, glass-morphic navigation elements.
- **Key Rules**:
  - ✅ Use native `<button>` or `<Link>`, NOT `<Button>` component
  - ✅ Only active item has background + shadow + ring
  - ✅ Smooth cubic-bezier easing: `ease-[cubic-bezier(0.25,1,0.5,1)]`

**Structure:**

```tsx
<div className="flex items-center p-1 bg-muted/80 backdrop-blur-3xl rounded-full shadow-2xl ring-1 ring-black/5">
  {items.map((item) => {
    const isActive = /* condition */;
    return (
      <button
        className={cn(
          "relative flex items-center justify-center gap-2 px-4 py-2.5 rounded-full transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)]",
          isActive
            ? "bg-background text-foreground shadow-sm ring-1 ring-black/5 min-w-[120px]"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50 min-w-[44px]"
        )}
      >
        <Icon className={cn("h-5 w-5", isActive && "scale-105")} />
        <div className={cn(
          "overflow-hidden transition-all duration-500",
          isActive ? "w-auto opacity-100 ml-1" : "w-0 opacity-0"
        )}>
          <span className="text-sm font-medium whitespace-nowrap">{label}</span>
        </div>
      </button>
    );
  })}
</div>
```

### Button Variants

#### Primary Actions

```tsx
<Button variant="gradient" effect="glass" size="xl" showRipple>
  Continue
</Button>
```

#### Secondary Actions

```tsx
<Button variant="none" effect="glass" size="xl">
  Cancel
</Button>
```

#### Destructive Actions

```tsx
<Button
  variant="none"
  size="lg"
  className="border border-destructive/30 text-destructive hover:bg-destructive/10"
>
  Sign Out
</Button>
```

---

## ✅ Checklist for New Components

Before creating a new component, ensure:

- [ ] Uses Morphy UX components as foundation
- [ ] Follows established sizing patterns (xl buttons, h-14 inputs)
- [ ] Implements glass morphism where appropriate
- [ ] Uses semantic color tokens, not hardcoded colors
- [ ] Matches transition timing (500ms cubic-bezier)
- [ ] Responsive on mobile (tested at 375px width)

---

_Version: 6.0 | Updated February 2026 | Consolidated frontend_ui_patterns.md content_