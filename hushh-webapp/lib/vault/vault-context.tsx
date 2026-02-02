/**
 * Vault Context - Memory-Only Vault Key Storage
 * =============================================
 *
 * SECURITY MODEL:
 * - Vault Key: Stored in React state (memory only) - XSS cannot access
 * - VAULT_OWNER Token: Stored in memory AND synced to sessionStorage
 *   - Synced to sessionStorage so service layer (ApiService, WorldModelService) can access
 *   - Token is time-limited (24h) and scope-restricted, so less sensitive than vault key
 *   - Cleared on logout/lock
 *
 * This follows the BYOK (Bring Your Own Key) security model:
 * - Firebase Auth = Identity (who you are)
 * - Vault Key = Access (unlock encrypted data) - NEVER leaves memory
 * - VAULT_OWNER Token = Consent gate (authorize API calls) - synced for service access
 *
 * PERFORMANCE:
 * - Prefetches common data (world model, vault status, consents) on vault unlock
 * - Data is cached via CacheService for faster page loads
 */

"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";
import { setSessionItem, removeSessionItem } from "@/lib/utils/session-storage";
import { useAuth } from "@/lib/firebase/auth-context";
import { WorldModelService } from "@/lib/services/world-model-service";
import { ApiService } from "@/lib/services/api-service";
import { CacheService, CACHE_KEYS, CACHE_TTL } from "@/lib/services/cache-service";

// ============================================================================
// Types
// ============================================================================

interface VaultContextType {
  /** The decrypted vault key (hex string) - ONLY IN MEMORY */
  vaultKey: string | null;

  /** VAULT_OWNER consent token - ONLY IN MEMORY */
  vaultOwnerToken: string | null;

  /** Token expiry timestamp (ms) */
  tokenExpiresAt: number | null;

  /** Whether the vault is currently unlocked */
  isVaultUnlocked: boolean;

  /** Set the vault key and VAULT_OWNER token after successful authentication */
  unlockVault: (key: string, token: string, expiresAt: number) => void;

  /** Clear the vault key and token (on logout or timeout) */
  lockVault: () => void;

  /** Get the vault key for encryption operations */
  getVaultKey: () => string | null;

  /** Get the VAULT_OWNER token for agent requests */
  getVaultOwnerToken: () => string | null;
}

// ============================================================================
// Context
// ============================================================================

// Export context for components that need optional access (e.g., ExitDialog)
export const VaultContext = createContext<VaultContextType | null>(null);

// ============================================================================
// Provider
// ============================================================================

interface VaultProviderProps {
  children: ReactNode;
}

