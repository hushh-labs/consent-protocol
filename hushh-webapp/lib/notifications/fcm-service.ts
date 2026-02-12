/**
 * Unified FCM Service
 * ====================
 * 
 * Single FCM implementation that works on BOTH web and native platforms.
 * Replaces the hybrid SSE+FCM approach with FCM-only architecture.
 * 
 * Features:
 * - Platform detection (web vs native)
 * - Token management (get, register, delete)
 * - Message listeners (foreground + background)
 * - Unified event dispatching
 */

import { Capacitor } from "@capacitor/core";
import { ApiService } from "@/lib/services/api-service";

// Event name for FCM messages (both web and native dispatch this)
export const FCM_MESSAGE_EVENT = "fcm-message";

/**
 * Initialize FCM for current platform (web or native)
 * 
 * @param userId - User ID for backend registration
 * @param idToken - Firebase ID token for authentication
 */
export async function initializeFCM(
  userId: string,
  idToken: string
): Promise<void> {
  const isNative = Capacitor.isNativePlatform();

  if (isNative) {
    await initializeNativeFCM(userId, idToken);
  } else {
    await initializeWebFCM(userId, idToken);
  }
}

/**
 * Initialize FCM for native platforms (iOS/Android)
 */
async function initializeNativeFCM(
  userId: string,
  idToken: string
): Promise<void> {
  try {
    console.log("[FCM] Initializing for native platform...");

    const { FirebaseMessaging } = await import("@capacitor-firebase/messaging");

    // Step 1: Request notification permissions
    const permissionResult = await FirebaseMessaging.requestPermissions();
    console.log("[FCM] Permission result:", permissionResult);

    if (permissionResult.receive !== "granted") {
      console.warn("[FCM] Notification permission not granted");
      return;
    }

    // Step 2: Get FCM token
    const { token } = await FirebaseMessaging.getToken();
    console.log("[FCM] Got token:", token.substring(0, 20) + "...");

    // Step 3: Register token with backend
    const platform = Capacitor.getPlatform() as "ios" | "android" | "web";
    const response = await ApiService.registerPushToken(
      userId,
      token,
      platform,
      idToken
    );

    if (response.ok) {
      console.log("[FCM] ✅ Token registered with backend");
    } else {
      console.error("[FCM] ❌ Failed to register token:", response.status);
    }

    // Step 4: Set up message listeners
    setupNativeListeners();

    console.log("[FCM] ✅ Native initialization complete");
  } catch (error) {
    console.error("[FCM] ❌ Native initialization failed:", error);
  }
}

/**
 * Initialize FCM for web platform
 */
async function initializeWebFCM(
  userId: string,
  idToken: string
): Promise<void> {
  try {
    console.log("[FCM] Initializing for web platform...");

    // Check for required env var
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      console.warn("[FCM] NEXT_PUBLIC_FIREBASE_VAPID_KEY not set");
      return;
    }

    // Request notification permission
    if (!("Notification" in window)) {
      console.warn("[FCM] Notifications not supported");
      return;
    }

    if (Notification.permission === "denied") {
      console.warn("[FCM] Notification permission denied");
      return;
    }

    if (Notification.permission !== "granted") {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        console.warn("[FCM] Notification permission not granted");
        return;
      }
    }

    // Get FCM token
    const { getMessaging, getToken, onMessage } = await import(
      "firebase/messaging"
    );
    const { app } = await import("@/lib/firebase/config");

    // Check for required Firebase config values before initializing messaging
    // The Firebase Web SDK requires appId for the Installations service (used by getToken)
    if (!app.options.appId || !app.options.apiKey) {
      console.warn("[FCM] Missing 'appId' or 'apiKey' in Firebase config. Skipping FCM initialization to prevent crash.");
      console.warn("[FCM] Please add NEXT_PUBLIC_FIREBASE_APP_ID to your .env.local if you wish to use Push Notifications.");
      return;
    }

    const messaging = getMessaging(app);
    const token = await getToken(messaging, { vapidKey });

    if (!token) {
      console.warn("[FCM] Failed to get token");
      return;
    }

    console.log("[FCM] Got token:", token.substring(0, 20) + "...");

    // Register token with backend
    const response = await ApiService.registerPushToken(
      userId,
      token,
      "web",
      idToken
    );

    if (response.ok) {
      console.log("[FCM] ✅ Token registered with backend");
    } else {
      console.error("[FCM] ❌ Failed to register token:", response.status);
    }

    // Set up foreground message listener
    onMessage(messaging, (payload) => {
      console.log("[FCM] 📬 Foreground message received:", payload);

      // Dispatch custom event
      window.dispatchEvent(
        new CustomEvent(FCM_MESSAGE_EVENT, {
          detail: payload,
        })
      );
    });

    console.log("[FCM] ✅ Web initialization complete");
  } catch (error) {
    console.error("[FCM] ❌ Web initialization failed:", error);
  }
}

