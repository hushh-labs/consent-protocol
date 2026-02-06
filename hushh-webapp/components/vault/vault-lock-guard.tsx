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
 *
 * SECURITY MODEL (BYOK Compliant):
 * - The vault key is stored ONLY in React state (memory).
 * - On page refresh, React state resets, so the vault key is lost.
 * - We ONLY trust `isVaultUnlocked` from VaultContext (which checks memory state).
 * - We render children immediately if vault is unlocked (no intermediate states).
 * - Module-level flag tracks unlock across route changes within same session.
 * 
 * PRELOADING:
 * - Preloads onboarding status when vault unlocks (reduces animation delay on Kai page)
 */

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useVault } from "@/lib/vault/vault-context";
import { VaultFlow } from "./vault-flow";
import { HushhLoader } from "@/components/ui/hushh-loader";
import { OnboardingService } from "@/lib/services/onboarding-service";

// ============================================================================
// Module-level cache for onboarding status (survives route changes)
// ============================================================================
let onboardingStatusCache: { userId: string; completed: boolean } | null = null;

export function getOnboardingStatusCache(): typeof onboardingStatusCache {
  return onboardingStatusCache;
}

// ============================================================================
// Types
// ============================================================================

interface VaultLockGuardProps {
  children: React.ReactNode;
}

// ============================================================================
// Component
// ============================================================================

export function VaultLockGuard({ children }: VaultLockGuardProps) {
  const router = useRouter();
  const { isVaultUnlocked } = useVault();
  const { user, loading: authLoading, signOut } = useAuth();
  const preloadedRef = useRef(false);

  // Preload onboarding status when vault is unlocked
  useEffect(() => {
    if (!isVaultUnlocked || !user || preloadedRef.current) return;
    
    preloadedRef.current = true;
    
    // Fire-and-forget preload - don't block rendering
    OnboardingService.checkOnboardingStatus(user.uid).then((completed) => {
      onboardingStatusCache = { userId: user.uid, completed };
    }).catch(() => {
      // Ignore errors - Kai page will fall back to its own check
    });
  }, [isVaultUnlocked, user]);

  // Redirect unauthenticated users (side-effect outside render)
  useEffect(() => {
    if (authLoading) return;
    if (user) return;

    if (typeof window !== "undefined") {
      const currentPath = window.location.pathname;
      router.push(`/?redirect=${encodeURIComponent(currentPath)}`);
    }
  }, [authLoading, router, user]);

  // ============================================================================
  // FAST PATH: If vault is unlocked (in memory), render children immediately
  // This eliminates flicker on route changes - no state, no effects, just render
  // ============================================================================
  if (isVaultUnlocked) {
    return <>{children}</>;
  }

  // ============================================================================
  // SLOW PATH: Vault not unlocked, need to check auth and show appropriate UI
  // ============================================================================
  
  // Auth still loading - show loader
  if (authLoading) {
    return <HushhLoader label="Checking session..." />;
  }

  // No user - redirect to login
  if (!user) {
    return <HushhLoader label="Redirecting to login..." />;
  }

  // User exists but vault is locked - show unlock dialog
  return (
    <div className="flex items-center justify-center min-h-[60vh] p-4">
      <div className="w-full max-w-md">
        <VaultFlow
          user={user}
          onSuccess={() => {
            // Force a router refresh to ensure state update is picked up
            // This handles potential race conditions on native
            router.refresh(); 
          }}
        />
      </div>
    </div>
  );
}

