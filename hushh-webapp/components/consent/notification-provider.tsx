"use client";

/**
 * Consent Notification Provider
 * =============================
 *
 * Shows toast notifications for pending consent requests.
 * Uses FCM for all platforms (web + native).
 *
 * Architecture (pure push -- zero polling):
 * - Initialize FCM when user logs in
 * - FCM push arrives → extract consent data from payload → show toast
 * - One-time fetch on vault unlock to catch requests that arrived while offline
 * - NO interval-based polling anywhere
 */

import { useEffect, useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { useVault } from "@/lib/vault/vault-context";
import { useConsentActions, type PendingConsent } from "@/lib/consent";
import { ApiService } from "@/lib/services/api-service";
import { useAuth } from "@/hooks/use-auth";
import { initializeFCM, FCM_MESSAGE_EVENT } from "@/lib/notifications";
import { getAuth } from "firebase/auth";

// ============================================================================
// Helpers
// ============================================================================

const formatScope = (scope: string): { label: string; emoji: string } => {
  const scopeMap: Record<string, { label: string; emoji: string }> = {
    vault_read_finance: { label: "Financial Data", emoji: "💰" },
    vault_read_all: { label: "All Data", emoji: "🔓" },
    "vault.read.finance": { label: "Financial Data", emoji: "💰" },
    "attr.financial.*": { label: "Financial Data", emoji: "💰" },
    "attr.food.*": { label: "Food Preferences", emoji: "🍕" },
    "attr.professional.*": { label: "Professional Profile", emoji: "💼" },
  };
  return scopeMap[scope] || { label: scope.replace(/_/g, " "), emoji: "📋" };
};

/**
 * Build a PendingConsent object from an FCM data payload.
 * The backend now includes scope, agent_id, and scope_description in the
 * FCM data message so the frontend can render the toast without fetching.
 */
function consentFromFCMPayload(
  data: Record<string, string>
): PendingConsent | null {
  const requestId = data.request_id;
  if (!requestId) return null;
  return {
    id: requestId,
    developer: data.agent_id || "Unknown Agent",
    scope: data.scope || "",
    scopeDescription: data.scope_description || undefined,
    requestedAt: Date.now(),
  };
}

// ============================================================================
// Main Provider
// ============================================================================

export function ConsentNotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isVaultUnlocked } = useVault();
  const [pendingCount, setPendingCount] = useState(0);
  const { user } = useAuth();
  const fcmInitializedRef = useRef(false);
  // Track which request IDs we've already toasted this session
  const toastedIdsRef = useRef(new Set<string>());

  // Use the centralized consent actions hook
  const { handleApprove, handleDeny } = useConsentActions({
    userId: user?.uid,
    onActionComplete: () => {
      // Decrement count optimistically after approve/deny
      setPendingCount((prev) => Math.max(0, prev - 1));
    },
  });

  // Show interactive toast for a consent request
  const showConsentToast = useCallback(
    (consent: PendingConsent) => {
      // De-duplicate: don't show the same toast twice in one session
      if (toastedIdsRef.current.has(consent.id)) return;
      toastedIdsRef.current.add(consent.id);

      const { label, emoji } = consent.scopeDescription
        ? { label: consent.scopeDescription, emoji: "📋" }
        : formatScope(consent.scope);

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

  // Initialize FCM when user logs in (stable dependency: user?.uid)
  useEffect(() => {
    if (fcmInitializedRef.current) return;

    const uid = user?.uid;
    if (!uid) return;

    fcmInitializedRef.current = true;

    // Get fresh currentUser inside the effect to avoid stale object reference
    const currentUser = getAuth().currentUser;
    if (!currentUser) {
      fcmInitializedRef.current = false;
      return;
    }

    currentUser
      .getIdToken()
      .then((idToken) => initializeFCM(uid, idToken))
      .catch((err) => {
        console.error("[NotificationProvider] FCM initialization failed:", err);
        fcmInitializedRef.current = false;
      });
  }, [user?.uid]);

  // Listen for FCM messages -- extract consent data directly from payload (no HTTP fetch)
  useEffect(() => {
    const handleFCMMessage = (event: Event) => {
      const customEvent = event as CustomEvent;
      const detail = customEvent.detail || {};

      // FCM web SDK puts data in detail.data, native in detail.notification.data or detail.data
      const data: Record<string, string> =
        detail.data || detail.notification?.data || {};

      const msgType = data.type;

      if (msgType === "consent_request") {
        // Only show toast if vault is unlocked (can't approve without vault key)
        if (!isVaultUnlocked) return;

        const consent = consentFromFCMPayload(data);
        if (consent) {
          setPendingCount((prev) => prev + 1);
          showConsentToast(consent);
        }
      } else if (msgType === "consent_resolved") {
        // A consent was resolved (approved/denied/revoked) -- dismiss any matching toast
        const requestId = data.request_id;
        if (requestId) {
          toast.dismiss(requestId);
          toastedIdsRef.current.delete(requestId);
          setPendingCount((prev) => Math.max(0, prev - 1));
        }
      }
    };

    window.addEventListener(FCM_MESSAGE_EVENT, handleFCMMessage);
    return () => window.removeEventListener(FCM_MESSAGE_EVENT, handleFCMMessage);
  }, [isVaultUnlocked, showConsentToast]);

  // ONE-TIME fetch on vault unlock to catch requests that arrived while app was closed.
  // This is the ONLY acceptable HTTP call -- not a poll, just a catch-up.
  useEffect(() => {
    if (!isVaultUnlocked) return;

    const uid = user?.uid;
    if (!uid) return;

    let cancelled = false;

    (async () => {
      try {
        const response = await ApiService.getPendingConsents(uid);
        if (cancelled) return;
        if (response.ok) {
          const json = await response.json().catch(() => ({}));
          const pending: PendingConsent[] = json.pending || [];
          setPendingCount(pending.length);

          // Show toasts for any that we haven't seen yet
          pending.forEach((consent) => showConsentToast(consent));
        }
      } catch (err) {
        console.error("[NotificationProvider] Initial fetch error:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isVaultUnlocked, user?.uid, showConsentToast]);

  return <>{children}</>;
}

// ============================================================================
// Pending Count Hook (pure push -- no polling)
// ============================================================================

/**
 * Returns the number of pending consent requests.
 * Count is maintained via FCM push events and the one-time initial fetch.
 * NO interval-based polling.
 */
export function usePendingConsentCount() {
  const [count, setCount] = useState(0);
  const { isVaultUnlocked } = useVault();
  const { user } = useAuth();

  // One-time fetch on vault unlock
  useEffect(() => {
    if (!isVaultUnlocked) return;
    const uid = user?.uid;
    if (!uid) return;

    let cancelled = false;

    (async () => {
      try {
        const response = await ApiService.getPendingConsents(uid);
        if (cancelled) return;
        if (response.ok) {
          const data = await response.json().catch(() => ({}));
          setCount(data.pending?.length || 0);
        }
      } catch (_err) {
        // Silently ignore -- not critical for badge
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isVaultUnlocked, user?.uid]);

  // Adjust count on FCM events
  useEffect(() => {
    const handler = (event: Event) => {
      const data: Record<string, string> =
        (event as CustomEvent).detail?.data ||
        (event as CustomEvent).detail?.notification?.data ||
        {};

      if (data.type === "consent_request") {
        setCount((prev) => prev + 1);
      } else if (data.type === "consent_resolved") {
        setCount((prev) => Math.max(0, prev - 1));
      }
    };

    window.addEventListener(FCM_MESSAGE_EVENT, handler);
    return () => window.removeEventListener(FCM_MESSAGE_EVENT, handler);
  }, []);

  return count;
}
