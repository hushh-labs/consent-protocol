"use client";

/**
 * Login Page - Passphrase-Based Authentication
 *
 * Flow:
 *   New User:      OAuth → Passphrase → Recovery Key → Dashboard
 *   Return User:   OAuth → Passphrase → Dashboard
 *   Fallback:      OAuth → Recovery Key → Dashboard
 *
 * Note: PRF-based passkeys are the future, but current
 * support is limited. Using passphrase for reliability.
 *
 * Bible Compliance:
 *   - Zero-knowledge: Passphrase never leaves device
 *   - Vault encryption: AES-256-GCM with PBKDF2-derived key
 *   - Server stores only encrypted vault key
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  onAuthStateChanged,
} from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { AuthService } from "@/lib/services/auth-service";
import { VaultService } from "@/lib/services/vault-service";
// Removed direct vault imports - handled by VaultService
import { useVault } from "@/lib/vault/vault-context";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/lib/morphy-ux/morphy";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Shield,
  Key,
  Sparkles,
  AlertCircle,
  Lock,
  Copy,
  Check,
  Download,
  Loader2,
} from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

type LoginStep =
  | "checking" // Checking auth state
  | "ready" // Ready for OAuth
  | "oauth_loading" // OAuth in progress
  | "passphrase_create" // Creating new passphrase
  | "passphrase_unlock" // Unlocking with passphrase
  | "recovery_key_show" // Showing recovery key (new user)
  | "recovery_key_input" // Entering recovery key (fallback)
  | "success"; // Authenticated, redirecting

// ============================================================================
// COMPONENT
// ============================================================================

export default function LoginPage() {
  const router = useRouter();
  const { isVaultUnlocked, unlockVault } = useVault();

  // State
  const [step, setStep] = useState<LoginStep>("checking");
  const [error, setError] = useState("");

  // User data
  const [userId, setUserId] = useState("");
  const [userDisplayName, setUserDisplayName] = useState("");

  // Vault data
  const [passphrase, setPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [recoveryKey, setRecoveryKey] = useState("");
  const [recoveryKeyInput, setRecoveryKeyInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [vaultData, setVaultData] = useState<{
    encryptedVaultKey: string;
    salt: string;
    iv: string;
    recoveryEncryptedVaultKey: string;
    recoverySalt: string;
    recoveryIv: string;
  } | null>(null);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  useEffect(() => {
    // Safety timeout: If auth state doesn't respond in 3 seconds, show login
    const timeout = setTimeout(() => {
      if (step === "checking") {
        console.log("⚠️ Auth state timeout - showing login");
        setStep("ready");
      }
    }, 3000);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      clearTimeout(timeout);
      
      if (user) {
        // Check if vault is already unlocked (in memory)
        if (isVaultUnlocked) {
          router.push("/dashboard");
          return;
        }

        setUserId(user.uid);
        setUserDisplayName(user.displayName || "");

        // Save Firebase profile to session
        sessionStorage.setItem("user_id", user.uid);
        sessionStorage.setItem("user_uid", user.uid);
        sessionStorage.setItem("user_email", user.email || "");
        sessionStorage.setItem("user_displayName", user.displayName || "");
        sessionStorage.setItem("user_photo", user.photoURL || "");

        await checkVaultAndProceed(user.uid);
      } else {
        setStep("ready");
      }
    });

    return () => {
      clearTimeout(timeout);
      unsubscribe();
    };
  }, [router]);

  // ============================================================================
  // VAULT CHECK
  // ============================================================================

  async function checkVaultAndProceed(uid: string) {
    try {
      console.log("🔐 [LoginPage] Checking vault for:", uid);
      const hasVault = await VaultService.checkVault(uid);
      console.log("🔐 [LoginPage] hasVault result:", hasVault);

      if (hasVault) {
        // Existing user - fetch vault data and unlock
        try {
          console.log("🔐 [LoginPage] Fetching vault data...");
          const data = await VaultService.getVault(uid);
          console.log("🔐 [LoginPage] Vault data received");
          setVaultData({
            encryptedVaultKey: data.encryptedVaultKey,
            salt: data.salt,
            iv: data.iv,
            recoveryEncryptedVaultKey: data.recoveryEncryptedVaultKey,
            recoverySalt: data.recoverySalt,
            recoveryIv: data.recoveryIv,
          });
          setStep("passphrase_unlock");
        } catch (err) {
          console.error("❌ [LoginPage] Failed to load vault data:", err);
          toast.error("Failed to load vault data", {
            description: err instanceof Error ? err.message : "Please try again",
          });
          setStep("ready");
        }
      } else {
        // New user - create passphrase
        console.log("🔐 [LoginPage] New user - showing passphrase creation");
        setStep("passphrase_create");
      }
    } catch (err) {
      console.error("❌ [LoginPage] Vault check error:", err);
      toast.error("Failed to check vault status", {
        description: err instanceof Error ? err.message : "Please try again",
      });
      setStep("ready");
    }
  }

  // ============================================================================
  // HANDLERS
  // ============================================================================

  async function handleGoogleLogin() {
    setError("");
    setStep("oauth_loading");

    try {
      // Use AuthService for platform-aware sign-in
      // iOS: Native Google Sign-In → Firebase credential sync
      // Web: Firebase signInWithPopup (unchanged)
      const result = await AuthService.signInWithGoogle();
      const user = result.user;

      setUserId(user.uid);
      setUserDisplayName(user.displayName || "");

      // Save Firebase profile to session
      sessionStorage.setItem("user_id", user.uid);
      sessionStorage.setItem("user_uid", user.uid);
      sessionStorage.setItem("user_email", user.email || "");
      sessionStorage.setItem("user_displayName", user.displayName || "");
      sessionStorage.setItem("user_photo", user.photoURL || "");
      sessionStorage.setItem("user_emailVerified", String(user.emailVerified));
      sessionStorage.setItem(
        "user_creationTime",
        user.metadata.creationTime || ""
      );
      sessionStorage.setItem(
        "user_lastSignInTime",
        user.metadata.lastSignInTime || ""
      );

      console.log("✅ Firebase profile saved:", user.displayName, user.email);

      await checkVaultAndProceed(user.uid);
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      console.error("OAuth error:", err);
      console.error("Error code:", error?.code);
      console.error("Error message:", error?.message);

      // Check if user closed the popup/cancelled - reset silently
      if (
        error.code === "auth/popup-closed-by-user" ||
        error.code === "auth/cancelled-popup-request" ||
        error.code === "USER_CANCELLED" ||
        error.message?.includes("popup") ||
        error.message?.includes("closed") ||
        error.message?.includes("cancelled")
      ) {
        // User intentionally cancelled - just reset state
        console.log("User cancelled sign-in, resetting to ready state");
        setStep("ready");
        return;
      }

      // Show error via sonner toast
      toast.error("Authentication failed", {
        description: error.message || "Please try again",
      });
      setStep("ready");
    }
  }

  async function handleCreatePassphrase() {
    if (passphrase.length < 8) {
      setError("Passphrase must be at least 8 characters");
      return;
    }

    if (passphrase !== confirmPassphrase) {
      setError("Passphrases do not match");
      return;
    }

    setError("");

    try {
      console.log("🔐 Creating vault with passphrase...");

      const result = await VaultService.createVault(passphrase);

      // Store vault key in memory only (not sessionStorage - XSS protection)
      unlockVault(result.vaultKeyHex);

      // Save to server via Service
      await VaultService.setupVault(userId, {
        authMethod: "passphrase",
        encryptedVaultKey: result.encryptedVaultKey,
        salt: result.salt,
        iv: result.iv,
        recoveryEncryptedVaultKey: result.recoveryEncryptedVaultKey,
        recoverySalt: result.recoverySalt,
        recoveryIv: result.recoveryIv,
      });

      // Show recovery key
      setRecoveryKey(result.recoveryKey);
      setStep("recovery_key_show");
    } catch (err: any) {
      console.error("Create vault error:", err);
      setError(err.message || "Failed to create vault");
    }
  }

  async function handleUnlockPassphrase() {
    if (!passphrase) {
      setError("Please enter your passphrase");
      return;
    }

    if (!vaultData) {
      setError("Vault data not available");
      return;
    }

    setError("");

    try {
      console.log("🔓 Unlocking vault with passphrase...");

      const vaultKeyHex = await VaultService.unlockVault(
        passphrase,
        vaultData.encryptedVaultKey,
        vaultData.salt,
        vaultData.iv
      );

      // Store vault key in memory only (not sessionStorage - XSS protection)
      unlockVault(vaultKeyHex);
      sessionStorage.setItem("user_id", userId); // Store for consents page

      // Issue session token via consent protocol
      console.log("🔐 Issuing session token via consent protocol...");
      try {
        // Get Firebase ID token for authentication
        const user = auth.currentUser;
        const idToken = user ? await user.getIdToken() : null;

        if (!idToken) {
          console.warn("⚠️ No Firebase ID token available");
        } else {
          // Create consent session token
          const tokenResponse = await fetch("/api/consent/session-token", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({ userId }),
          });

          if (tokenResponse.ok) {
            const tokenData = await tokenResponse.json();
            sessionStorage.setItem("session_token", tokenData.sessionToken);
            sessionStorage.setItem(
              "session_token_expires",
              String(tokenData.expiresAt)
            );
            console.log(
              "✅ Session token issued, expires:",
              new Date(tokenData.expiresAt).toISOString()
            );
          } else {
            console.warn(
              "⚠️ Session token issuance failed, continuing without token"
            );
          }

          // Create httpOnly session cookie via Firebase Admin
          console.log("🍪 Creating secure session cookie...");
          const sessionResponse = await fetch("/api/auth/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idToken }),
          });

          if (sessionResponse.ok) {
            console.log("✅ Secure session cookie created");
          } else {
            console.warn("⚠️ Session cookie creation failed");
          }
        }
      } catch (tokenErr) {
        console.warn("⚠️ Session token issuance error:", tokenErr);
        // Continue without token - vault is still unlocked
      }

      setStep("success");
      router.push("/dashboard");
    } catch (err: any) {
      console.error("Unlock error:", err);
      setError("Invalid passphrase. Try again or use recovery key.");
    }
  }

  async function handleRecoveryKeySubmit() {
    if (!recoveryKeyInput.trim()) {
      setError("Please enter your recovery key");
      return;
    }

    if (!vaultData) {
      setError("Vault data not available");
      return;
    }

    setError("");

    try {
      console.log("🔑 Unlocking with recovery key...");

      const vaultKeyHex = await VaultService.unlockVaultWithRecoveryKey(
        recoveryKeyInput.trim(),
        vaultData.recoveryEncryptedVaultKey,
        vaultData.recoverySalt,
        vaultData.recoveryIv
      );

      // Store vault key in memory only (not sessionStorage - XSS protection)
      unlockVault(vaultKeyHex);

      // Create httpOnly session cookie via Firebase Admin
      const user = auth.currentUser;
      const idToken = user ? await user.getIdToken() : null;
      if (idToken) {
        console.log("🍪 Creating secure session cookie...");
        await fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        });
      }

      setStep("success");
      router.push("/dashboard");
    } catch (err: any) {
      console.error("Recovery key error:", err);
      setError("Invalid recovery key. Please check and try again.");
    }
  }

  function handleCopyRecoveryKey() {
    navigator.clipboard.writeText(recoveryKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleRecoveryKeyContinue() {
    // Create httpOnly session cookie via Firebase Admin
    const user = auth.currentUser;
    const idToken = user ? await user.getIdToken() : null;
    if (idToken) {
      console.log("🍪 Creating secure session cookie...");
      await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
    }

    setStep("success");
    router.push("/dashboard");
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  // Checking auth state
  if (step === "checking") {
    return (
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">⏳</div>
          <p className="text-muted-foreground">Checking authentication...</p>
        </div>
      </main>
    );
  }

  // Main login UI
  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
            <span className="text-3xl">🤫</span>
          </div>
          <h1 className="text-2xl font-bold">Welcome to Hushh</h1>
          <p className="text-muted-foreground">
            Consent protocol enforced. No loose ends. Hushh'ed.
          </p>
        </div>

        {/* Main Card */}
        <Card variant="none" effect="glass">
          <CardContent className="p-6 space-y-4">
            {/* Error Alert */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Step: Ready - Show login button */}
            {step === "ready" && (
              <>
                <Button
                  variant="gradient"
                  effect="glass"
                  size="lg"
                  className="w-full"
                  onClick={handleGoogleLogin}
                  showRipple
                >
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Continue with Google
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  Your vault is protected by a master passphrase
                </p>
              </>
            )}

            {/* Step: OAuth Loading */}
            {step === "oauth_loading" && (
              <div className="text-center py-8">
                <div className="relative mx-auto w-16 h-16 mb-4">
                  <div className="absolute inset-0 rounded-full bg-linear-to-br from-blue-500 to-purple-600 opacity-20 animate-pulse" />
                  <div className="absolute inset-2 rounded-full bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 text-white animate-spin" />
                  </div>
                </div>
                <p className="text-muted-foreground">Verifying identity...</p>
              </div>
            )}

            {/* Step: Create Passphrase */}
            {step === "passphrase_create" && (
              <div className="space-y-4">
                <div className="text-center">
                  <Lock className="h-8 w-8 mx-auto text-primary mb-2" />
                  <h3 className="font-semibold">
                    Create Your Vault Passphrase
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    This passphrase encrypts your data. We never see it.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="passphrase">Passphrase</Label>
                  <Input
                    id="passphrase"
                    type="password"
                    placeholder="Enter a strong passphrase"
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirm Passphrase</Label>
                  <Input
                    id="confirm"
                    type="password"
                    placeholder="Re-enter passphrase"
                    value={confirmPassphrase}
                    onChange={(e) => setConfirmPassphrase(e.target.value)}
                  />
                </div>
                <Button
                  variant="gradient"
                  effect="glass"
                  className="w-full"
                  onClick={handleCreatePassphrase}
                >
                  Create Vault
                </Button>
              </div>
            )}

            {/* Step: Unlock Passphrase */}
            {step === "passphrase_unlock" && (
              <div className="space-y-4">
                <div className="text-center">
                  <Lock className="h-8 w-8 mx-auto text-primary mb-2" />
                  <h3 className="font-semibold">Unlock Your Vault</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Enter your passphrase to decrypt your data
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unlock-passphrase">Passphrase</Label>
                  <Input
                    id="unlock-passphrase"
                    type="password"
                    placeholder="Enter your passphrase"
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && handleUnlockPassphrase()
                    }
                    autoFocus
                  />
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    variant="none"
                    effect="glass"
                    className="flex-1 order-2 sm:order-1"
                    onClick={() => setStep("recovery_key_input")}
                  >
                    Use Recovery Key
                  </Button>
                  <Button
                    variant="gradient"
                    effect="fill"
                    className="flex-1 text-white order-1 sm:order-2"
                    onClick={handleUnlockPassphrase}
                  >
                    Unlock
                  </Button>
                </div>
              </div>
            )}

            {/* Step: Recovery Key Input (Fallback) */}
            {step === "recovery_key_input" && (
              <div className="space-y-4">
                <div className="text-center">
                  <Key className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <h3 className="font-semibold">Enter Recovery Key</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Enter your recovery key to unlock your vault
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recovery-key">Recovery Key</Label>
                  <Input
                    id="recovery-key"
                    placeholder="HRK-XXXX-XXXX-XXXX-XXXX"
                    value={recoveryKeyInput}
                    onChange={(e) =>
                      setRecoveryKeyInput(e.target.value.toUpperCase())
                    }
                    className="font-mono"
                  />
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    variant="none"
                    effect="glass"
                    className="flex-1 order-2 sm:order-1"
                    onClick={() => setStep("passphrase_unlock")}
                  >
                    Use Passphrase
                  </Button>
                  <Button
                    variant="gradient"
                    effect="fill"
                    className="flex-1 text-white order-1 sm:order-2"
                    onClick={handleRecoveryKeySubmit}
                  >
                    Unlock
                  </Button>
                </div>
              </div>
            )}

            {/* Step: Success */}
            {step === "success" && (
              <div className="text-center py-4">
                <div className="text-4xl mb-4">✅</div>
                <p className="text-muted-foreground">
                  Vault unlocked, redirecting...
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Security Features */}
        <Card variant="none" effect="glass" className="bg-muted/30">
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Shield className="h-4 w-4 text-green-500" />
                <span>End-to-end encrypted vault</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Lock className="h-4 w-4 text-blue-500" />
                <span>PBKDF2 + AES-256-GCM encryption</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Key className="h-4 w-4 text-purple-500" />
                <span>Zero-knowledge architecture</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recovery Key Dialog (New User) */}
      <Dialog open={step === "recovery_key_show"} onOpenChange={() => {}}>
        <DialogContent
          className="sm:max-w-md"
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Key className="h-6 w-6 text-amber-500" />
              <DialogTitle>Save Your Recovery Key</DialogTitle>
            </div>
            <DialogDescription>
              This is the ONLY way to recover your vault if you forget your
              passphrase. Store it somewhere safe!
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Alert className="bg-amber-500/10 border-amber-500/50">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              <AlertDescription className="text-amber-700 dark:text-amber-300">
                Write this down or save it securely. You cannot recover it
                later!
              </AlertDescription>
            </Alert>

            <div className="p-4 bg-muted rounded-lg border-2 border-dashed">
              <code className="text-lg font-mono font-bold tracking-wide">
                {recoveryKey}
              </code>
            </div>

            <div className="flex gap-2">
              <Button
                variant="none"
                className="flex-1 border border-gray-200 dark:border-gray-700"
                onClick={handleCopyRecoveryKey}
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-2 text-green-500" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </>
                )}
              </Button>
              <Button
                variant="none"
                className="flex-1 border border-gray-200 dark:border-gray-700"
                onClick={() => {
                  const blob = new Blob(
                    [
                      `Hushh Recovery Key\n\n${recoveryKey}\n\nStore this file securely. This is the ONLY way to recover your vault if you forget your passphrase.`,
                    ],
                    { type: "text/plain" }
                  );
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "hushh-recovery-key.txt";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="gradient"
              effect="glass"
              className="w-full"
              onClick={handleRecoveryKeyContinue}
            >
              I've Saved My Recovery Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
