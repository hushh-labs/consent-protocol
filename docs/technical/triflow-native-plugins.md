# Triflow Architecture: Native Plugin Development Guide

> **CRITICAL**: Every Next.js `/api` route that needs to work on iOS/Android **MUST** have a corresponding native Capacitor plugin implementation.

## Overview

Hushh uses the **Triflow** architecture pattern where the same TypeScript codebase runs across three platforms:

1. **Web** - Standard Next.js with server-side API routes
2. **iOS** - Capacitor native app (Swift plugins)
3. **Android** - Capacitor native app (Kotlin plugins)

## The Core Problem

Next.js `/api` routes run on a Node.js server. When the app is deployed as a Capacitor native app:

```
❌ Web: fetch("/api/vault/food") → Next.js server handles it
✅ Native: fetch("/api/vault/food") → FAILS - No server available!
```

Native apps load the frontend from a static bundle. There is **no Next.js server** to handle `/api` routes.

## Version Matrix

| Package              | Version |
| -------------------- | ------- |
| `@capacitor/core`    | `8.0.0` |
| `@capacitor/ios`     | `8.0.0` |
| `@capacitor/android` | `8.0.0` |
| `next`               | `15.x`  |
| `typescript`         | `5.x`   |

---

## Mandatory Development Workflow

### Step 1: Create Next.js API Route (Web)

```typescript
// app/api/consent/pending/approve/route.ts
export async function POST(request: Request) {
  const body = await request.json();
  const { userId, requestId, encryptedData } = body;

  // Call Python backend
  const response = await fetch(`${BACKEND_URL}/api/consent/pending/approve`, {
    method: "POST",
    body: JSON.stringify({ userId, requestId, encryptedData }),
  });

  return Response.json(await response.json());
}
```

### Step 2: Create TypeScript Interface (`lib/capacitor/index.ts`)

```typescript
export interface HushhConsentPlugin {
  approve(options: {
    requestId: string;
    userId?: string;
    encryptedData?: string;
    authToken?: string;
  }): Promise<{ success: boolean }>;
}

export const HushhConsent = registerPlugin<HushhConsentPlugin>("HushhConsent");
```

### Step 3: Implement Android Plugin (Kotlin)

**Location:** `android/app/src/main/java/com/hushh/pda/plugins/HushhConsent/HushhConsentPlugin.kt`

```kotlin
@PluginMethod
fun approve(call: PluginCall) {
    val requestId = call.getString("requestId")
        ?: return call.reject("Missing requestId")
    val userId = call.getString("userId")
    val authToken = call.getString("authToken")
    val backendUrl = call.getString("backendUrl") ?: defaultBackendUrl

    // IMPORTANT: Use the correct endpoint path!
    val url = "$backendUrl/api/consent/pending/approve"

    Thread {
        try {
            val jsonBody = JSONObject().apply {
                put("requestId", requestId)
                if (userId != null) put("userId", userId)
            }

            val requestBody = jsonBody.toString()
                .toRequestBody("application/json".toMediaType())

            val request = Request.Builder()
                .url(url)
                .post(requestBody)
                .addHeader("Content-Type", "application/json")
                .apply {
                    if (authToken != null) {
                        addHeader("Authorization", "Bearer $authToken")
                    }
                }
                .build()

            val response = httpClient.newCall(request).execute()

            activity.runOnUiThread {
                if (response.isSuccessful) {
                    call.resolve(JSObject().put("success", true))
                } else {
                    call.reject("Backend error: ${response.body?.string()}")
                }
            }
        } catch (e: Exception) {
            activity.runOnUiThread {
                call.reject("Failed: ${e.message}")
            }
        }
    }.start()
}
```

### Step 4: Implement iOS Plugin (Swift)

**Location:** `ios/App/App/Plugins/HushhConsentPlugin.swift`

```swift
@objc func approve(_ call: CAPPluginCall) {
    guard let requestId = call.getString("requestId") else {
        call.reject("Missing requestId")
        return
    }

    let userId = call.getString("userId")
    let authToken = call.getString("authToken")
    let backendUrl = call.getString("backendUrl") ?? defaultBackendUrl

    var body: [String: Any] = ["requestId": requestId]
    if let uid = userId { body["userId"] = uid }

    // IMPORTANT: Use the correct endpoint path!
    let url = "\(backendUrl)/api/consent/pending/approve"

    performRequest(url: url, body: body, authToken: authToken) { result, error in
        if let error = error {
            call.reject(error)
        } else {
            call.resolve(["success": true])
        }
    }
}
```

