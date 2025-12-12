---
description: How to add a new page to the Hushh app
---

# Adding a New Page

## 1. Create the Page File

```bash
# Create new route folder
mkdir app/[route-name]
touch app/[route-name]/page.tsx
```

## 2. Use This Template

```tsx
"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";

export default function NewPage() {
  return (
    <main
      className="min-h-screen"
      style={{ background: "var(--color-background)" }}
    >
      {/* Navigation */}
      <nav className="nav-glass px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">🤫</span>
            <span className="font-semibold text-primary">hushh</span>
          </Link>
          <Button variant="gradient" effect="glass" showRipple>
            Action
          </Button>
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-headline mb-4">Page Title</h1>
          <p className="text-body text-secondary">Description</p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 mt-12">
          {/* Use Card component */}
          <Card variant="none" effect="glass" showRipple>
            <CardTitle>Title</CardTitle>
            <CardDescription>Description</CardDescription>
          </Card>
        </div>
      </div>
    </main>
  );
}
```

## 3. Key Requirements

- [ ] Use `"use client"` directive
- [ ] Import components from `@/components/ui/`
- [ ] Use CSS classes: `.nav-glass`, `.text-headline`, etc.
- [ ] Use CSS variables: `var(--color-background)`, etc.
- [ ] Use `Card showRipple` for clickable cards
- [ ] Use `Button showRipple` for buttons (NOT RippleButton)
- [ ] Wrap animations with `motion.div`

## 4. Add to Navigation

Update `app/page.tsx` navigation:

```tsx
<Link href="/new-route" className="nav-link">
  New Page
</Link>
```
