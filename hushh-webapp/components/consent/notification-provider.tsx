"use client";

/**
 * Consent Notification Provider
 * =============================
 *
 * Shows toast notifications for pending consent requests.
 * Uses unified SSE context (no more duplicate connections).
 *
 * Responsibilities:
 * - Register FCM push token with backend (web; when user is logged in)
 * - Handle foreground FCM messages (onMessage) → refresh pending / show toasts
 * - Poll for initial pending consents on mount
 * - Subscribe to SSE events for new requests
 * - Show interactive toast with Approve/Deny buttons
 * - Coordinate toast lifecycle with action state
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { useVault } from "@/lib/vault/vault-context";
import {
  useConsentSSE,
  useConsentActions,
  type PendingConsent,
} from "@/lib/consent";
import { ApiService } from "@/lib/services/api-service";
import { useAuth } from "@/hooks/use-auth";
import { registerConsentPushToken } from "@/lib/notifications";

// ============================================================================
// Helpers
// ============================================================================

const formatScope = (scope: string): { label: string; emoji: string } => {
  const scopeMap: Record<string, { label: string; emoji: string }> = {
    vault_read_finance: { label: "Financial Data", emoji: "💰" },
    vault_read_all: { label: "All Data", emoji: "🔓" },
    "vault.read.finance": { label: "Financial Data", emoji: "💰" },
  };
  return scopeMap[scope] || { label: scope.replace(/_/g, " "), emoji: "📋" };
};

// ============================================================================
// Main Provider
// ============================================================================

/** Custom event dispatched when a consent push is received (e.g. FCM onMessage) */
export const CONSENT_PUSH_MESSAGE_EVENT = "consent-push-message";

