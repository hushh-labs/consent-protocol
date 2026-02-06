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
import { ApiService } from "@/lib/services/api-service";
import { WorldModelService } from "@/lib/services/world-model-service";

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
// Helpers: Scope detection and vault data endpoint
// ============================================================================

/** world_model.read or attr.{domain}.* (domain: alphanumeric + underscore only) */
const WORLD_MODEL_READ = "world_model.read";
const ATTR_SCOPE_REGEX = /^attr\.([a-zA-Z0-9_]+)\.\*$/;

function isWorldModelScope(scope: string): boolean {
  return scope === WORLD_MODEL_READ || ATTR_SCOPE_REGEX.test(scope);
}

/** Parse attr.{domain}.* to domain, or null if not matching. */
function parseAttrScopeDomain(scope: string): string | null {
  const m = scope.match(ATTR_SCOPE_REGEX);
  return m?.[1] ?? null;
}

function getScopeDataEndpoint(scope: string): string | null {
  const scopeMap: Record<string, string> = {
    // Dynamic attr.* scopes (canonical - preferred)
    "attr.financial.*": "/api/vault/finance",
    // Legacy underscore format (deprecated)
    vault_read_finance: "/api/vault/finance",
    // Legacy dot format (deprecated)
    "vault.read.finance": "/api/vault/finance",
  };
  return scopeMap[scope] || null;
}

// ============================================================================
// Hook
// ============================================================================

