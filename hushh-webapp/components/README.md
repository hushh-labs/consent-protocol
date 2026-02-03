# Component Development Guidelines

## 1. Tri-Flow Architecture (Data Access)

### ⛔ CRITICAL: Network Calls in Components

Components **must never** talk directly to backend routes or databases.

### ❌ NEVER DO THIS:

```typescript
// WRONG: Direct fetch() to Next.js routes
const response = await fetch("/api/vault/food", { method: "POST", ... });
```

**Why it fails**: Native platforms (iOS/Android) have NO Next.js server. This only works on web.

### ✅ ALWAYS DO THIS:

```typescript
// CORRECT: Use platform-aware service
import { ApiService } from "@/lib/services/api-service";

const response = await ApiService.storePreferences({ ... });
```

**Why it works**: Service layer detects platform and routes correctly:
- Web → Next.js proxy
- Native → Capacitor plugin → Backend

### Rule: Components MUST NOT Call fetch()

If your component needs network access:
1. Check if service method exists in `lib/services/`
2. If not, create one following tri-flow pattern
3. Use the service method, never raw fetch()

Exception: Only test files and API routes themselves can use fetch().

### Tri-Flow Diagram

```text
Component → Service → [Web Proxy OR Native Plugin] → Python Backend
```

**Missing any layer = broken on native platforms.**

---

## 2. Morphy-UX vs Shadcn/Radix

Hushh uses **Shadcn + Radix** as low-level primitives and **Morphy-UX** for physics, brand, and interaction.

- **`components/ui/*`**: Stock Shadcn/Radix components (updatable via CLI).
- **`lib/morphy-ux/*`**: Core Morphy-UX tokens, motion, and primitives (Button, Card, ripple, toasts).
- **`lib/morphy-ux/ui/*`**: Morphy-enhanced versions of specific UI primitives (e.g., sidebar tabs).

### When to use what

- Use **Morphy-UX primitives** (`Button`, `Card`, toasts) for:
  - All top-level CTAs (vault, consents, Kai actions).
  - Interactive dashboards and navigation tiles.
  - Any element that needs brand physics (ripple, glassmorphism).
- Use **Shadcn/Radix primitives** when:
  - You need a low-level control that Morphy-UX does not yet wrap.
  - You are building an internal-only tool where brand polish is not required.

See `[docs/reference/frontend_design_system.md](../../docs/reference/frontend_design_system.md)` for full prop contracts.

---

## 3. Morphy-UX Primitives (Button, Card, Feedback)

### 3.1 Button (primary interactive element)

```tsx
import { Button } from "@/lib/morphy-ux/morphy";

<Button
  variant="gradient"
  effect="glass"
  size="lg"
  fullWidth
  loading={isSubmitting}
  showRipple
>
  Continue
</Button>
```

- **Props (high level)**
  - `variant`: visual style (`"gradient"`, `"muted"`, `"blue-gradient"`, etc.).
  - `effect`: `"fill" | "glass" | "fade"`.
  - `size`: `"sm" | "default" | "lg" | "xl" | "icon" | "icon-sm"`.
  - `fullWidth`: stretches to `w-full` (ideal for mobile flows).
  - `loading`: disables the button and shows a busy state.
  - `showRipple`: enables Material 3 state layers.

### 3.2 Card (surfaces & tiles)

```tsx
import { Card } from "@/lib/morphy-ux/morphy";

<Card
  variant="muted"
  effect="glass"
  interactive
  selected={isSelected}
  fullHeight
>
  {/* Consent / Kai / Vault content */}
</Card>
```

- **Props (high level)**
  - `variant`, `effect`, `showRipple` — same semantics as `Button`.
  - `interactive`: pointer cursor + hover affordances for clickable cards.
  - `selected`: highlights with brand border.
  - `fullHeight`: fills available vertical space (dashboards).

### 3.3 Feedback (toasts)

```tsx
import { morphyToast } from "@/lib/morphy-ux/morphy";

morphyToast.success("Vault unlocked", {
  description: "VAULT_OWNER token issued for this session.",
});
```

Use:
- `success` for completed actions.
- `error` with a clear next step.
- `warning` for risky actions.
- `info` for background events (syncing, imports, etc.).

---

## 4. Kai Module Notes

Kai is **data-dense** and must remain visually consistent with the rest of the app.

- Prefer Morphy-UX `Button` and `Card` in:
  - `components/kai/kai-chat.tsx`
  - `components/kai/kai-debate-inline.tsx`
  - `components/kai/views/*`
- Avoid:
  - Raw `<button>` elements.
  - Stock `@/components/ui/button` for primary CTAs.
  - Hover-only scale effects (`hover:scale-*`) on KPI tiles.

When in doubt:
- Use Morphy-UX for **anything user-facing**, especially portfolio actions and analysis CTAs.
- Keep Shadcn-only usage to internal utilities or temporary scaffolding.

---

## 5. Before Creating a Component

Ask yourself:
1. Does this component make network calls?
2. If yes, does the service method exist?
3. If no, have I implemented all 3 layers (Web + iOS + Android)?
4. Am I using Morphy-UX primitives where the user **feels** the brand and physics?

If you answered "no" to question 3, **STOP** and implement the full tri-flow first.

If you answered "no" to question 4 for a user-facing surface, strongly consider switching to Morphy-UX.

---

## 6. See Also

- `[docs/project_context_map.md](../../docs/project_context_map.md)` – Tri-flow rules.
- `[docs/guides/feature_checklist.md](../../docs/guides/feature_checklist.md)` – Implementation guide.
- `[docs/reference/route_contracts.md](../../docs/reference/route_contracts.md)` – Endpoint documentation.
- `[docs/reference/frontend_design_system.md](../../docs/reference/frontend_design_system.md)` – Design tokens, props, and UX patterns.
