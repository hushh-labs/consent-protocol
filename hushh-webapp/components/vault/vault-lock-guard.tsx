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
import { useAuth } from "@/hooks/use-auth";
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
import { Lock, AlertCircle, Loader2, RefreshCw, LogOut } from "lucide-react";

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
    "checking" | "no_auth" | "vault_locked" | "unlocked" | "error"
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
    let mounted = true;

    async function checkVault() {
      // 1. Wait for Auth Loading
      if (authLoading) return;

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

      // 4. Fetch Vault Data (if not already loaded)
      if (!vaultData) {
        try {
          // Use VaultService for platform-aware fetching (Native vs Web)
          const { VaultService } = await import("@/lib/services/vault-service");
          console.log("🔐 [VaultLockGuard] Fetching vault data via Service...");

          // Use timeout to prevent hanging (15s)
          const data = await withTimeout(
            VaultService.getVault(user.uid),
            15000
          );

          if (mounted) {
            if (data && data.encryptedVaultKey) {
              setVaultData({
                encryptedVaultKey: data.encryptedVaultKey,
                salt: data.salt,
                iv: data.iv,
              });
              setStatus("vault_locked");
            } else {
              console.error("Failed to fetch vault data: Data empty");
              // If data is empty, maybe they haven't set up a vault?
              // But they are in dashboard.
              setError("Vault data missing.");
              setStatus("error");
            }
          }
        } catch (err: any) {
          if (mounted) {
            console.error("Error fetching vault:", err);
            setError(
              err.message === "Timeout"
                ? "Connection timed out checking vault."
                : "Failed to load vault."
            );
            setStatus("error");
          }
        }
      } else {
        // Vault data exists but locked
        setStatus("vault_locked");
      }
    }

    checkVault();

    return () => {
      mounted = false;
    };
  }, [user, authLoading, isVaultUnlocked, vaultData, router]);

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

  const handleRetry = () => {
    setStatus("checking");
    setVaultData(null); // Force refetch
  };

  const handleLogout = async () => {
    await signOut();
  };

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

  // Error State
  if (status === "error") {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-4">
        <Card
          variant="none"
          effect="glass"
          className="w-full max-w-md border-destructive/20"
        >
          <CardHeader className="text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Connection Error</CardTitle>
            <CardDescription className="text-destructive">
              {error}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="none" className="w-full" onClick={handleRetry}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>

            <Button
              variant="link"
              className="w-full text-muted-foreground hover:text-destructive"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </CardContent>
        </Card>
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

            <div className="flex justify-center pt-2">
              <Button
                variant="link"
                className="text-xs text-muted-foreground h-auto p-0 hover:text-foreground"
                onClick={handleLogout}
              >
                Not you? Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Vault unlocked - render children
  return <>{children}</>;
}
