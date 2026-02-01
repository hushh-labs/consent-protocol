"use client";

/**
 * Consent Notification Provider
 * =============================
 *
 * Shows toast notifications for pending consent requests.
 * Uses unified SSE context (no more duplicate connections).
 *
 * Responsibilities:
 * - Poll for initial pending consents on mount
 * - Subscribe to SSE events for new requests
 * - Show interactive toast with Approve/Deny buttons
 * - Coordinate toast lifecycle with action state
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { useVault } from "@/lib/vault/vault-context";
import {
  useConsentSSE,
  useConsentActions,
  type PendingConsent,
} from "@/lib/consent";
import { ApiService } from "@/lib/services/api-service";

// ============================================================================
// Helpers
// ============================================================================

const formatScope = (scope: string): { label: string; emoji: string } => {
  const scopeMap: Record<string, { label: string; emoji: string }> = {
    vault_read_food: { label: "Food Preferences", emoji: "🍽️" },
    vault_read_professional: { label: "Professional Profile", emoji: "💼" },
    vault_read_finance: { label: "Financial Data", emoji: "💰" },
    vault_read_all: { label: "All Data", emoji: "🔓" },
    "vault.read.food": { label: "Food Preferences", emoji: "🍽️" },
    "vault.read.professional": { label: "Professional Profile", emoji: "💼" },
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
  const { isVaultUnlocked } = useVault();
  const { lastEvent, eventCount, isConnected } = useConsentSSE();
  const [pendingCount, setPendingCount] = useState(0);

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

          // Show toast for NEW requests only
          pending.forEach((consent) => {
            const show = shouldShowToast(consent.id);
            console.log(
              `🔔 [NotificationProvider] Consent ${consent.id}: shouldShow=${show}`
            );
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

  // Initial fetch on mount - only if vault is unlocked
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
    console.log("🔔 [NotificationProvider] Initial fetch on mount");
    fetchPendingAndShowToasts(userId);
  }, [isVaultUnlocked, fetchPendingAndShowToasts]);

  // React to SSE events - only if vault is unlocked
  useEffect(() => {
    if (!lastEvent) return;
    if (!isVaultUnlocked) return;

    const userId = sessionStorage.getItem("user_id");
    if (!userId) return;

    const { request_id, action } = lastEvent;

    console.log(
      `📡 [NotificationProvider] SSE event: ${action} for ${request_id}`
    );

    if (action === "REQUESTED") {
      // New request - refresh to show toast
      fetchPendingAndShowToasts(userId);
    } else if (action === "CONSENT_GRANTED" || action === "CONSENT_DENIED") {
      // Request resolved - dismiss toast only if still pending (not being processed)
      if (shouldDismissToast(request_id)) {
        toast.dismiss(request_id);
      }
      clearRequest(request_id);

      // Refresh pending count
      fetchPendingAndShowToasts(userId);
    } else if (action === "REVOKED") {
      // Refresh counts
      fetchPendingAndShowToasts(userId);
    }
  }, [
    lastEvent,
    eventCount,
    isVaultUnlocked,
    shouldDismissToast,
    clearRequest,
    fetchPendingAndShowToasts,
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

  // Refresh on SSE events
  useEffect(() => {
    if (lastEvent && isVaultUnlocked) {
      fetchCount();
    }
  }, [lastEvent, eventCount, isVaultUnlocked, fetchCount]);

  return count;
}
