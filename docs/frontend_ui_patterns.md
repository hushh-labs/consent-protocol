# Frontend UI Patterns (Morphy-UX)

> Practical patterns for composing Hushh flows using Morphy-UX primitives.

---

## 1. Vault Flows

### 1.1 Vault Creation / Unlock Screen

- **Goal**: Focus user attention on a single primary action (create/unlock vault).
- **Layout**:
  - Single-column stack.
  - Use a central `Card` with `variant="muted"` and `effect="glass"`.
  - Primary CTA as a `Button` with `variant="gradient"` and `fullWidth`.

**Example composition (conceptual):**

```tsx
<Card variant="muted" effect="glass" fullHeight={false}>
  <CardHeader>
    <CardTitle>Create your vault</CardTitle>
    <CardDescription>
      Your data is encrypted on-device. We never see your key.
    </CardDescription>
  </CardHeader>
  <CardContent>
    {/* Passphrase fields, hints, recovery info */}
  </CardContent>
  <CardFooter>
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
  </CardFooter>
</Card>
```

**UX Notes**
- Do not crowd the surface with extra links or secondary CTAs.
- Make errors explicit using `morphyToast.error` with actionable messaging.

---

## 2. Consent Review

### 2.1 Pending Consent List

- **Goal**: Let users quickly understand and act on each consent.
- **Layout**:
  - Stack of `Card` components in a single column on mobile.
  - Each card shows:
    - Requester (who)
    - Data category (what)
    - Purpose and duration (why/for how long)
  - Approve / Reject actions as Morphy-UX `Button`s.

**Composition sketch:**

```tsx
<Card variant="muted" effect="glass">
  <CardHeader>
    <CardTitle>Share professional profile</CardTitle>
    <CardDescription>
      Kai wants to access your work history and skills to personalize analysis.
    </CardDescription>
  </CardHeader>
  <CardContent>
    {/* Scope, duration, and data summary */}
  </CardContent>
  <CardFooter>
    <div className="flex gap-3 w-full">
      <Button variant="muted" effect="fill" className="flex-1">
        Not now
      </Button>
      <Button
        variant="gradient"
        effect="glass"
        className="flex-1"
        showRipple
      >
        Allow
      </Button>
    </div>
  </CardFooter>
</Card>
```

**UX Notes**
- Treat revoke as a first-class action in history views.
- Keep copy neutral and factual; avoid dark patterns.

---

## 3. Kai Portfolio & Dashboards

### 3.1 KPI Tile Grid

- **Goal**: Surface 3–6 key metrics without overwhelming.
- **Layout**:
  - Responsive grid:
    - 1 column on small screens.
    - 2–3 columns on larger breakpoints.
  - Use `Card` with `interactive` and optional `selected` for tiles that can be drilled into.

**Composition sketch:**

```tsx
<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
  {kpis.map((kpi) => (
    <Card
      key={kpi.id}
      variant="muted"
      effect="glass"
      interactive
      fullHeight
      selected={kpi.id === activeKpiId}
    >
      <CardHeader>
        <CardTitle>{kpi.label}</CardTitle>
        <CardDescription>{kpi.subtitle}</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Metric value and sparkline */}
      </CardContent>
    </Card>
  ))}
</div>
```

**UX Notes**
- Avoid hover-only scale effects; use subtle opacity/shadow shifts for hover.
- Keep typography readable; let layout wrap rather than shrinking text too far.

---

## 4. Motion Patterns (GSAP-friendly)

- For page-level sections (hero, dashboard header, main content):
  - Use a simple **fade + small vertical offset** on initial load.
  - Avoid complex chained animations on mobile; keep sequences short.
- For lists and grids (consent cards, KPI tiles):
  - Use small staggered entrances when content first appears.
  - Use hover/focus styles (shadow/opacity) instead of transform scale.
- For charts:
  - Let charts fade/slide in once; avoid looping animations.
  - Use Morphy-UX chart colors and keep animation durations short.

---

## 5. Pattern Checklist

For any new user-facing flow:

- **Layout**
  - Mobile-first, single-column by default.
  - Respect safe areas and `100dvh` rules from the design system.
- **Primitives**
  - Prefer Morphy-UX `Button` and `Card` for primary UX surfaces.
  - Use `showRipple` on primary interactive elements.
- **Feedback**
  - Use `morphyToast` helpers for success/error/warning/info.
  - Keep messages short, clear, and action-oriented.
- **Accessibility**
  - Ensure touch targets are at least 44×44px.
  - Preserve focus outlines and keyboard interactions.

