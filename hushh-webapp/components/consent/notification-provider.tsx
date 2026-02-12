"use client";

/**
 * Consent Notification Provider
 * =============================
 *
 * Shows toast notifications for pending consent requests.
 * Uses FCM for all platforms (web + native).
 *
 * Responsibilities:
 * - Initialize FCM when user logs in
 * - Poll for initial pending consents on mount
 * - Listen to FCM messages for real-time updates
 * - Show interactive toast with Approve/Deny buttons
 * - Coordinate toast lifecycle with action state
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { useVault } from "@/lib/vault/vault-context";
import { useConsentActions, type PendingConsent } from "@/lib/consent";
import { ApiService } from "@/lib/services/api-service";
import { useAuth } from "@/hooks/use-auth";
import { initializeFCM, FCM_MESSAGE_EVENT } from "@/lib/notifications";
import { Capacitor } from "@capacitor/core";

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

export function ConsentNotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const _router = useRouter();
  const { isVaultUnlocked } = useVault();
  const [_pendingCount, setPendingCount] = useState(0);
  const { user } = useAuth();
  const fcmInitializedRef = useRef(false);
  const fetchPendingRef = useRef<(userId: string) => void>(() => {});

  // Use the centralized consent actions hook
  const {
    handleApprove,
    handleDeny,
    shouldShowToast,
    shouldDismissToast: _shouldDismissToast,
    markAsPending,
    clearRequest: _clearRequest,
  } = useConsentActions({
    userId: user?.uid,
    onActionComplete: () => {
      // Refresh pending count after action
      if (user?.uid) fetchPendingAndShowToasts(user.uid);
    },
  });

  // Show interactive toast for a consent request
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

          // Show toast for new requests
          pending.forEach((consent) => {
            const show = shouldShowToast(consent.id);
            if (show) {
              markAsPending(consent.id);
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

  // Keep ref updated for FCM message handler
  useEffect(() => {
    fetchPendingRef.current = fetchPendingAndShowToasts;
  }, [fetchPendingAndShowToasts]);

  // Initialize FCM when user logs in
  useEffect(() => {
    if (!user || fcmInitializedRef.current) return;

    const uid = user.uid;
    if (!uid) return;

    fcmInitializedRef.current = true;

    user
      .getIdToken()
      .then((idToken) => {
        return initializeFCM(uid, idToken);
      })
      .catch((err) => {
        console.error("[NotificationProvider] FCM initialization failed:", err);
        fcmInitializedRef.current = false;
      });
  }, [user]);

  // Listen for FCM messages (both web and native dispatch this event)
  useEffect(() => {
    const handleFCMMessage = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log("📬 [NotificationProvider] FCM message received:", customEvent.detail);

      // Only refresh if vault is unlocked
      if (!isVaultUnlocked) {
        console.log("🔔 [NotificationProvider] Vault locked, skipping refresh");
        return;
      }

      const uid = user?.uid;
      if (uid) {
        fetchPendingRef.current(uid);
      }
    };

    window.addEventListener(FCM_MESSAGE_EVENT, handleFCMMessage);

    return () => {
      window.removeEventListener(FCM_MESSAGE_EVENT, handleFCMMessage);
    };
  }, [isVaultUnlocked, user?.uid]);

  // Poll for initial pending consents when vault unlocks
  useEffect(() => {
    if (!isVaultUnlocked) {
      console.log(
        "🔔 [NotificationProvider] Vault not unlocked, skipping fetch"
      );
      return;
    }

    const uid = user?.uid;
    if (!uid) {
      console.log(
        "🔔 [NotificationProvider] No user on mount, skipping fetch"
      );
      return;
    }

    console.log("🔔 [NotificationProvider] Polling for pending (vault unlocked)");
    fetchPendingAndShowToasts(uid);
  }, [isVaultUnlocked, user?.uid, fetchPendingAndShowToasts]);

  // Native fallback polling (iOS Simulator cannot receive APNs push).
  // Keep this light: refresh pending list periodically while vault is unlocked.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (!isVaultUnlocked) return;

    const uid = user?.uid;
    if (!uid) return;

    const intervalMs = 10_000;
    const id = window.setInterval(() => {
      fetchPendingRef.current(uid);
    }, intervalMs);

    return () => window.clearInterval(id);
  }, [isVaultUnlocked, user?.uid]);

  return <>{children}</>;
}

// ============================================================================
// Pending Count Hook (uses polling)
// ============================================================================

export function usePendingConsentCount() {
  const [count, setCount] = useState(0);
  const { isVaultUnlocked } = useVault();
  const { user } = useAuth();

  // Fetch count from API
  const fetchCount = useCallback(async () => {
    if (!isVaultUnlocked) return;

    const uid = user?.uid;
    if (!uid) return;

    try {
      const response = await ApiService.getPendingConsents(uid);
      if (!response.ok) return;
      const data = await response.json().catch(() => ({}));
      setCount(data.pending?.length || 0);
    } catch (err) {
      console.error("Error fetching pending count:", err);
    }
  }, [isVaultUnlocked, user?.uid]);

  // Initial fetch when vault unlocks
  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  // Refresh on FCM messages
  useEffect(() => {
    const handleFCMMessage = () => {
      if (isVaultUnlocked) {
        fetchCount();
      }
    };

    window.addEventListener(FCM_MESSAGE_EVENT, handleFCMMessage);

    return () => {
      window.removeEventListener(FCM_MESSAGE_EVENT, handleFCMMessage);
    };
  }, [isVaultUnlocked, fetchCount]);

  return count;
}
