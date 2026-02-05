/**
 * Consent push notification registration (web)
 *
 * - Requests notification permission
 * - Gets FCM token and registers with backend via ApiService
 * - Only runs on web (not native); native uses platform plugins.
 */

import { Capacitor } from "@capacitor/core";
import { ApiService } from "@/lib/services/api-service";

const VAPID_KEY = typeof window !== "undefined" ? process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY : undefined;

/**
 * Request notification permission. Returns true if granted.
 */
export async function requestConsentPushPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const permission = await Notification.requestPermission();
  return permission === "granted";
}

/**
 * Get FCM token for web (requires VAPID key in env).
 * Returns null on native, or if permission/messaging unavailable.
 */
export async function getFCMToken(): Promise<string | null> {
  if (typeof window === "undefined" || Capacitor.isNativePlatform()) return null;
  if (!VAPID_KEY) {
    console.warn("[register-push] NEXT_PUBLIC_FIREBASE_VAPID_KEY not set; skip FCM token");
    return null;
  }
  try {
    const { getMessaging, getToken } = await import("firebase/messaging");
    const { app } = await import("@/lib/firebase/config");
    const messaging = getMessaging(app);
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    return token ?? null;
  } catch (e) {
    console.warn("[register-push] FCM getToken failed:", e);
    return null;
  }
}

/**
 * Register consent push token with backend.
 * Call after login when user and idToken are available.
 * No-op on native or when permission/token unavailable.
 */
export async function registerConsentPushToken(
  userId: string,
  idToken: string
): Promise<void> {
  if (Capacitor.isNativePlatform()) return;
  const granted = await requestConsentPushPermission();
  if (!granted) return;
  const token = await getFCMToken();
  if (!token) return;
  try {
    const res = await ApiService.registerPushToken(userId, token, "web", idToken);
    if (!res.ok) {
      console.warn("[register-push] Backend register failed:", res.status);
    }
  } catch (e) {
    console.warn("[register-push] Register failed:", e);
  }
}
