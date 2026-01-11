"use client";

/**
 * VaultLockGuard - Protects routes requiring vault access
 * ========================================================
 *
 * SECURITY: Detects when user is authenticated but vault is locked
 * (e.g., after page refresh - React state resets but Firebase persists)
 *
 * Flow:
 * - Auth ❌ → Redirect to login
 * - Auth ✅ + Vault ❌ → Show passphrase unlock dialog
 * - Auth ✅ + Vault ✅ → Render children
 */

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useVault } from "@/lib/vault/vault-context";
import { VaultFlow } from "./vault-flow";
import { HushhLoader } from "@/components/ui/hushh-loader";

// ============================================================================
// Types
// ============================================================================

interface VaultLockGuardProps {
  children: React.ReactNode;
}

// Timeout helper definition outside component to avoid re-creation
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), ms)
    ),
  ]);
}

// ============================================================================
// Component
// ============================================================================

export function VaultLockGuard({ children }: VaultLockGuardProps) {
  const router = useRouter();
  const { isVaultUnlocked, unlockVault } = useVault();
  const { user, loading: authLoading, signOut } = useAuth();

  // State
  const [status, setStatus] = useState<
    "checking" | "no_auth" | "vault_locked" | "unlocked"
  >("checking");
  const [userId, setUserId] = useState<string | null>(null);

  // ============================================================================
  // Effects
  // Use ref for mount state to prevent stale closure issues
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    async function checkStatus() {
      // 1. Wait for Auth Loading
      if (authLoading) {
        return;
      }

      // 2. Check Auth Status
      if (!user) {
        setStatus("no_auth");
        return;
      }

      setUserId(user.uid);

      // 3. Check Vault Lock Status
      if (isVaultUnlocked) {
        setStatus("unlocked");
        return;
      }

      // 4. Default to locked (delegating creation/check to VaultFlow)
      setStatus("vault_locked");
    }

    checkStatus();

    return () => {
      mountedRef.current = false;
    };
  }, [user, authLoading, isVaultUnlocked]); // FIXED: Removed `router` - not used in effect

  // Vault status sync effect
  useEffect(() => {
    if (isVaultUnlocked && status !== "unlocked") {
      setStatus("unlocked");
    }
  }, [isVaultUnlocked, status]);

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleLogout = async () => {
    await signOut();
  };

  // ============================================================================
  // Render
  // ============================================================================

  // Still checking auth/vault status
  if (status === "checking") {
    return <HushhLoader label="Checking vault status..." />;
  }

  // Redirecting to login (no auth)
  if (status === "no_auth") {
    // Actually perform the redirect
    if (typeof window !== "undefined") {
      const currentPath = window.location.pathname;
      router.push(`/?redirect=${encodeURIComponent(currentPath)}`);
    }
    return <HushhLoader label="Redirecting to login..." />;
  }

  // Vault is locked - show unlock dialog
  if (status === "vault_locked") {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-4">
        <div className="w-full max-w-md">
          <VaultFlow
            user={user!}
            onSuccess={() => {
              setStatus("unlocked");
            }}
          />
        </div>
      </div>
    );
  }

  // Vault unlocked - render children
  return <>{children}</>;
}
