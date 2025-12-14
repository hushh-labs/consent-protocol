// components/vault/recovery-login-dialog.tsx

/**
 * Recovery Login Dialog
 *
 * Fallback option when user loses access to:
 * - Their passphrase
 * - Their passkey/biometrics (lost device, etc.)
 *
 * Uses the HBK-XXXX-XXXX-XXXX-XXXX recovery key generated during vault creation.
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
import { Input } from "@/components/ui/input";
import { Key, AlertTriangle, CheckCircle } from "lucide-react";
import { recoverWithKey } from "@/lib/vault/webauthn";

// ============================================================================
// Types
// ============================================================================

interface RecoveryLoginDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (vaultKeyHex: string) => void;
  vaultData: {
    encryptedVaultKey: string;
    salt: string;
    iv: string;
    authTag: string;
  };
}

// ============================================================================
// Component
// ============================================================================

export function RecoveryLoginDialog({
  open,
  onClose,
  onSuccess,
  vaultData,
}: RecoveryLoginDialogProps) {
  const [recoveryKey, setRecoveryKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Format recovery key as user types
  const formatRecoveryKey = (value: string): string => {
    // Remove all non-alphanumeric except dashes
    const clean = value.toUpperCase().replace(/[^A-Z0-9-]/g, "");

    // If starts with HBK-, keep it, otherwise add it
    if (!clean.startsWith("HBK-") && clean.length > 0) {
      // Auto-format: add dashes every 4 chars after HBK-
      const withoutPrefix = clean.replace(/^HBK-?/, "");
      const chunks = withoutPrefix.match(/.{1,16}/g) || [];
      return "HBK-" + chunks.join("-");
    }

    return clean;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatRecoveryKey(e.target.value);
    setRecoveryKey(formatted);
    setError("");
  };

  const handleRecover = async () => {
    if (!recoveryKey) {
      setError("Please enter your recovery key");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const vaultKeyHex = await recoverWithKey(
        recoveryKey,
        vaultData.encryptedVaultKey,
        vaultData.salt,
        vaultData.iv,
        vaultData.authTag
      );

      if (vaultKeyHex) {
        onSuccess(vaultKeyHex);
      } else {
        setError("Invalid recovery key. Please check and try again.");
      }
    } catch (err) {
      setError("Failed to recover vault. Recovery key may be incorrect.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-amber-500" />
            Recovery Key Login
          </DialogTitle>
          <DialogDescription>
            Enter the recovery key you saved when you created your vault.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Recovery Key Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Recovery Key</label>
            <Input
              type="text"
              placeholder="HBK-XXXX-XXXX-XXXX-XXXX"
              value={recoveryKey}
              onChange={handleInputChange}
              className="font-mono text-center tracking-wider"
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              Format: HBK-XXXX-XXXX-XXXX-XXXX
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
              <AlertTriangle className="h-4 w-4" />
              {error}
            </div>
          )}

          {/* Warning */}
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div className="text-sm text-amber-800 dark:text-amber-200">
                <p className="font-medium">Lost your recovery key?</p>
                <p className="text-xs mt-1">
                  If you've lost both your passphrase and recovery key, your
                  encrypted data cannot be recovered. This is by design for your
                  security.
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="none" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleRecover}
            disabled={loading || !recoveryKey}
            className="bg-linear-to-r from-amber-500 to-orange-600"
          >
            {loading ? (
              <>
                <div className="h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Recovering...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Recover Vault
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
