"use client";

/**
 * Consent Actions Hook - Centralized Approve/Deny/Revoke Logic
 * =============================================================
 *
 * Provides a unified interface for consent actions that:
 * - Coordinates with seenRequestIds state to prevent toast re-showing
 * - Uses toast.promise for loading → success/error transitions
 * - Triggers data refresh after action completion
 */

import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { useVault } from "@/lib/vault/vault-context";

// ============================================================================
// Types
// ============================================================================

export interface PendingConsent {
  id: string;
  developer: string;
  scope: string;
  scopeDescription?: string;
  requestedAt: number;
  expiryHours?: number;
}

type RequestStatus = "pending" | "handling" | "handled";

interface UseConsentActionsOptions {
  /** Called after approve/deny/revoke completes successfully */
  onActionComplete?: () => void;
}

// ============================================================================
// Helper: Map scope to vault data endpoint
// ============================================================================

function getScopeDataEndpoint(scope: string): string | null {
  const scopeMap: Record<string, string> = {
    // Underscore format
    vault_read_food: "/api/vault/food",
    vault_read_professional: "/api/vault/professional",
    vault_read_finance: "/api/vault/finance",
    // Dot format (MCP standard)
    "vault.read.food": "/api/vault/food",
    "vault.read.professional": "/api/vault/professional",
    "vault.read.finance": "/api/vault/finance",
  };
  return scopeMap[scope] || null;
}

// ============================================================================
// Hook
// ============================================================================