/**
 * Set up message listeners for native platforms
 */
function setupNativeListeners(): void {
  import("@capacitor-firebase/messaging").then(({ FirebaseMessaging }) => {
    // Foreground message handler
    FirebaseMessaging.addListener("notificationReceived", (notification) => {
      console.log("[FCM] Foreground message received:", notification);

      // Dispatch custom event (same as web)
      window.dispatchEvent(
        new CustomEvent(FCM_MESSAGE_EVENT, {
          detail: notification,
        })
      );
    });

    // Notification tap handler
    FirebaseMessaging.addListener(
      "notificationActionPerformed",
      (action) => {
        console.log("[FCM] Notification tapped:", action);

        const data = action.notification.data as
          | Record<string, unknown>
          | undefined;

        // Navigate based on notification type
        if (
          data &&
          typeof data.type === "string" &&
          data.type === "consent_request"
        ) {
          window.location.href = "/consents?tab=pending";
        } else if (
          data &&
          typeof data.type === "string" &&
          data.type === "kai_analysis_complete"
        ) {
          window.location.href = "/kai/dashboard";
        } else {
          window.location.href = "/";
        }
      }
    );

    // Token refresh handler -- re-register with backend when FCM rotates the token
    FirebaseMessaging.addListener("tokenReceived", async (event) => {
      console.log("[FCM] Token refreshed:", event.token.substring(0, 20) + "...");
      const platform = Capacitor.getPlatform() as "ios" | "android" | "web";
      // Re-register silently; if it fails the next app launch will fix it
      try {
        const { getAuth } = await import("firebase/auth");
        const currentUser = getAuth().currentUser;
        if (currentUser) {
          const idToken = await currentUser.getIdToken();
          await ApiService.registerPushToken(
            currentUser.uid,
            event.token,
            platform,
            idToken
          );
          console.log("[FCM] Refreshed token re-registered with backend");
        }
      } catch (err) {
        console.warn("[FCM] Token refresh re-registration failed:", err);
      }
    });

    console.log("[FCM] Native listeners configured");
  });
}

/**
 * Get current FCM token (for debugging)
 */
export async function getFCMToken(): Promise<string | null> {
  const isNative = Capacitor.isNativePlatform();

  try {
    if (isNative) {
      const { FirebaseMessaging } = await import(
        "@capacitor-firebase/messaging"
      );
      const { token } = await FirebaseMessaging.getToken();
      return token;
    } else {
      const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
      if (!vapidKey) return null;

      const { getMessaging, getToken } = await import("firebase/messaging");
      const { app } = await import("@/lib/firebase/config");

      const messaging = getMessaging(app);
      const token = await getToken(messaging, { vapidKey });
      return token || null;
    }
  } catch (error) {
    console.error("[FCM] Failed to get token:", error);
    return null;
  }
}

/**
 * Delete FCM token (for logout).
 * 
 * Removes the token from Firebase and also calls the backend to unregister
 * so no further pushes are attempted for this device.
 */
export async function deleteFCMToken(
  userId?: string,
  idToken?: string
): Promise<void> {
  const isNative = Capacitor.isNativePlatform();

  try {
    // Step 1: Tell the backend to delete our push token
    if (userId && idToken) {
      try {
        await ApiService.unregisterPushToken(userId, idToken);
      } catch (backendErr) {
        console.warn("[FCM] Backend unregister failed (non-critical):", backendErr);
      }
    }

    // Step 2: Delete the token from Firebase SDK
    if (isNative) {
      const { FirebaseMessaging } = await import(
        "@capacitor-firebase/messaging"
      );
      await FirebaseMessaging.deleteToken();
    } else {
      const { getMessaging, deleteToken } = await import("firebase/messaging");
      const { app } = await import("@/lib/firebase/config");

      const messaging = getMessaging(app);
      await deleteToken(messaging);
    }

    console.log("[FCM] Token deleted (Firebase + backend)");
  } catch (error) {
    console.error("[FCM] Failed to delete token:", error);
  }
}
