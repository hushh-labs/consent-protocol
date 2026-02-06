# Frontend UI Patterns (Morphy-UX)

> Practical patterns for composing Hushh flows using Morphy-UX primitives.

---

## 🎨 Core Design Principles

### 1. **Morphy UX First**

- Always use Morphy UX components (`Button`, `Card`, `Input`) as the foundation
- Prioritize component **props** over manual `className` overrides
- Use `variant`, `effect`, `size` props instead of custom Tailwind classes

### 2. **Glass Morphism**

- Default effect: `effect="glass"` for cards and overlays
- Backdrop blur: `backdrop-blur-3xl` or `backdrop-blur-md`
- Transparency: `bg-muted/80` or `bg-background/95`

### 3. **Consistent Sizing**

- **Buttons**: `size="xl"` (h-16) for primary actions
- **Inputs**: `h-14 text-lg px-4` for form fields
- **Icons**: `h-12 w-12` for headers, `h-5 w-5` for inline
- **Labels**: `text-base` for form labels

---

## 🧩 Component Patterns

### 1. Vault Flows

#### 1.1 Vault Creation / Unlock Pattern

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

### 2. Pill Navigation (Bottom Nav & Theme Toggle)

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

### 3. Onboarding Tour

- **Goal**: Highlight UI elements with tooltips and focused overlay.
- **Key Rules**:
  - Z-index layers: overlay (9998) → highlight (9999) → popover (10001)
  - Box-shadow cutout technique
  - Glass effect tooltip

---

## 🎯 Button Variants

### Primary Actions

```tsx
<Button variant="gradient" effect="glass" size="xl" showRipple>
  Continue
</Button>
```

### Secondary Actions

```tsx
<Button variant="none" effect="glass" size="xl">
  Cancel
</Button>
```

### Destructive Actions

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

## 📏 Design Tokens

| Scale       | Value        | Usage               |
| ----------- | ------------ | ------------------- |
| **Spacing** | `space-y-6`  | Section gaps        |
|             | `p-6`        | Card content        |
|             | `space-y-4`  | Form sections       |
|             | `gap-3`      | Standard gaps       |
| **Opacity** | `/80`, `/95` | Background overlays |
|             | `/50`        | Hover states        |
|             | `/10`        | Borders/Shadows     |

---

## ✅ Checklist for New Components

Before creating a new component, ensure:

- [ ] Uses Morphy UX components as foundation
- [ ] Follows established sizing patterns (xl buttons, h-14 inputs)
- [ ] Implements glass morphism where appropriate
- [ ] Uses semantic color tokens, not hardcoded colors
- [ ] Matches transition timing (500ms cubic-bezier)
- [ ] Responsive on mobile (tested at 375px width)
