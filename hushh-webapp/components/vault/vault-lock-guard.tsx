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

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { useVault } from "@/lib/vault/vault-context";
import { unlockVaultWithPassphrase } from "@/lib/vault/passphrase-key";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/lib/morphy-ux/morphy";
import { Button } from "@/lib/morphy-ux/morphy";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock, AlertCircle, Loader2 } from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface VaultLockGuardProps {
  children: React.ReactNode;
}

interface VaultData {
  encryptedVaultKey: string;
  salt: string;
  iv: string;
}

// ============================================================================
// Component
// ============================================================================

export function VaultLockGuard({ children }: VaultLockGuardProps) {
  const router = useRouter();
  const { isVaultUnlocked, unlockVault } = useVault();

  // State
  const [status, setStatus] = useState<
    "checking" | "no_auth" | "vault_locked" | "unlocked"
  >("checking");
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [vaultData, setVaultData] = useState<VaultData | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // ============================================================================
  // Effects
  // ============================================================================

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        // Not authenticated - redirect to login
        setStatus("no_auth");
        router.push("/login");
        return;
      }

      // User is authenticated
      setUserId(user.uid);

      // Check if vault is already unlocked
      if (isVaultUnlocked) {
        setStatus("unlocked");
        return;
      }

      // Vault is locked - fetch vault data for unlock
      try {
        const response = await fetch(`/api/vault/get?userId=${user.uid}`);
        if (response.ok) {
          const data = await response.json();
          setVaultData({
            encryptedVaultKey: data.encryptedVaultKey,
            salt: data.salt,
            iv: data.iv,
          });
          setStatus("vault_locked");
        } else {
          // No vault exists - might be new user, redirect to login
          console.error("Failed to fetch vault data");
          router.push("/login");
        }
      } catch (err) {
        console.error("Error fetching vault:", err);
        router.push("/login");
      }
    });

    return () => unsubscribe();
  }, [router, isVaultUnlocked]);

  // Re-check vault status when it changes
  useEffect(() => {
    if (isVaultUnlocked && status !== "unlocked") {
      setStatus("unlocked");
    }
  }, [isVaultUnlocked, status]);

  // ============================================================================
  // Handlers
  // ============================================================================

  async function handleUnlock() {
    if (!passphrase) {
      setError("Please enter your passphrase");
      return;
    }

    if (!vaultData || !userId) {
      setError("Vault data not available");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const vaultKeyHex = await unlockVaultWithPassphrase(
        passphrase,
        vaultData.encryptedVaultKey,
        vaultData.salt,
        vaultData.iv
      );

      // Store vault key in memory (VaultContext)
      unlockVault(vaultKeyHex);

      // Ensure user_id is in sessionStorage
      sessionStorage.setItem("user_id", userId);

      setStatus("unlocked");
    } catch (err: unknown) {
      console.error("Unlock error:", err);
      setError("Invalid passphrase. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // ============================================================================
  // Render
  // ============================================================================

  // Still checking auth/vault status
  if (status === "checking") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Checking vault status...</p>
        </div>
      </div>
    );
  }

  // Redirecting to login (no auth)
  if (status === "no_auth") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  // Vault is locked - show unlock dialog
  if (status === "vault_locked") {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-4">
        <Card variant="none" effect="glass" className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center mb-2">
              <Lock className="h-6 w-6 text-amber-500" />
            </div>
            <CardTitle>Vault Locked</CardTitle>
            <CardDescription>
              Your session is active, but your vault needs to be unlocked.
              <br />
              Enter your passphrase to continue.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="passphrase">Passphrase</Label>
              <Input
                id="passphrase"
                type="password"
                placeholder="Enter your vault passphrase"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
                autoFocus
                disabled={loading}
              />
            </div>

            <Button
              variant="gradient"
              effect="glass"
              className="w-full"
              onClick={handleUnlock}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Unlocking...
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4 mr-2" />
                  Unlock Vault
                </>
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Your vault key is stored in memory only for security.
              <br />
              Page refresh requires re-entering your passphrase.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Vault unlocked - render children
  return <>{children}</>;
}
