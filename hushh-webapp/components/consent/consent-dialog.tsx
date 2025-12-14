// components/consent/consent-dialog.tsx

/**
 * Consent Dialog Component
 *
 * Per-action consent UI following Bible principles:
 * "Consent is not inferred. It is declared, signed, scoped."
 *
 * Shows user exactly what data an agent wants to access,
 * then issues a consent token upon approval.
 */

"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/lib/morphy-ux/morphy";
import { Shield, CheckCircle, XCircle, Clock, Lock } from "lucide-react";

// ============================================================================
// Types
// ============================================================================

export interface ConsentRequest {
  agentId: string;
  agentName: string;
  agentIcon?: string;
  scope: string;
  scopeDescription: string;
  dataFields?: string[];
  expiresInDays?: number;
}

export interface ConsentDialogProps {
  open: boolean;
  request: ConsentRequest;
  onGrant: () => Promise<void>;
  onDeny: () => void;
  loading?: boolean;
}

// ============================================================================
// Scope to Human-Readable Mapping
// ============================================================================

const SCOPE_DESCRIPTIONS: Record<
  string,
  { title: string; description: string }
> = {
  "vault.write.food": {
    title: "Save Food Preferences",
    description:
      "Store your dietary restrictions, favorite cuisines, and budget",
  },
  "vault.read.food": {
    title: "Read Food Preferences",
    description: "Access your stored dietary and cuisine preferences",
  },
  "vault.write.professional": {
    title: "Save Professional Profile",
    description: "Store your skills, experience, and career preferences",
  },
  "vault.read.professional": {
    title: "Read Professional Profile",
    description: "Access your career data for recommendations",
  },
  "vault.write.finance": {
    title: "Save Financial Preferences",
    description: "Store budget and spending preferences",
  },
  "vault.read.finance": {
    title: "Read Financial Data",
    description: "Access your financial preferences for analysis",
  },
};

// ============================================================================
// Component
// ============================================================================

export function ConsentDialog({
  open,
  request,
  onGrant,
  onDeny,
  loading = false,
}: ConsentDialogProps) {
  const [isGranting, setIsGranting] = useState(false);

  const scopeInfo = SCOPE_DESCRIPTIONS[request.scope] || {
    title: request.scope,
    description: request.scopeDescription,
  };

  const handleGrant = async () => {
    setIsGranting(true);
    try {
      await onGrant();
    } finally {
      setIsGranting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onDeny()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-full bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center text-2xl shadow-lg">
              {request.agentIcon || "🤖"}
            </div>
            <div>
              <DialogTitle className="text-lg">{request.agentName}</DialogTitle>
              <DialogDescription className="text-sm">
                is requesting permission
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Scope Info */}
        <div className="space-y-4 py-4">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
            <Shield className="h-5 w-5 text-blue-500 mt-0.5" />
            <div>
              <p className="font-medium text-blue-900 dark:text-blue-100">
                {scopeInfo.title}
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                {scopeInfo.description}
              </p>
            </div>
          </div>

          {/* Data Fields */}
          {request.dataFields && request.dataFields.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                This will include:
              </p>
              <ul className="text-sm space-y-1">
                {request.dataFields.map((field, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <Lock className="h-3 w-3 text-green-500" />
                    <span>{field}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Expiry Info */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Permission expires in {request.expiresInDays || 7} days</span>
          </div>
        </div>

        {/* Security Note */}
        <div className="text-xs text-muted-foreground bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
          🔐 Your data will be encrypted end-to-end. Only you can decrypt it.
        </div>

        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button
            variant="none"
            onClick={onDeny}
            disabled={isGranting || loading}
            className="flex-1"
          >
            <XCircle className="h-4 w-4 mr-2" />
            Deny
          </Button>
          <Button
            onClick={handleGrant}
            disabled={isGranting || loading}
            className="flex-1 bg-linear-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
          >
            {isGranting ? (
              <>
                <div className="h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Granting...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Allow
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Hook for Easy Usage
// ============================================================================

import { useCallback } from "react";

export interface UseConsentReturn {
  requestConsent: (request: ConsentRequest) => Promise<boolean>;
}

/**
 * Hook to request consent in components
 *
 * Usage:
 * const { requestConsent } = useConsent();
 * const granted = await requestConsent({
 *   agentId: 'agent_food_dining',
 *   agentName: 'Food & Dining',
 *   scope: 'vault.write.food',
 *   scopeDescription: 'Save your preferences'
 * });
 */
export function useConsent(): UseConsentReturn {
  const requestConsent = useCallback(
    async (request: ConsentRequest): Promise<boolean> => {
      // This would integrate with a global consent manager
      // For now, we'll use a simple confirm (to be replaced with dialog)
      return window.confirm(
        `${request.agentName} wants to: ${request.scopeDescription}\n\nAllow?`
      );
    },
    []
  );

  return { requestConsent };
}