export function VaultProvider({ children }: VaultProviderProps) {
  // Access Auth Context to listen for logout
  const { user } = useAuth();

  // SECURITY: Vault key stored in React state = memory only
  // This is NOT accessible via sessionStorage.getItem() - XSS protection
  const [vaultKey, setVaultKey] = useState<string | null>(null);

  // VAULT_OWNER consent token (also memory-only for security)
  const [vaultOwnerToken, setVaultOwnerToken] = useState<string | null>(null);
  const [tokenExpiresAt, setTokenExpiresAt] = useState<number | null>(null);

  const lockVault = useCallback(() => {
    console.log("🔒 Vault locked (key + token cleared from memory)");
    setVaultKey(null);
    setVaultOwnerToken(null);
    setTokenExpiresAt(null);
    removeSessionItem("vault_unlocked");
    // Clear token from sessionStorage so services can detect locked state
    // Note: The vault key is NEVER stored in sessionStorage (XSS protection)
    removeSessionItem("vault_owner_token");
    removeSessionItem("vault_owner_token_expires_at");
  }, []);

  // Auto-Lock on Sign Out
  // If AuthContext reports no user, we MUST clear the decrypted key from memory immediately.
  useEffect(() => {
    if (!user && vaultKey) {
      console.log("🔒 [VaultProvider] User signed out - Formatting memory...");
      lockVault();
    }
  }, [user, vaultKey, lockVault]);

  // Listen for vault-lock-requested events (e.g., when VAULT_OWNER token is revoked)
  useEffect(() => {
    const handleLockRequest = (event: Event) => {
      const customEvent = event as CustomEvent<{ reason: string }>;
      console.log(
        `🔒 [VaultProvider] Lock requested: ${customEvent.detail?.reason}`
      );
      lockVault();
    };

    window.addEventListener("vault-lock-requested", handleLockRequest);
    return () =>
      window.removeEventListener("vault-lock-requested", handleLockRequest);
  }, [lockVault]);

  const unlockVault = useCallback(
    (key: string, token: string, expiresAt: number) => {
      console.log(
        "🔓 Vault unlocked (key in memory, token synced to sessionStorage)"
      );
      setVaultKey(key);
      setVaultOwnerToken(token);
      setTokenExpiresAt(expiresAt);

      // Store a flag to indicate vault is unlocked
      // (But NOT the actual key - just the state)
      // Uses localStorage on iOS, sessionStorage on web
      setSessionItem("vault_unlocked", "true");
      
      // Sync VAULT_OWNER token to sessionStorage for service layer access
      // This allows ApiService and WorldModelService to include auth headers
      // Note: The vault key is NEVER stored in sessionStorage (XSS protection)
      // The consent token is less sensitive as it's time-limited and scope-restricted
      setSessionItem("vault_owner_token", token);
      setSessionItem("vault_owner_token_expires_at", expiresAt.toString());

      // Prefetch common data in background (don't await - fire and forget)
      if (user?.uid) {
        prefetchDashboardData(user.uid, token);
      }
    },
    [user?.uid]
  );

  /**
   * Prefetch common data after vault unlock to speed up page loads.
   * Runs in background - errors are logged but don't block UI.
   */
  const prefetchDashboardData = async (userId: string, token: string) => {
    console.log("[VaultContext] Prefetching dashboard data...");
    const cache = CacheService.getInstance();

    try {
      // Fetch in parallel for speed
      const [metadataResult, vaultStatusResult, consentsResult] = await Promise.allSettled([
        WorldModelService.getMetadata(userId), // Already caches internally
        ApiService.getVaultStatus(userId, token),
        ApiService.getActiveConsents(userId, token),
      ]);

      // Cache vault status if successful
      if (vaultStatusResult.status === "fulfilled" && vaultStatusResult.value.ok) {
        const statusData = await vaultStatusResult.value.json();
        cache.set(CACHE_KEYS.VAULT_STATUS(userId), statusData, CACHE_TTL.SHORT);
        console.log("[VaultContext] Cached vault status");
      }

      // Cache active consents if successful
      if (consentsResult.status === "fulfilled" && consentsResult.value.ok) {
        const consentsData = await consentsResult.value.json();
        cache.set(CACHE_KEYS.ACTIVE_CONSENTS(userId), consentsData.active || [], CACHE_TTL.SHORT);
        console.log("[VaultContext] Cached active consents");
      }

      console.log("[VaultContext] Prefetch complete");
    } catch (error) {
      // Don't throw - prefetch is best-effort
      console.warn("[VaultContext] Prefetch error (non-blocking):", error);
    }
  };

  const getVaultKey = useCallback(() => {
    return vaultKey;
  }, [vaultKey]);

  const getVaultOwnerToken = useCallback(() => {
    // Check expiry
    if (tokenExpiresAt && Date.now() > tokenExpiresAt) {
      console.warn("⚠️ VAULT_OWNER token expired");
      return null;
    }
    return vaultOwnerToken;
  }, [vaultOwnerToken, tokenExpiresAt]);

  const value: VaultContextType = {
    vaultKey,
    vaultOwnerToken,
    tokenExpiresAt,
    isVaultUnlocked: !!vaultKey && !!vaultOwnerToken,
    unlockVault,
    lockVault,
    getVaultKey,
    getVaultOwnerToken,
  };

  return (
    <VaultContext.Provider value={value}>{children}</VaultContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useVault(): VaultContextType {
  const context = useContext(VaultContext);
  if (!context) {
    throw new Error("useVault must be used within a VaultProvider");
  }
  return context;
}

/**
 * HOC for components that need vault access
 * Wraps component to ensure vault is available
 */
export function withVaultRequired<T extends object>(
  Component: React.ComponentType<T>
): React.FC<T> {
  return function VaultRequiredComponent(props: T) {
    const { isVaultUnlocked } = useVault();

    if (!isVaultUnlocked) {
      return (
        <div className="flex items-center justify-center min-h-[200px]">
          <p className="text-muted-foreground">
            🔒 Vault locked. Please unlock to continue.
          </p>
        </div>
      );
    }

    return <Component {...props} />;
  };
}
