"use client";

/**
 * Consent Notification Provider
 *
 * Polls for pending consent requests and shows toast notifications
 * with approve/reject actions. Positioned at center-top.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { toast, Toaster } from "sonner";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { useVault } from "@/lib/vault/vault-context";

interface PendingConsent {
  id: string;
  developer: string;
  scope: string;
  scopeDescription?: string;
  requestedAt: number;
}

// Format scope to human readable
const formatScope = (scope: string): { label: string; emoji: string } => {
  const scopeMap: Record<string, { label: string; emoji: string }> = {
    vault_read_food: { label: "Food Preferences", emoji: "🍽️" },
    vault_read_professional: { label: "Professional Profile", emoji: "💼" },
    vault_read_finance: { label: "Financial Data", emoji: "💰" },
    vault_read_all: { label: "All Data", emoji: "🔓" },
  };
  return scopeMap[scope] || { label: scope.replace(/_/g, " "), emoji: "📋" };
};

export function ConsentNotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { vaultKey, isVaultUnlocked } = useVault();
  const [pendingCount, setPendingCount] = useState(0);
  const seenRequestIds = useRef<Set<string>>(new Set());

  const handleApprove = useCallback(async (requestId: string) => {
    const userId = sessionStorage.getItem("user_id");
    if (!userId) return;

    try {
      const response = await fetch("/api/consent/pending/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, requestId }),
      });

      if (response.ok) {
        toast.success("Consent approved!", {
          description: "The application can now access your data.",
          icon: <Check className="h-4 w-4 text-emerald-500" />,
        });
      } else {
        toast.error("Failed to approve consent");
      }
    } catch (err) {
      console.error("Error approving consent:", err);
      toast.error("Network error");
    }
  }, []);

  const handleDeny = useCallback(async (requestId: string) => {
    const userId = sessionStorage.getItem("user_id");
    if (!userId) return;

    try {
      const response = await fetch("/api/consent/pending/deny", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, requestId }),
      });

      if (response.ok) {
        toast.info("Consent denied", {
          description: "The request has been rejected.",
          icon: <X className="h-4 w-4 text-red-500" />,
        });
      } else {
        toast.error("Failed to deny consent");
      }
    } catch (err) {
      console.error("Error denying consent:", err);
    }
  }, []);

  // Map scope to data endpoint
  const getScopeDataEndpoint = (scope: string): string | null => {
    const scopeMap: Record<string, string> = {
      vault_read_food: "/api/vault/food",
      vault_read_professional: "/api/vault/professional",
      vault_read_finance: "/api/vault/finance",
    };
    return scopeMap[scope] || null;
  };

  const handleApproveWithExport = useCallback(
    async (consent: PendingConsent) => {
      const userId = sessionStorage.getItem("user_id");

      // Use vault key from React context (memory-only, XSS-safe)
      if (!userId || !vaultKey) {
        toast.error("Vault not unlocked", {
          description: "Please unlock your vault to approve this request.",
        });
        return;
      }

      try {
        // Fetch the scope data from vault
        const scopeDataEndpoint = getScopeDataEndpoint(consent.scope);
        let scopeData: Record<string, unknown> = {};

        if (scopeDataEndpoint) {
          console.log(`[Consent] Fetching data from: ${scopeDataEndpoint}`);
          const dataResponse = await fetch(
            `${scopeDataEndpoint}?userId=${userId}`
          );
          if (dataResponse.ok) {
            const data = await dataResponse.json();
            console.log("[Consent] Vault response:", Object.keys(data));

            // Decrypt the data with vault key
            const { decryptData } = await import("@/lib/vault/encrypt");
            const decryptedFields: Record<string, unknown> = {};

            // Handle object format: { field_name: { ciphertext, iv, tag, algorithm, encoding } }
            const preferences = data.preferences || data.data || {};

            if (
              preferences &&
              typeof preferences === "object" &&
              !Array.isArray(preferences)
            ) {
              // Object format (actual vault data)
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
            console.log("[Consent] Decrypted fields:", Object.keys(scopeData));
          } else {
            console.error(
              "[Consent] Failed to fetch scope data:",
              dataResponse.status
            );
            toast.error("Failed to fetch data", {
              description: "Could not retrieve your vault data.",
            });
            return;
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

        console.log("[Consent] Sending approval to server...");

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

        if (response.ok) {
          console.log("[Consent] ✅ Consent approved successfully");
          toast.success("Consent approved!", {
            description: "The application can now access your data securely.",
            icon: <Check className="h-4 w-4 text-emerald-500" />,
          });
        } else {
          const errorText = await response.text();
          console.error("[Consent] Failed to approve:", errorText);
          toast.error("Failed to approve consent", {
            description: errorText || "Server error occurred",
          });
        }
      } catch (err) {
        console.error("[Consent] Error approving consent:", err);
        toast.error("Network error", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
      }
    },
    [vaultKey] // Add vaultKey dependency
  );

  const showConsentToast = useCallback(
    (consent: PendingConsent) => {
      const { label, emoji } = formatScope(consent.scope);

      toast(
        <div className="flex flex-col gap-3">
          {/* Simple header with scope */}
          <div className="flex items-center gap-2">
            <span className="text-lg">{emoji}</span>
            <div>
              <p className="font-semibold text-sm">{consent.developer}</p>
              <p className="text-xs text-muted-foreground">
                Wants access to your {label}
              </p>
            </div>
          </div>

          {/* Action buttons - centered */}
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => {
                handleApproveWithExport(consent);
                toast.dismiss(consent.id);
              }}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors"
            >
              <Check className="h-4 w-4" /> Approve
            </button>
            <button
              onClick={() => {
                handleDeny(consent.id);
                toast.dismiss(consent.id);
              }}
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
    [handleApproveWithExport, handleDeny]
  );

  // Poll for pending consents
  useEffect(() => {
    const checkPendingConsents = async () => {
      const userId = sessionStorage.getItem("user_id");
      if (!userId) return;

      try {
        const response = await fetch(`/api/consent/pending?userId=${userId}`);
        if (response.ok) {
          const data = await response.json();
          const pending: PendingConsent[] = data.pending || [];

          setPendingCount(pending.length);

          // Show toast for NEW requests only
          pending.forEach((consent) => {
            if (!seenRequestIds.current.has(consent.id)) {
              seenRequestIds.current.add(consent.id);
              showConsentToast(consent);
            }
          });

          // Remove dismissed IDs that are no longer pending
          const currentIds = new Set(pending.map((p) => p.id));
          seenRequestIds.current.forEach((id) => {
            if (!currentIds.has(id)) {
              seenRequestIds.current.delete(id);
            }
          });
        }
      } catch (err) {
        console.error("Error polling consents:", err);
      }
    };

    // Initial check
    checkPendingConsents();

    // Poll every 5 seconds
    const interval = setInterval(checkPendingConsents, 5000);

    return () => clearInterval(interval);
  }, [showConsentToast]);

  return (
    <>
      <Toaster
        position="top-center"
        richColors
        closeButton
        theme="system"
        toastOptions={{
          style: {
            padding: "16px",
          },
        }}
      />
      {children}
    </>
  );
}

// Export pending count for badge usage
export function usePendingConsentCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const checkCount = async () => {
      const userId = sessionStorage.getItem("user_id");
      if (!userId) return;

      try {
        const response = await fetch(`/api/consent/pending?userId=${userId}`);
        if (response.ok) {
          const data = await response.json();
          setCount(data.pending?.length || 0);
        }
      } catch (err) {
        console.error("Error fetching pending count:", err);
      }
    };

    checkCount();
    const interval = setInterval(checkCount, 5000);
    return () => clearInterval(interval);
  }, []);

  return count;
}