### Step 5: Create Platform-Aware ApiService

**Location:** `lib/services/api-service.ts`

```typescript
import { Capacitor } from "@capacitor/core";

export class ApiService {
  static async approvePendingConsent(data: {
    userId: string;
    requestId: string;
    encryptedData?: string;
  }): Promise<Response> {
    // Native Platform: Use Capacitor Plugin
    if (Capacitor.isNativePlatform()) {
      try {
        const { HushhConsent } = await import("@/lib/capacitor");
        const authToken = await this.getFirebaseToken();

        await HushhConsent.approve({
          requestId: data.requestId,
          userId: data.userId,
          encryptedData: data.encryptedData,
          authToken,
        });

        return new Response(JSON.stringify({ success: true }), { status: 200 });
      } catch (e: any) {
        return new Response(e.message, { status: 500 });
      }
    }

    // Web Platform: Use Next.js API route
    return fetch("/api/consent/pending/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  }
}
```

---

## Common Pitfalls

### 1. Wrong Endpoint Paths

```kotlin
// ❌ WRONG - This endpoint doesn't exist!
val url = "$backendUrl/db/consent/approve"

// ✅ CORRECT - Match the Python backend route
val url = "$backendUrl/api/consent/pending/approve"
```

### 2. Body vs Query Parameters

```python
# Python FastAPI - Parameters as function args = QUERY params
@router.post("/pending/deny")
async def deny_consent(userId: str, requestId: str):
    ...
```

```kotlin
// ✅ CORRECT - Use query parameters
val url = "$backendUrl/api/consent/pending/deny?userId=$userId&requestId=$requestId"

// ❌ WRONG - Body won't work for this endpoint
val jsonBody = JSONObject().put("userId", userId).put("requestId", requestId)
```

### 3. Missing userId in Native Calls

```typescript
// ❌ WRONG - userId not passed to native
await HushhConsent.deny({ requestId });

// ✅ CORRECT - Always pass userId
await HushhConsent.deny({
  requestId,
  userId: data.userId, // Required!
  authToken,
});
```

---

## Directory Structure

```
hushh-webapp/
├── app/api/                          # Next.js API routes (Web only)
│   └── consent/
│       └── pending/
│           ├── approve/route.ts
│           └── deny/route.ts
│
├── lib/
│   ├── capacitor/
│   │   ├── index.ts                  # Plugin registration & interfaces
│   │   └── types.ts                  # Shared types
│   │
│   └── services/
│       └── api-service.ts            # Platform-aware API layer
│
├── android/app/src/main/java/com/hushh/pda/plugins/
│   └── HushhConsent/
│       └── HushhConsentPlugin.kt     # Android implementation
│
└── ios/App/App/Plugins/
    └── HushhConsentPlugin.swift      # iOS implementation
```

---

## Checklist: Adding a New API Feature

- [ ] Design the API endpoint in Python backend
- [ ] Create Next.js `/api` route for web
- [ ] Add TypeScript interface to `lib/capacitor/index.ts`
- [ ] Implement Android Kotlin plugin method
- [ ] Implement iOS Swift plugin method
- [ ] Update `ApiService` with platform-aware routing
- [ ] Test on web (`npm run dev`)
- [ ] Test on Android (`npm run cap:android:run`)
- [ ] Test on iOS (`npm run cap:ios:run`)

---

## Testing Commands

```bash
# Web development
npm run dev

# Build for Capacitor
npm run cap:build

# Sync and run Android
npx cap sync android && npx cap run android --target emulator-5554

# Sync and run iOS
npx cap sync ios && npx cap run ios

# Manual APK install (if auto-deploy fails)
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

---

## Related Documentation

- [Mobile Architecture](./mobile.md) - Detailed iOS/Android setup
- [Architecture Overview](./architecture.md) - System-wide patterns
- [Consent Implementation](./consent-implementation.md) - Consent protocol details
