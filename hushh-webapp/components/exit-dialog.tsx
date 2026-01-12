"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LogOut, ShieldCheck } from "lucide-react";
import { useContext } from "react";

// Import the context directly to check if it exists
import { VaultContext } from "@/lib/vault/vault-context";

interface ExitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

/**
 * Exit Hushh confirmation dialog with secure cleanup
 *
 * Uses AlertDialog for native-style confirmation popup that:
 * - Does NOT close when clicking outside (safer for exit confirmations)
 * - Has proper accessibility for destructive actions
 * - Provides built-in Cancel/Action buttons
 *
 * Security features:
 * - Locks vault (clears encryption key from memory)
 * - Clears session storage
 * - Removes sensitive localStorage items
 * - Then exits the app via Capacitor App.exitApp()
 */
export function ExitDialog({ open, onOpenChange, onConfirm }: ExitDialogProps) {
  // Safely try to get vault context (may not exist during SSR/static generation)
  const vaultContext = useContext(VaultContext);

  const handleExit = async () => {
    // 1. Lock vault if context is available (clears key from memory)
    if (vaultContext?.lockVault) {
      vaultContext.lockVault();
    }

    // 2. Clear sensitive session data
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.clear();
    }

    // 3. Clear sensitive localStorage items
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem("user_id");
      localStorage.removeItem("vault_token");
      localStorage.removeItem("vault_unlocked");
    }

    // 4. Call the exit callback (which calls App.exitApp())
    onConfirm();
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Exit Hushh
          </AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to exit? Your vault will be locked for
            security.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleExit}
            className="bg-gradient-to-r from-red-500 via-red-600 to-red-700 text-white hover:from-red-600 hover:via-red-700 hover:to-red-800 shadow-lg"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Exit Hushh
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
