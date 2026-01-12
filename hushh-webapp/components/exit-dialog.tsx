"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
 * Security features:
 * - Locks vault (clears encryption key from memory)
 * - Clears session storage
 * - Removes sensitive localStorage items
 * - Then exits the app gracefully
 */
export function ExitDialog({ open, onOpenChange, onConfirm }: ExitDialogProps) {
  // Safely try to get vault context (may not exist during SSR/static generation)
  const vaultContext = useContext(VaultContext);

  const handleExit = async () => {
    console.log("[ExitDialog] Starting secure exit...");

    // 1. Lock vault if context is available (clears key from memory)
    if (vaultContext?.lockVault) {
      console.log("[ExitDialog] Locking vault (clearing key from memory)...");
      vaultContext.lockVault();
    }

    // 2. Clear sensitive session data
    console.log("[ExitDialog] Clearing session storage...");
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.clear();
    }

    // 3. Clear sensitive localStorage items
    console.log("[ExitDialog] Removing sensitive localStorage items...");
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem("user_id");
      localStorage.removeItem("vault_token");
      localStorage.removeItem("vault_unlocked");
    }

    console.log("[ExitDialog] Secure cleanup complete, exiting app...");

    // 4. Call the exit callback (which calls App.exitApp())
    onConfirm();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <DialogTitle>Exit Hushh</DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            Are you sure you want to exit? Your vault will be locked for
            security.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleExit}>
            <LogOut className="h-4 w-4 mr-2" />
            Exit Hushh
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