export function useConsentActions(options: UseConsentActionsOptions = {}) {
  const { vaultKey, getVaultOwnerToken } = useVault();
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
        const vaultOwnerToken = getVaultOwnerToken();
        if (!vaultOwnerToken) {
          throw new Error("Vault owner token required");
        }

        let scopeData: Record<string, unknown> = {};

        // World model scopes: build export from world model blob (BYOK)
        if (isWorldModelScope(consent.scope)) {
          try {
            const metadata = await WorldModelService.getMetadata(userId, false, vaultOwnerToken);
            const availableDomains = metadata.domains.map((d) => d.key);

            if (consent.scope === WORLD_MODEL_READ) {
              if (availableDomains.length === 0) {
                scopeData = {};
                console.info("[Consent] Consent approved with empty world model export (no domains)");
              } else {
                const firstDomain = availableDomains[0];
                const blob = firstDomain
                  ? await WorldModelService.getDomainData(userId, firstDomain, vaultOwnerToken)
                  : null;
                if (!blob) {
                  scopeData = {};
                  console.info("[Consent] Consent approved with empty world model export (no data)");
                } else {
                  const { decryptData } = await import("@/lib/vault/encrypt");
                  const decrypted = await decryptData(
                    {
                      ciphertext: blob.ciphertext,
                      iv: blob.iv,
                      tag: blob.tag,
                      encoding: "base64",
                      algorithm: (blob.algorithm || "aes-256-gcm") as "aes-256-gcm",
                    },
                    vaultKey
                  );
                  const full = JSON.parse(decrypted) as Record<string, unknown>;
                  scopeData = {};
                  for (const key of availableDomains) {
                    if (Object.prototype.hasOwnProperty.call(full, key)) {
                      scopeData[key] = full[key];
                    }
                  }
                }
              }
            } else {
              const domain = parseAttrScopeDomain(consent.scope);
              if (!domain) {
                scopeData = {};
              } else {
                const blob = await WorldModelService.getDomainData(userId, domain, vaultOwnerToken);
                if (!blob) {
                  scopeData = { [domain]: {} };
                } else {
                  const { decryptData } = await import("@/lib/vault/encrypt");
                  const decrypted = await decryptData(
                    {
                      ciphertext: blob.ciphertext,
                      iv: blob.iv,
                      tag: blob.tag,
                      encoding: "base64",
                      algorithm: (blob.algorithm || "aes-256-gcm") as "aes-256-gcm",
                    },
                    vaultKey
                  );
                  const full = JSON.parse(decrypted) as Record<string, unknown>;
                  scopeData = { [domain]: full[domain] ?? {} };
                }
              }
            }
          } catch (err) {
            if (err instanceof SyntaxError) {
              console.error("[Consent] Failed to parse world model blob after decrypt");
              throw new Error("Could not prepare export; check vault.");
            }
            console.error("[Consent] World model export build failed:", err);
            throw new Error("Could not load your data; try again.");
          }
        }

        // Legacy vault/finance endpoint mapping
        const scopeDataEndpoint = getScopeDataEndpoint(consent.scope);
        if (scopeDataEndpoint && Object.keys(scopeData).length === 0) {
          // Identify which API method to call based on scope
          let dataResponse: Response | null = null;

          console.log("[NativeDebug] Fetching scope data for:", consent.scope);

          try {
            // Scope mapping to ApiService methods (food/professional removed; use world-model)
            if (consent.scope.includes("finance")) {
              // Legacy finance endpoint if needed
              console.warn("Finance scope: legacy endpoint not yet populated");
            }
          } catch (e: unknown) {
            console.error("[NativeDebug] ApiService.getData error:", e);
            // Proceed without data if fetch fails, but log it.
            // Are we throwing here? No, caught.
          }

          const response = dataResponse as Response | null;
          if (response?.ok) {
            console.log("[NativeDebug] Scope data fetched successfully");
            const data = await response.json();

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
            // On native, specific endpoints might not exist yet for all scopes.
            // We gracefully handle failure, but for 'Food' and 'Professional' it should work.
            console.warn(
              "[NativeDebug] Failed to fetch scope data or scope not supported:",
              consent.scope
            );
          }
        }

        if (Object.keys(scopeData).length === 0 && !isWorldModelScope(consent.scope) && !getScopeDataEndpoint(consent.scope)) {
          console.info("[Consent] Unknown scope, approving with empty export:", consent.scope);
        }

        console.log("[NativeDebug] Generating export key...");
        // Generate export key and encrypt
        const { generateExportKey, encryptForExport } = await import(
          "@/lib/vault/export-encrypt"
        );
        const exportKey = await generateExportKey();
        const encrypted = await encryptForExport(
          JSON.stringify(scopeData),
          exportKey
        );

        console.log("[NativeDebug] Submitting approval to backend...");
        // Send to server
        const response = await ApiService.approvePendingConsent({
          userId,
          requestId: consent.id,
          exportKey,
          encryptedData: encrypted.ciphertext,
          encryptedIv: encrypted.iv,
          encryptedTag: encrypted.tag,
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("[NativeDebug] Approval failed:", errorText);
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
        const response = await ApiService.denyPendingConsent({
          userId,
          requestId,
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
   * For VAULT_OWNER scope, this will also lock the vault
   */
  const handleRevoke = useCallback(
    async (scope: string): Promise<void> => {
      const userId = sessionStorage.getItem("user_id");

      if (!userId) return;

      const promise = (async () => {
        const vaultOwnerToken = getVaultOwnerToken();
        const response = await ApiService.revokeConsent({
          userId,
          scope,
          // Revoke is consent-gated; always include the VAULT_OWNER token explicitly.
          // (On native builds, relying on sessionStorage can be flaky across webview lifecycles.)
          token: vaultOwnerToken || "",
        });

        if (!response.ok) {
          throw new Error("Failed to revoke consent");
        }

        // Check if backend signals to lock vault (for VAULT_OWNER revocation)
        const data = await response.json();
        return data;
      })();

      toast.promise(promise, {
        loading: "Revoking consent...",
        success: () => `🔒 Consent revoked`,
        error: (err) => `❌ ${err.message}`,
        duration: 3000,
      });

      try {
        const result = await promise;
        
        // If VAULT_OWNER was revoked, lock the vault
        if (result.lockVault) {
          // Import lockVault dynamically to avoid circular deps
          const { removeSessionItem } = await import("@/lib/utils/session-storage");
          
          // Clear vault session flag
          removeSessionItem("vault_unlocked");
          
          // Dispatch event so VaultContext can react
          window.dispatchEvent(new CustomEvent("vault-lock-requested", {
            detail: { reason: "VAULT_OWNER token revoked" }
          }));
          
          toast.info("Vault locked", {
            description: "Your VAULT_OWNER access has been revoked. Please unlock again to continue.",
            duration: 5000,
          });
        }
        
        onActionComplete?.();
      } catch (err) {
        console.error("Error revoking consent:", err);
      }
    },
    [getVaultOwnerToken, onActionComplete]
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
