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
import { Check, X, Shield, AlertCircle } from "lucide-react";

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

  const showConsentToast = useCallback(
    (consent: PendingConsent) => {
      const { label, emoji } = formatScope(consent.scope);

      toast(
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-500" />
            <span className="font-semibold">Consent Request</span>
          </div>
          <p className="text-sm text-muted-foreground">
            <strong>{consent.developer}</strong> wants to access your{" "}
            <span className="font-medium">
              {emoji} {label}
            </span>
          </p>
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => {
                handleApprove(consent.id);
                toast.dismiss(consent.id);
              }}
              className="flex-1 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-md flex items-center justify-center gap-1"
            >
              <Check className="h-4 w-4" /> Approve
            </button>
            <button
              onClick={() => {
                handleDeny(consent.id);
                toast.dismiss(consent.id);
              }}
              className="flex-1 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-md flex items-center justify-center gap-1"
            >
              <X className="h-4 w-4" /> Deny
            </button>
          </div>
        </div>,
        {
          id: consent.id,
          duration: Infinity, // Keep until user dismisses
          position: "top-center",
          icon: <AlertCircle className="h-5 w-5 text-amber-500" />,
          action: {
            label: "View All",
            onClick: () => router.push("/dashboard/consents"),
          },
        }
      );
    },
    [handleApprove, handleDeny, router]
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
