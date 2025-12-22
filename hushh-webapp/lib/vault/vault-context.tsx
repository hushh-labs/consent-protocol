/**
 * Vault Context - Memory-Only Vault Key Storage
 * =============================================
 *
 * SECURITY: Stores vault key in React state (memory only)
 * - XSS cannot access via sessionStorage.getItem()
 * - Key is lost on page refresh (security feature)
 * - Each tab has its own isolated vault state
 *
 * This follows the BYOK (Bring Your Own Key) security model:
 * - Firebase Auth = Identity (who you are)
 * - Vault Key = Access (unlock encrypted data)
 */

"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";

// ============================================================================
// Types
// ============================================================================

interface VaultContextType {
  /** The decrypted vault key (hex string) - ONLY IN MEMORY */
  vaultKey: string | null;

  /** Whether the vault is currently unlocked */
  isVaultUnlocked: boolean;

  /** Set the vault key after successful passphrase verification */
  unlockVault: (key: string) => void;

  /** Clear the vault key (on logout or timeout) */
  lockVault: () => void;

  /** Get the vault key for encryption operations */
  getVaultKey: () => string | null;
}

// ============================================================================
// Context
// ============================================================================

const VaultContext = createContext<VaultContextType | null>(null);

// ============================================================================
// Provider
// ============================================================================

interface VaultProviderProps {
  children: ReactNode;
}

export function VaultProvider({ children }: VaultProviderProps) {
  // SECURITY: Vault key stored in React state = memory only
  // This is NOT accessible via sessionStorage.getItem() - XSS protection
  const [vaultKey, setVaultKey] = useState<string | null>(null);

  const unlockVault = useCallback((key: string) => {
    console.log("🔓 Vault unlocked (key stored in memory only)");
    setVaultKey(key);

    // Store a flag in sessionStorage to indicate vault is unlocked
    // (But NOT the actual key - just the state)
    sessionStorage.setItem("vault_unlocked", "true");
  }, []);

  const lockVault = useCallback(() => {
    console.log("🔒 Vault locked (key cleared from memory)");
    setVaultKey(null);
    sessionStorage.removeItem("vault_unlocked");
  }, []);

  const getVaultKey = useCallback(() => {
    return vaultKey;
  }, [vaultKey]);

  const value: VaultContextType = {
    vaultKey,
    isVaultUnlocked: !!vaultKey,
    unlockVault,
    lockVault,
    getVaultKey,
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
