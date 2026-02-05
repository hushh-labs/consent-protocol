"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent } from "@/lib/morphy-ux/morphy";
import {
  Lock,
  Loader2,
  AlertCircle,
  Key,
  Check,
  Copy,
  Download,
  Shield,
  ArrowRight
} from "lucide-react";
import { VaultService } from "@/lib/services/vault-service";
import { downloadTextFile } from "@/lib/utils/native-download";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { User } from "firebase/auth";

import { useVault } from "@/lib/vault/vault-context";
import { HushhLoader } from "@/components/ui/hushh-loader";

type VaultStep = "checking" | "intro" | "create" | "unlock" | "recovery" | "success";

interface VaultFlowProps {
  user: User;
  onSuccess: () => void;
  // Callback to inform parent about current step (e.g. to hide headers)
  onStepChange?: (step: VaultStep) => void;
}

export function VaultFlow({ user, onSuccess, onStepChange }: VaultFlowProps) {
  const [step, setStep] = useState<VaultStep>("checking");
  const [error, setError] = useState<string | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [recoveryKey, setRecoveryKey] = useState<string>("");
  const [recoveryKeyInput, setRecoveryKeyInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);

  const { unlockVault } = useVault();

  // Notify parent of step changes
  useEffect(() => {
    onStepChange?.(step);
  }, [step, onStepChange]);

  // Initial Vault Status Check
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const hasVault = await VaultService.checkVault(user.uid);
        setStep(hasVault ? "unlock" : "intro");
      } catch (err) {
        console.error("Vault status check failed:", err);
        setError("Failed to check vault status. Please retry.");
      }
    };
    checkStatus();
  }, [user.uid]);

  const handleCreatePassphrase = async () => {
    if (passphrase.length < 8) {
      toast.error("Passphrase must be at least 8 characters");
      return;
    }
    if (passphrase !== confirmPassphrase) {
      toast.error("Passphrases do not match");
      return;
    }

    setIsUnlocking(true);
    try {
      setError(null);
      // 1. Generate encrypted vault data
      const vaultData = await VaultService.createVault(passphrase);

      // 2. Save to backend
      await VaultService.setupVault(user.uid, {
        ...vaultData,
        authMethod: "passphrase",
      });

      VaultService.setVaultCheckCache(user.uid, true);
      setRecoveryKey(vaultData.recoveryKey);
      setStep("recovery"); // Show recovery key dialog
    } catch (err: any) {
      console.error("Create vault error:", err);
      toast.error(err.message || "Failed to create vault");
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleUnlockPassphrase = async () => {
    setIsUnlocking(true);
    try {
      setError(null);
      const vaultData = await VaultService.getVault(user.uid);
      const decryptedKey = await VaultService.unlockVault(
        passphrase,
        vaultData.encryptedVaultKey,
        vaultData.salt,
        vaultData.iv
      );

      if (decryptedKey) {
        // Request VAULT_OWNER consent token (unified path)
        try {
          const { token, expiresAt } =
            await VaultService.getOrIssueVaultOwnerToken(user.uid);

          VaultService.setVaultCheckCache(user.uid, true);
          // Unlock vault with key + token
          unlockVault(decryptedKey, token, expiresAt);

          // Persist user_id for downstream pages (Food, Professional, Consents)
          localStorage.setItem("user_id", user.uid);
          sessionStorage.setItem("user_id", user.uid);
          setStep("success");
          setTimeout(onSuccess, 1000);
        } catch (tokenError: any) {
          console.error("Failed to issue VAULT_OWNER token:", tokenError);
          toast.error(
            "Vault unlocked but failed to issue access token. Please try again."
          );
        }
      } else {
        toast.error("Invalid passphrase");
      }
    } catch (err: any) {
      console.error("Unlock error:", err);
      toast.error("Invalid passphrase or failed to unlock");
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleRecoveryKeySubmit = async () => {
    setIsUnlocking(true);
    try {
      setError(null);
      const vaultData = await VaultService.getVault(user.uid);
      const decryptedKey = await VaultService.unlockVaultWithRecoveryKey(
        recoveryKeyInput,
        vaultData.recoveryEncryptedVaultKey,
        vaultData.recoverySalt,
        vaultData.recoveryIv
      );

      if (decryptedKey) {
        // Request VAULT_OWNER consent token (unified path)
        try {
          const { token, expiresAt } =
            await VaultService.getOrIssueVaultOwnerToken(user.uid);

          VaultService.setVaultCheckCache(user.uid, true);
          // Unlock vault with key + token
          unlockVault(decryptedKey, token, expiresAt);

          // Persist user_id for downstream pages
          localStorage.setItem("user_id", user.uid);
          sessionStorage.setItem("user_id", user.uid);
          setStep("success");
          setTimeout(onSuccess, 1000);
        } catch (tokenError: any) {
          console.error("Failed to issue VAULT_OWNER token:", tokenError);
          toast.error(
            "Vault unlocked but failed to issue access token. Please try again."
          );
        }
      } else {
        toast.error("Invalid recovery key");
      }
    } catch (err: any) {
      console.error("Recovery error:", err);
      toast.error("Invalid recovery key or failed to recover");
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleCopyRecoveryKey = () => {
    navigator.clipboard.writeText(recoveryKey);
    setCopied(true);
    toast.success("Recovery key copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRecoveryKeyContinue = async () => {
    try {
      // Auto-unlock now that unique key is saved
      const vaultData = await VaultService.getVault(user.uid);
      const decryptedKey = await VaultService.unlockVault(
        passphrase,
        vaultData.encryptedVaultKey,
        vaultData.salt,
        vaultData.iv
      );

      if (decryptedKey) {
        // Request VAULT_OWNER consent token (unified path)
        try {
          const { token, expiresAt } =
            await VaultService.getOrIssueVaultOwnerToken(user.uid);

          VaultService.setVaultCheckCache(user.uid, true);
          // Unlock vault with key + token
          unlockVault(decryptedKey, token, expiresAt);

          // Persist user_id for downstream pages
          localStorage.setItem("user_id", user.uid);
          sessionStorage.setItem("user_id", user.uid);
        } catch (tokenError: any) {
          console.error("Failed to issue VAULT_OWNER token:", tokenError);
          // Fall through to success anyway, user can retry unlock if needed
        }
      }
    } catch (err) {
      console.error("Auto-unlock after creation failed", err);
      // Fall through to success anyway, user can unlock manually if needed
    }

    // Always persist user_id after vault creation
    localStorage.setItem("user_id", user.uid);
    sessionStorage.setItem("user_id", user.uid);
    setStep("success");
    setTimeout(onSuccess, 1000);
  };

  if (step === "checking") {
    if (error) {
      return (
        <Card variant="none" effect="glass">
          <CardContent className="p-6 text-center py-8">
            <div className="space-y-4">
              <div className="text-destructive mb-2">
                <AlertCircle className="h-8 w-8 mx-auto" />
              </div>
              <p className="text-muted-foreground">{error}</p>
              <Button
                onClick={() => window.location.reload()}
                variant="none"
                className="border border-input bg-background hover:bg-accent hover:text-accent-foreground"
              >
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    return <HushhLoader label="Checking vault status..." />;
  }

  return (
    <>
      <Card variant="none" effect="glass">
        <CardContent className="p-6 space-y-4">
          {/* Intro / Education Step */}
          {step === "intro" && (
            <div className="space-y-6 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex justify-center mb-4">
                <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Shield className="h-10 w-10 text-primary" />
                </div>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-2xl font-bold tracking-tight">Secure Your Digital Vault</h3>
                <p className="text-muted-foreground text-balance max-w-sm mx-auto">
                  Hushh uses end-to-end encryption to protect your personal data. 
                  Your vault is stored <strong>locally</strong> on this device.
                </p>
              </div>

              <div className="text-left bg-muted/50 rounded-xl p-4 space-y-3 text-sm border border-border/50">
                <div className="flex gap-3">
                  <div className="mt-0.5 min-w-[1.25rem] text-primary">
                     <Check className="h-5 w-5" />
                  </div>
                  <p><span className="font-semibold block text-foreground">You hold the only key</span> We cannot see your data or reset your password.</p>
                </div>
                <div className="flex gap-3">
                   <div className="mt-0.5 min-w-[1.25rem] text-primary">
                     <Check className="h-5 w-5" />
                  </div>
                  <p><span className="font-semibold block text-foreground">Local First</span> Encryption happens on your device, not on our servers.</p>
                </div>
              </div>

              <Button 
                variant="gradient" 
                size="xl" 
                fullWidth
                onClick={() => setStep("create")}
                className="group"
              >
                I Understand, Create Vault
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>
            </div>
          )}

          {/* Create Passphrase */}
          {step === "create" && (
            <div className="space-y-4">
              <div className="text-center">
                <Lock className="h-12 w-12 mx-auto text-primary mb-4" />
                <h3 className="font-semibold text-xl">Create Your Vault Passphrase</h3>
                <p className="text-base text-muted-foreground mt-2">
                  This passphrase encrypts your data. We never see it.
                </p>
              </div>
              <div className="space-y-3">
                <Label htmlFor="passphrase" className="text-base">Passphrase</Label>
                <Input
                  id="passphrase"
                  type="password"
                  placeholder="Enter a strong passphrase"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  autoFocus
                  className="h-14 text-lg px-4"
                />
              </div>
              <div className="space-y-3">
                <Label htmlFor="confirm" className="text-base">Confirm Passphrase</Label>
                <Input
                  id="confirm"
                  type="password"
                  placeholder="Re-enter passphrase"
                  value={confirmPassphrase}
                  onChange={(e) => setConfirmPassphrase(e.target.value)}
                  className="h-14 text-lg px-4"
                />
              </div>
              <Button
                variant="gradient"
                effect="glass"
                size="xl"
                fullWidth
                className="mt-4"
                onClick={handleCreatePassphrase}
                disabled={isUnlocking || passphrase.length < 8 || passphrase !== confirmPassphrase}
              >
                {isUnlocking ? (
                  <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Creating...</>
                ) : (
                  "Create Vault"
                )}
              </Button>
            </div>
          )}

          {/* Unlock Passphrase */}
          {step === "unlock" && (
            <div className="space-y-4">
              <div className="text-center">
                <Lock className="h-12 w-12 mx-auto text-primary mb-4" />
                <h3 className="font-semibold text-xl">Unlock Your Vault</h3>
                <p className="text-base text-muted-foreground mt-2">
                  Enter your passphrase to decrypt your data
                </p>
              </div>
              <div className="space-y-3">
                <Label htmlFor="unlock-passphrase" className="text-base">Passphrase</Label>
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
                  className="h-14 text-lg px-4"
                />
              </div>
              <div className="flex flex-col gap-3 pt-2">
                <Button
                  variant="gradient"
                  effect="glass"
                  size="xl"
                  fullWidth
                  className="text-lg font-semibold"
                  onClick={handleUnlockPassphrase}
                  disabled={isUnlocking || !passphrase}
                >
                  {isUnlocking ? (
                    <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Unlocking...</>
                  ) : (
                    "Unlock"
                  )}
                </Button>
                <Button
                  variant="none"
                  effect="glass"
                  size="xl"
                  fullWidth
                  className="text-base"
                  onClick={() => setStep("recovery")}
                  disabled={isUnlocking}
                >
                  Use Recovery Key
                </Button>
              </div>
            </div>
          )}

          {/* Recovery Key Input */}
          {step === "recovery" && !recoveryKey && (
            <div className="space-y-4">
              <div className="text-center">
                <Key className="h-12 w-12 mx-auto text-primary mb-4" />
                <h3 className="font-semibold text-xl">Enter Recovery Key</h3>
                <p className="text-base text-muted-foreground mt-2">
                  Enter your recovery key to unlock your vault
                </p>
              </div>
              <div className="space-y-3">
                <Label htmlFor="recovery-key" className="text-base">Recovery Key</Label>
                <Input
                  id="recovery-key"
                  placeholder="HRK-XXXX-XXXX-XXXX-XXXX"
                  value={recoveryKeyInput}
                  onChange={(e) =>
                    setRecoveryKeyInput(e.target.value.toUpperCase())
                  }
                  className="h-14 text-lg px-4 font-mono"
                />
              </div>
              <div className="flex flex-col gap-3 pt-2">
                <Button
                  variant="gradient"
                  effect="glass"
                  size="xl"
                  fullWidth
                  className="text-lg font-semibold"
                  onClick={handleRecoveryKeySubmit}
                  disabled={isUnlocking || !recoveryKeyInput}
                >
                  {isUnlocking ? (
                    <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Unlocking...</>
                  ) : (
                    "Unlock"
                  )}
                </Button>
                <Button
                  variant="none"
                  effect="glass"
                  size="xl"
                  fullWidth
                  className="text-base"
                  onClick={() => setStep("unlock")}
                  disabled={isUnlocking}
                >
                  Use Passphrase
                </Button>
              </div>
            </div>
          )}

          {/* Success */}
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

      {/* Recovery Key Dialog (New User) */}
      <Dialog
        open={step === "recovery" && !!recoveryKey}
        onOpenChange={() => {}}
      >
        <DialogContent
          className="sm:max-w-md"
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Key className="h-6 w-6 text-orange-500" />
              <DialogTitle>Save Your Recovery Key</DialogTitle>
            </div>
            <DialogDescription>
              This is the ONLY way to recover your vault if you forget your
              passphrase. Store it somewhere safe!
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Alert className="bg-orange-500/10 border-orange-500/50">
              <AlertCircle className="h-4 w-4 text-orange-500" />
              <AlertDescription className="text-orange-700 dark:text-orange-300">
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
                onClick={async () => {
                  const content = `Hushh Recovery Key\n\n${recoveryKey}\n\nStore this file securely. This is the ONLY way to recover your vault if you forget your passphrase.`;
                  await downloadTextFile(content, "hushh-recovery-key.txt");
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
    </>
  );
}