export function useConsentActions(options: UseConsentActionsOptions = {}) {
  const { vaultKey } = useVault();
  const { onActionComplete } = options;

  // Track request status: ID -> "pending" | "handling" | "handled"
  // Using ref to persist across renders without causing re-renders
  const requestStatusMap = useRef<Map<string, RequestStatus>>(new Map());

  /**
   * Get current status of a request
   */
  const getRequestStatus = useCallback(
    (requestId: string): RequestStatus | undefined => {
      return requestStatusMap.current.get(requestId);
    },
    []
  );

  /**
   * Mark a request as being handled (blocks toast re-showing)
   */
  const markAsHandling = useCallback((requestId: string) => {
    requestStatusMap.current.set(requestId, "handling");
  }, []);

  /**
   * Mark a request as fully handled (can be cleaned up)
   */
  const markAsHandled = useCallback((requestId: string) => {
    requestStatusMap.current.set(requestId, "handled");
  }, []);

  /**
   * Mark a request as pending (shown but not actioned)
   */
  const markAsPending = useCallback((requestId: string) => {
    requestStatusMap.current.set(requestId, "pending");
  }, []);

  /**
   * Remove tracking for a request
   */
  const clearRequest = useCallback((requestId: string) => {
    requestStatusMap.current.delete(requestId);
  }, []);

  /**
   * Check if we should show a toast for this request
   */
  const shouldShowToast = useCallback((requestId: string): boolean => {
    const status = requestStatusMap.current.get(requestId);
    // Show only if not tracked yet
    return !status;
  }, []);

  /**
   * Check if we should dismiss a toast for this request
   * (Only dismiss if still "pending", not if "handling" or "handled")
   */
  const shouldDismissToast = useCallback((requestId: string): boolean => {
    const status = requestStatusMap.current.get(requestId);
    return status === "pending";
  }, []);

  /**
   * Approve a consent request with zero-knowledge export
   */
  const handleApprove = useCallback(
    async (consent: PendingConsent): Promise<void> => {
      const userId = sessionStorage.getItem("user_id");
      const toastId = consent.id;

      // Mark as handling immediately to block re-showing
      markAsHandling(consent.id);

      if (!userId || !vaultKey) {
        toast.error("Vault not unlocked", {
          id: toastId,
          description: "Please unlock your vault to approve this request.",
          duration: 3000,
        });
        // Reset to pending if not unlocked
        markAsPending(consent.id);
        return;
      }

      const promise = (async () => {
        // Fetch the scope data from vault
        const scopeDataEndpoint = getScopeDataEndpoint(consent.scope);
        let scopeData: Record<string, unknown> = {};

        if (scopeDataEndpoint) {
          const dataResponse = await fetch(
            `${scopeDataEndpoint}?userId=${userId}`
          );

          if (dataResponse.ok) {
            const data = await dataResponse.json();

            // Decrypt the data with vault key
            const { decryptData } = await import("@/lib/vault/encrypt");
            const decryptedFields: Record<string, unknown> = {};

            // Handle object format
            const preferences = data.preferences || data.data || {};

            if (
              preferences &&
              typeof preferences === "object" &&
              !Array.isArray(preferences)
            ) {
              for (const [fieldName, encryptedField] of Object.entries(
                preferences
              )) {
                try {
                  const field = encryptedField as {
                    ciphertext: string;
                    iv: string;
                    tag: string;
                    algorithm?: string;
                    encoding?: string;
                  };
                  const decrypted = await decryptData(
                    {
                      ciphertext: field.ciphertext,
                      iv: field.iv,
                      tag: field.tag,
                      encoding: (field.encoding || "base64") as "base64",
                      algorithm: (field.algorithm ||
                        "aes-256-gcm") as "aes-256-gcm",
                    },
                    vaultKey
                  );
                  decryptedFields[fieldName] = JSON.parse(decrypted);
                } catch (err) {
                  console.warn(`Failed to decrypt field: ${fieldName}`, err);
                }
              }
            } else if (Array.isArray(preferences)) {
              // Array format (legacy)
              for (const field of preferences) {
                try {
                  const decrypted = await decryptData(
                    {
                      ciphertext: field.ciphertext,
                      iv: field.iv,
                      tag: field.tag,
                      encoding: "base64",
                      algorithm: "aes-256-gcm",
                    },
                    vaultKey
                  );
                  decryptedFields[field.field_name] = JSON.parse(decrypted);
                } catch {
                  console.warn(`Failed to decrypt field: ${field.field_name}`);
                }
              }
            }

            scopeData = decryptedFields;
          } else {
            throw new Error("Failed to fetch data from vault");
          }
        }

        // Generate export key and encrypt
        const { generateExportKey, encryptForExport } = await import(
          "@/lib/vault/export-encrypt"
        );
        const exportKey = await generateExportKey();
        const encrypted = await encryptForExport(
          JSON.stringify(scopeData),
          exportKey
        );

        // Send to server
        const response = await fetch("/api/consent/pending/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            requestId: consent.id,
            exportKey,
            encryptedData: encrypted.ciphertext,
            encryptedIv: encrypted.iv,
            encryptedTag: encrypted.tag,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || "Failed to approve");
        }

        return "Consent approved!";
      })();

      toast.promise(promise, {
        id: toastId,
        loading: "Approving consent...",
        success: (data) => `✅ ${data}`,
        error: (err) => `❌ ${err.message}`,
        duration: 3000,
      });

      try {
        await promise;
        markAsHandled(consent.id);
        onActionComplete?.();

        // Dispatch custom event so consents page can refresh tables
        window.dispatchEvent(
          new CustomEvent("consent-action-complete", {
            detail: { action: "approve", requestId: consent.id },
          })
        );
      } catch (err) {
        console.error("Error approving consent:", err);
        markAsPending(consent.id);
      }
    },
    [vaultKey, markAsHandling, markAsHandled, markAsPending, onActionComplete]
  );

  /**
   * Deny a consent request
   */
  const handleDeny = useCallback(
    async (requestId: string): Promise<void> => {
      const userId = sessionStorage.getItem("user_id");
      const toastId = requestId;

      if (!userId) return;

      // Mark as handling immediately
      markAsHandling(requestId);

      const promise = (async () => {
        const response = await fetch("/api/consent/pending/deny", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, requestId }),
        });

        if (!response.ok) {
          throw new Error("Failed to deny consent");
        }

        return "Consent denied";
      })();

      toast.promise(promise, {
        id: toastId,
        loading: "Denying consent...",
        success: (data) => `❌ ${data}`,
        error: (err) => `❌ ${err.message}`,
        duration: 3000,
      });

      try {
        await promise;
        markAsHandled(requestId);
        onActionComplete?.();

        // Dispatch custom event so consents page can refresh tables
        window.dispatchEvent(
          new CustomEvent("consent-action-complete", {
            detail: { action: "deny", requestId },
          })
        );
      } catch (err) {
        console.error("Error denying consent:", err);
        markAsPending(requestId);
      }
    },
    [markAsHandling, markAsHandled, markAsPending, onActionComplete]
  );

  /**
   * Revoke an active consent
   */
  const handleRevoke = useCallback(
    async (scope: string): Promise<void> => {
      const userId = sessionStorage.getItem("user_id");

      if (!userId) return;

      const promise = (async () => {
        const response = await fetch("/api/consent/revoke", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, scope }),
        });

        if (!response.ok) {
          throw new Error("Failed to revoke consent");
        }

        return "Consent revoked";
      })();

      toast.promise(promise, {
        loading: "Revoking consent...",
        success: (data) => `🔒 ${data}`,
        error: (err) => `❌ ${err.message}`,
        duration: 3000,
      });

      try {
        await promise;
        onActionComplete?.();
      } catch (err) {
        console.error("Error revoking consent:", err);
      }
    },
    [onActionComplete]
  );

  return {
    // Actions
    handleApprove,
    handleDeny,
    handleRevoke,

    // Status management
    getRequestStatus,
    markAsPending,
    markAsHandling,
    markAsHandled,
    clearRequest,
    shouldShowToast,
    shouldDismissToast,
  };
}
