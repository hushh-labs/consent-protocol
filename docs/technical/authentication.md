# Authentication Architecture

> Complete authentication and session management for Hushh.

**Updated: December 2025**

---

## 🔐 Three-Layer Security Model

Hushh uses a layered security approach separating **identity** from **vault access**:

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION LAYERS                         │
├─────────────────────────────────────────────────────────────────┤
│ Layer 1: Firebase Auth     → IDENTITY (who you are)             │
│ Layer 2: Session Cookie    → ROUTE ACCESS (httpOnly, secure)    │
│ Layer 3: Vault Key         → DATA ACCESS (memory only, BYOK)    │
└─────────────────────────────────────────────────────────────────┘
```

### UX Terminology

| Action           | What It Does                                     |
| ---------------- | ------------------------------------------------ |
| **Sign In**      | Firebase OAuth (Google) - establishes identity   |
| **Unlock Vault** | Passphrase verification - derives encryption key |

These are separate concepts and should never be merged in the UI.

---

## 🍪 Session Cookie (Firebase Admin SDK)

### Why httpOnly Cookies?

| Approach            | XSS Vulnerable | Cross-Tab | Recommended |
| ------------------- | -------------- | --------- | ----------- |
| sessionStorage      | ✅ Yes         | ❌ No     | ❌          |
| localStorage        | ✅ Yes         | ✅ Yes    | ❌          |
| **httpOnly Cookie** | ❌ No          | ✅ Yes    | ✅          |

### Implementation

```typescript
// POST /api/auth/session
import { createSessionCookie } from "@/lib/firebase/admin";

const { sessionCookie } = await createSessionCookie(
  idToken,
  5 * 24 * 60 * 60 * 1000
);

cookies().set("hushh_session", sessionCookie, {
  httpOnly: true, // JavaScript cannot read
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
});
```

### Files

| File                            | Purpose                           |
| ------------------------------- | --------------------------------- |
| `lib/firebase/admin.ts`         | Firebase Admin SDK initialization |
| `app/api/auth/session/route.ts` | Session cookie CRUD               |
| `middleware.ts`                 | Route protection                  |

---

## 🔑 Vault Key (Memory Only)

### Why Memory Only?

The vault key is stored in **React Context (memory)**, NOT sessionStorage or localStorage:

```typescript
// ❌ OLD (XSS vulnerable)
sessionStorage.setItem("vault_key", vaultKeyHex);

// ✅ NEW (XSS protected)
const { unlockVault } = useVault();
unlockVault(vaultKeyHex); // Stored in React state only
```

### Security Benefits

1. **XSS cannot steal** - `sessionStorage.getItem("vault_key")` returns null
2. **Page refresh clears** - User must re-enter passphrase
3. **Tab isolated** - Each tab has separate vault state

### Implementation

```typescript
// lib/vault/vault-context.tsx
export function VaultProvider({ children }) {
  const [vaultKey, setVaultKey] = useState<string | null>(null);

  const unlockVault = (key: string) => setVaultKey(key);
  const getVaultKey = () => vaultKey;
  const isVaultUnlocked = !!vaultKey;

  return <VaultContext.Provider value={{...}}>{children}</VaultContext.Provider>;
}
```

---

## 🔄 Authentication Flow

### New User

```
Google OAuth → Create Passphrase → Show Recovery Key → Dashboard
```

### Returning User

```
Google OAuth → Enter Passphrase → Dashboard
```

### New Tab (Same User)

```
Firebase authenticated (IndexedDB) → Passphrase required → Dashboard
```

---

## 📁 Key Files

| File                            | Purpose                       |
| ------------------------------- | ----------------------------- |
| `lib/firebase/config.ts`        | Client-side Firebase          |
| `lib/firebase/admin.ts`         | Server-side Firebase Admin    |
| `lib/vault/vault-context.tsx`   | Memory-only vault key storage |
| `app/api/auth/session/route.ts` | httpOnly cookie management    |
| `middleware.ts`                 | Route protection              |
| `app/login/page.tsx`            | OAuth + passphrase UI         |
| `components/navbar.tsx`         | Sign In/Sign Out buttons      |

---

## ⚙️ Environment Variables

```env
# Firebase Client (public)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=

# Firebase Admin (private)
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account"...}
```

---

_Version: 1.0 | December 2025_