export function ConsentNotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isVaultUnlocked } = useVault();
  const { lastEvent, eventCount, isConnected } = useConsentSSE();
  const [pendingCount, setPendingCount] = useState(0);
  const { user } = useAuth();
  const pushRegisteredRef = useRef(false);
  const fetchPendingRef = useRef<(userId: string) => void>(() => {});
  const sseDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const SSE_DEBOUNCE_MS = 600;

  // Use the centralized consent actions hook
  const {
    handleApprove,
    handleDeny,
    shouldShowToast,
    shouldDismissToast,
    markAsPending,
    clearRequest,
  } = useConsentActions({
    onActionComplete: () => {
      // Refresh pending count after action
      const userId = sessionStorage.getItem("user_id");
      if (userId) fetchPendingAndShowToasts(userId);
    },
  });

  // Show interactive toast for a consent request
  // MUST be defined before fetchPendingAndShowToasts
  const showConsentToast = useCallback(
    (consent: PendingConsent) => {
      const { label, emoji } = formatScope(consent.scope);

      console.log(
        `🔔 [NotificationProvider] Showing toast for consent ${consent.id}`
      );

      toast(
        <div className="flex flex-col gap-3">
          {/* Header with scope */}
          <div className="flex items-center gap-2">
            <span className="text-lg">{emoji}</span>
            <div>
              <p className="font-semibold text-sm">{consent.developer}</p>
              <p className="text-xs text-muted-foreground">
                Wants access to your {label}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => handleApprove(consent)}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors"
            >
              <Check className="h-4 w-4" /> Approve
            </button>
            <button
              onClick={() => handleDeny(consent.id)}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
            >
              <X className="h-4 w-4" /> Deny
            </button>
          </div>
        </div>,
        {
          id: consent.id,
          duration: Infinity,
          position: "top-center",
        }
      );
    },
    [handleApprove, handleDeny]
  );

  // Fetch pending consents and show toasts for new ones
  const fetchPendingAndShowToasts = useCallback(
    async (userId: string) => {
      console.log(
        `🔔 [NotificationProvider] Fetching pending consents for ${userId}`
      );

      try {
        const response = await ApiService.getPendingConsents(userId);
        if (response.ok) {
          const data = await response.json().catch(() => ({}));
          const pending: PendingConsent[] = data.pending || [];
          console.log(
            `🔔 [NotificationProvider] Found ${pending.length} pending consents`
          );
          setPendingCount(pending.length);

          // Show toast for requests: new ones OR ones already marked as pending (to replace fallback toast)
          pending.forEach((consent) => {
            const show = shouldShowToast(consent.id);
            const isAlreadyPending = !show; // If shouldShow is false, request is already tracked
            console.log(
              `🔔 [NotificationProvider] Consent ${consent.id}: shouldShow=${show}, isAlreadyPending=${isAlreadyPending}`
            );
            if (show) {
              markAsPending(consent.id);
              showConsentToast(consent);
            } else if (isAlreadyPending) {
              // Request was marked as pending (e.g., from REQUESTED SSE event while vault locked)
              // Show full toast to replace any fallback toast
              showConsentToast(consent);
            }
          });
        } else {
          console.error(
            "🔔 [NotificationProvider] Failed to fetch pending:",
            response.status
          );
        }
      } catch (err) {
        console.error("Error fetching pending consents:", err);
      }
    },
    [shouldShowToast, markAsPending, showConsentToast]
  );

  // Keep ref updated for push message handler
  fetchPendingRef.current = fetchPendingAndShowToasts;

  // Register FCM push token with backend when user is logged in (web only)
  useEffect(() => {
    if (!user) return;
    const userId = sessionStorage.getItem("user_id");
    if (!userId || pushRegisteredRef.current) return;
    let cancelled = false;
    pushRegisteredRef.current = true;
    user
      .getIdToken()
      .then((idToken) => {
        if (!cancelled) return registerConsentPushToken(userId, idToken);
        return undefined;
      })
      .catch((err) => {
        console.warn("[NotificationProvider] Push registration failed:", err);
        pushRegisteredRef.current = false;
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Foreground FCM: onMessage → dispatch event so we refresh pending (and show toasts if vault unlocked)
  useEffect(() => {
    if (typeof window === "undefined") return;
    let unsubscribe: (() => void) | undefined;
    import("firebase/messaging")
      .then((mod) =>
        import("@/lib/firebase/config").then(({ app }) => {
          const messaging = mod.getMessaging(app);
          return mod.onMessage(messaging, () => {
            window.dispatchEvent(new CustomEvent(CONSENT_PUSH_MESSAGE_EVENT));
          });
        })
      )
      .then((unsub) => {
        unsubscribe = unsub;
      })
      .catch(() => {
        // No FCM (e.g. native, or vapid not set) – ignore
      });
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []);

  // React to consent push message (foreground): refresh pending list
  useEffect(() => {
    const handler = () => {
      if (!isVaultUnlocked) return;
      const userId = sessionStorage.getItem("user_id");
      if (userId) fetchPendingRef.current(userId);
    };
    window.addEventListener(CONSENT_PUSH_MESSAGE_EVENT, handler);
    return () => window.removeEventListener(CONSENT_PUSH_MESSAGE_EVENT, handler);
  }, [isVaultUnlocked]);

  // Initial fetch on mount - only if vault is unlocked
  // Also fetch when vault unlocks (to show full toasts for any REQUESTED events that arrived while locked)
  useEffect(() => {
    // Don't fetch if vault is not unlocked (no vault owner token)
    if (!isVaultUnlocked) {
      console.log(
        "🔔 [NotificationProvider] Vault not unlocked, skipping fetch"
      );
      return;
    }

    const userId = sessionStorage.getItem("user_id");
    if (!userId) {
      console.log(
        "🔔 [NotificationProvider] No user_id on mount, skipping fetch"
      );
      return;
    }
    console.log("🔔 [NotificationProvider] Fetching pending (vault unlocked)");
    fetchPendingAndShowToasts(userId);
  }, [isVaultUnlocked, fetchPendingAndShowToasts]);

  // React to SSE events (debounce fetchPendingAndShowToasts to avoid burst API calls)
  useEffect(() => {
    if (!lastEvent) return;

    const userId = sessionStorage.getItem("user_id");
    if (!userId) return;

    const { request_id, action } = lastEvent;

    console.log(
      `📡 [NotificationProvider] SSE event: ${action} for ${request_id}`
    );

    const scheduleFetch = () => {
      if (sseDebounceRef.current) clearTimeout(sseDebounceRef.current);
      sseDebounceRef.current = setTimeout(() => {
        sseDebounceRef.current = null;
        if (isVaultUnlocked) fetchPendingAndShowToasts(userId);
      }, SSE_DEBOUNCE_MS);
    };

    if (action === "REQUESTED") {
      // Mark as pending so full toast shows when vault unlocks
      markAsPending(request_id);
      
      if (isVaultUnlocked) {
        // Vault unlocked: fetch immediately to show full toast with Approve/Deny
        // (debounce is handled inside fetchPendingAndShowToasts via scheduleFetch)
        fetchPendingAndShowToasts(userId);
      } else {
        // Vault locked: show fallback toast, schedule fetch for when vault unlocks
        toast(
          <div className="flex flex-col gap-3">
            <p className="font-semibold text-sm">New consent request</p>
            <p className="text-xs text-muted-foreground">
              Unlock your vault to review and respond.
            </p>
            <button
              type="button"
              onClick={() => {
                router.push("/consents?tab=pending");
                toast.dismiss(request_id);
              }}
              className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
            >
              Review
            </button>
          </div>,
          { id: request_id, duration: Infinity, position: "top-center" }
        );
        // Schedule fetch for when vault unlocks (will show full toast then)
        scheduleFetch();
      }
      return () => {
        if (sseDebounceRef.current) clearTimeout(sseDebounceRef.current);
      };
    }

    if (!isVaultUnlocked) return;

    if (action === "CONSENT_GRANTED" || action === "CONSENT_DENIED") {
      // Request resolved - dismiss toast only if still pending (not being processed)
      if (shouldDismissToast(request_id)) {
        toast.dismiss(request_id);
      }
      clearRequest(request_id);
      scheduleFetch();
    } else if (action === "REVOKED") {
      scheduleFetch();
    } else if (action === "TIMEOUT") {
      // Request expired (optional timeout job)
      if (shouldDismissToast(request_id)) toast.dismiss(request_id);
      clearRequest(request_id);
      scheduleFetch();
    }

    return () => {
      if (sseDebounceRef.current) clearTimeout(sseDebounceRef.current);
    };
  }, [
    lastEvent,
    eventCount,
    isVaultUnlocked,
    shouldDismissToast,
    clearRequest,
    fetchPendingAndShowToasts,
    router,
  ]);

  // Log SSE connection status
  useEffect(() => {
    console.log(`🔔 [NotificationProvider] SSE connected: ${isConnected}`);
  }, [isConnected]);

  return <>{children}</>;
}

// ============================================================================
// Pending Count Hook (uses unified SSE)
// ============================================================================

export function usePendingConsentCount() {
  const [count, setCount] = useState(0);
  const { lastEvent, eventCount } = useConsentSSE();
  const { isVaultUnlocked } = useVault();

  // Fetch count from API - only if vault is unlocked
  const fetchCount = useCallback(async () => {
    if (!isVaultUnlocked) return;

    const userId = sessionStorage.getItem("user_id");
    if (!userId) return;

    try {
      const response = await ApiService.getPendingConsents(userId);
      if (!response.ok) return;
      const data = await response.json().catch(() => ({}));
      setCount(data.pending?.length || 0);
    } catch (err) {
      console.error("Error fetching pending count:", err);
    }
  }, [isVaultUnlocked]);

  // Initial fetch when vault unlocks
  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  // Refresh on SSE events that affect pending count (avoid refetch on every event)
  const actionsAffectingCount = ["REQUESTED", "CONSENT_GRANTED", "CONSENT_DENIED", "REVOKED", "TIMEOUT"];
  useEffect(() => {
    if (lastEvent && isVaultUnlocked && actionsAffectingCount.includes(lastEvent.action)) {
      fetchCount();
    }
  }, [lastEvent, eventCount, isVaultUnlocked, fetchCount]);

  return count;
}
