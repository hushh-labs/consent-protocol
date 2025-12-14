// components/vault/passkey-setup-dialog.tsx

/**
 * Passkey Setup Dialog
 *
 * Offers user to enable biometric login (Windows Hello, Touch ID, etc.)
 * after successful passphrase-based login.
 */

"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/lib/morphy-ux/morphy";
import { Fingerprint, Shield, X, Check } from "lucide-react";
import {
  isPasskeySupported,
  registerPasskey,
  PasskeyCredential,
} from "@/lib/vault/webauthn";

// ============================================================================
// Types
// ============================================================================

interface PasskeySetupDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (credential: PasskeyCredential) => void;
  userId: string;
  displayName?: string;
}

// ============================================================================
// Component
// ============================================================================

export function PasskeySetupDialog({
  open,
  onClose,
  onSuccess,
  userId,
  displayName,
}: PasskeySetupDialogProps) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Check if passkeys are supported
  useEffect(() => {
    if (open) {
      isPasskeySupported().then(setSupported);
    }
  }, [open]);

  const handleSetup = async () => {
    setLoading(true);
    setError("");

    try {
      const credential = await registerPasskey(userId, displayName || userId);

      if (credential) {
        onSuccess(credential);
      } else {
        setError("Passkey registration was cancelled or failed.");
      }
    } catch (err) {
      setError("Failed to register passkey. Please try again.");
      console.error("Passkey setup error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Show different content based on support status
  if (supported === null) {
    return null; // Still checking
  }

  if (!supported) {
    return (
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Fingerprint className="h-5 w-5 text-gray-400" />
              Biometric Login Not Available
            </DialogTitle>
            <DialogDescription>
              Your device doesn't support passkeys/biometric login. You'll
              continue using your passphrase to unlock your vault.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={onClose}>Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Fingerprint className="h-5 w-5 text-blue-500" />
            Enable Biometric Login?
          </DialogTitle>
          <DialogDescription>
            Use your face, fingerprint, or device PIN for faster vault access.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Benefits */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <Check className="h-4 w-4 text-green-500" />
              <span>Faster login - no passphrase needed</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Check className="h-4 w-4 text-green-500" />
              <span>More secure than passwords alone</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Check className="h-4 w-4 text-green-500" />
              <span>Works with Windows Hello, Touch ID, etc.</span>
            </div>
          </div>

          {/* Security Note */}
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-2">
              <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5" />
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Your passphrase and recovery key still work as backups if
                biometrics fail.
              </p>
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="none" onClick={onClose} disabled={loading}>
            <X className="h-4 w-4 mr-2" />
            Skip for now
          </Button>
          <Button
            onClick={handleSetup}
            disabled={loading}
            className="bg-linear-to-r from-blue-500 to-purple-600"
          >
            {loading ? (
              <>
                <div className="h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Setting up...
              </>
            ) : (
              <>
                <Fingerprint className="h-4 w-4 mr-2" />
                Enable Biometric
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
