# Component Development Guidelines

## ⛔ CRITICAL: Network Calls in Components

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

## Tri-Flow Architecture

Every feature that touches backend data must implement:

```
Component → Service → [Web Proxy OR Native Plugin] → Python Backend
```

**Missing any layer = broken on native platforms.**

## Examples

### ✅ Correct Pattern

```typescript
// components/food/food-editor.tsx
import { ApiService } from "@/lib/services/api-service";

async function handleSave() {
  const response = await ApiService.storePreferences({
    userId,
    domain: "food",
    preferences: encryptedData,
    consentToken,
  });
  
  if (!response.ok) {
    throw new Error("Failed to save");
  }
}
```

### ❌ Wrong Pattern

```typescript
// DON'T DO THIS
async function handleSave() {
  const response = await fetch("/api/vault/food", {  // Breaks on native!
    method: "POST",
    body: JSON.stringify(data),
  });
}
```

## Before Creating a Component

Ask yourself:
1. Does this component make network calls?
2. If yes, does the service method exist?
3. If no, have I implemented all 3 layers (Web + iOS + Android)?

If you answered "no" to question 3, **STOP** and implement the full tri-flow first.

## See Also

- [Project Context Map](../docs/PROJECT_CONTEXT_MAP.md) - Tri-flow rules
- [Feature Checklist](../docs/FEATURE_CHECKLIST.md) - Implementation guide
- [Route Contracts](../docs/technical/ROUTE_CONTRACTS.md) - Endpoint documentation
