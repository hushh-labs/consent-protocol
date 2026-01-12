"use client";

/**
 * Kai Onboarding Page
 *
 * Objectives:
 * - Introduce Kai (Zero-Knowledge Financial Agent)
 * - Explain Privacy Model (Hushh Vault)
 * - Get User Preferences (Risk Profile, Processing Mode)
 * - Stores new preferences to DB (Encrypted)
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  Shield,
  Lock,
  Cpu,
  Cloud,
  ArrowRight,
  Check,
  Scale,
  TrendingUp,
  Sparkles,
  AlertTriangle,
  LineChart,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/firebase/auth-context";
import { useVault } from "@/lib/vault/vault-context";
import { HushhVault } from "@/lib/capacitor";
import {
  storePreferences,
  getPreferences,
  grantKaiConsent,
} from "@/lib/services/kai-service";
import { hasValidConsent, ProcessingMode, RiskProfile } from "./actions";
import { InvestorDetectStep } from "@/components/kai/investor-detect-step";
import {
  IdentityService,
  InvestorProfile,
} from "@/lib/services/identity-service";
import { HushhLoader } from "@/components/ui/hushh-loader";

// ============================================================================
// TYPES & STATE
// ============================================================================

type Step =
  | "investor_detect"
  | "welcome"
  | "mode"
  | "risk"
  | "consent"
  | "ready"
  | "dashboard";

interface OnboardingState {
  step: Step;
  processingMode: ProcessingMode;
  riskProfile: RiskProfile;
  confirmedInvestor?: InvestorProfile;
}

export default function KaiOnboarding() {
  const router = useRouter();
  const { user } = useAuth();
  const { isVaultUnlocked, vaultKey, vaultOwnerToken } = useVault();

  const [state, setState] = useState<OnboardingState>({
    step: "investor_detect", // Start with investor detection
    processingMode: "hybrid",
    riskProfile: "balanced",
  });

  const [loading, setLoading] = useState(false);
  const [checkingDb, setCheckingDb] = useState(true);

  // Check for existing preferences on mount (SKIP onboarding if found)
  useEffect(() => {
    async function checkExistingUser() {
      if (!user?.uid || !vaultKey) {
        // If user or vaultKey is not available yet, wait for next render
        // This can happen if auth or vault context is still loading
        return;
      }

      try {
        // Fetch saved preferences from backend
        const { preferences } = await getPreferences(user.uid);

        if (preferences && preferences.length > 0) {
          console.log("[Kai] Found existing preferences, auto-completing.");

          // Decrypt and save to sessionStorage
          for (const pref of preferences) {
            const decryptedResult = await HushhVault.decryptData({
              keyHex: vaultKey,
              payload: {
                ciphertext: pref.ciphertext,
                iv: pref.iv,
                tag: pref.tag || "",
                encoding: "base64",
                algorithm: "aes-256-gcm",
              },
            });

            if (pref.field_name === "kai_risk_profile") {
              sessionStorage.setItem(
                "kai_risk_profile",
                decryptedResult.plaintext
              );
            } else if (pref.field_name === "kai_processing_mode") {
              sessionStorage.setItem(
                "kai_processing_mode",
                decryptedResult.plaintext
              );
            }
          }

          // ✅ Auto-grant consent if not already granted
          const hasConsent = await hasValidConsent("agent.kai.analyze");
          if (!hasConsent) {
            console.log("[Kai] Auto-granting consent for existing user...");
            const consentResponse = await grantKaiConsent(user.uid, [
              "vault.read.risk_profile",
              "vault.write.decision",
              "agent.kai.analyze",
            ]);

            // SAVE the token!
            const storageData = {
              tokens: {
                "agent.kai.analyze":
                  consentResponse.token ||
                  (consentResponse as any).tokens?.["agent.kai.analyze"],
              },
              expires_at: consentResponse.expires_at,
            };

            const { Preferences } = await import("@capacitor/preferences");
            await Preferences.set({
              key: "kai_consent_tokens",
              value: JSON.stringify(storageData),
            });
          }

          // Show Dashboard instead of auto-redirect
          // router.push("/dashboard/kai/analysis");
          setState((prev) => ({ ...prev, step: "dashboard" }));
        } else {
          console.log("[Kai] No preferences found. Showing onboarding.");
        }
      } catch (error) {
        console.error("[Kai] Error checking existing preferences:", error);
        // If 404 or empty, just proceed with onboarding
        console.log(
          "[Kai] New user or no prefs found. Proceeding with onboarding."
        );
      } finally {
        setCheckingDb(false);
      }
    }

    checkExistingUser();
  }, [user, router, vaultKey]); // Added vaultKey to dependencies

  // IMPORTANT: VAULT_OWNER token is issued during vault unlock (VaultFlow) and stored in vault-context.
  // Do not re-issue tokens here; use the single source of truth: `useVault().vaultOwnerToken`.

  if (checkingDb) {
    return (
      <HushhLoader
        variant="fullscreen"
        label="Checking Kai status..."
        className="bg-zinc-50 dark:bg-zinc-950"
      />
    );
  }

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const nextStep = (step: Step) => {
    setState((prev) => ({ ...prev, step }));
  };

  // Handler for investor detection confirmation
  const handleInvestorConfirm = async (investor: InvestorProfile) => {
    setState((prev) => ({ ...prev, confirmedInvestor: investor }));

    // Pre-populate risk profile from investor data if available
    if (investor.risk_tolerance) {
      const mappedRisk = investor.risk_tolerance as RiskProfile;
      if (["conservative", "balanced", "aggressive"].includes(mappedRisk)) {
        setState((prev) => ({ ...prev, riskProfile: mappedRisk }));
      }
    }

    toast.success("Investor profile loaded!");
    nextStep("welcome");
  };

  // Handler for skipping investor detection
  const handleInvestorSkip = () => {
    nextStep("welcome");
  };

  const handleStart = () => nextStep("mode");

  const handleModeSelect = (mode: ProcessingMode) => {
    setState((prev) => ({ ...prev, processingMode: mode }));
    nextStep("risk");
  };

  const handleRiskSelect = (profile: RiskProfile) => {
    setState((prev) => ({ ...prev, riskProfile: profile }));
    nextStep("consent");
  };

  const handleProceed = async () => {
    if (!user?.uid) return;

    // REQUIRE UNLOCKED VAULT
    if (!isVaultUnlocked || !vaultKey) {
      toast.error("Your Vault must be unlocked to save secure preferences.");
      return;
    }

    setLoading(true);
    try {
      // 1. Grant Consent (Get Token) - using native plugin
      const consentResponse = await grantKaiConsent(user.uid, [
        "vault.read.risk_profile",
        "vault.write.decision",
        "agent.kai.analyze",
      ]);

      console.log("[Kai] Consent granted:", consentResponse);

      // Store in Preferences (mobile-compatible) instead of sessionStorage
      const storageData = {
        tokens: {
          "agent.kai.analyze": consentResponse.token,
        },
        expires_at: consentResponse.expires_at,
      };

      // Use Capacitor Preferences for mobile compatibility
      const { Preferences } = await import("@capacitor/preferences");
      await Preferences.set({
        key: "kai_consent_tokens",
        value: JSON.stringify(storageData),
      });

      // 2. Encrypt Preferences
      const encRisk = await HushhVault.encryptData({
        keyHex: vaultKey,
        plaintext: state.riskProfile,
      });

      const encMode = await HushhVault.encryptData({
        keyHex: vaultKey,
        plaintext: state.processingMode,
      });

      // Canonical backend contract: `preferences: EncryptedPreference[]`
      const preferences = [
        {
          field_name: "kai_risk_profile",
          ciphertext: encRisk.ciphertext,
          iv: encRisk.iv,
          tag: encRisk.tag,
        },
        {
          field_name: "kai_processing_mode",
          ciphertext: encMode.ciphertext,
          iv: encMode.iv,
          tag: encMode.tag,
        },
      ];

      // 3. Store in DB
      await storePreferences(user.uid, preferences);

      // 4. Update Session Storage (for immediate use)
      sessionStorage.setItem("kai_risk_profile", state.riskProfile);
      sessionStorage.setItem("kai_processing_mode", state.processingMode);

      console.log("[Kai] Setup complete, preferences stored encrypted.");
      toast.success("Preferences saved securely to your Vault.");
      nextStep("ready");
    } catch (error: any) {
      console.error("Failed to setup:", error);
      // Check for fetch failure which usually means CORS or server down
      if (error.message?.includes("Failed to fetch")) {
        toast.error("Could not connect to Kai Backend. Is the server running?");
      } else {
        toast.error("Failed to save preferences. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = () => {
    router.push("/dashboard/kai/analysis");
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="p-6 flex items-center justify-center w-full relative overflow-hidden">
      {/* 
          Standard Design System Background is 'morphy-app-bg' 
          No extra blob divs required.
      */}

      <div className="relative z-10 w-full max-w-2xl">
        {state.step !== "dashboard" && (
          <StepIndicator currentStep={state.step} />
        )}

        <div className="mt-8 transition-all duration-500 ease-in-out">
          {state.step === "investor_detect" && vaultKey && vaultOwnerToken && (
            <InvestorDetectStep
              onConfirm={handleInvestorConfirm}
              onSkip={handleInvestorSkip}
              vaultKey={vaultKey}
              vaultOwnerToken={vaultOwnerToken}
            />
          )}
          {state.step === "investor_detect" &&
            (!vaultKey || !vaultOwnerToken) && (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  Please unlock your vault first...
                </p>
              </div>
            )}
          {state.step === "welcome" && (
            <WelcomeStep onStart={handleStart} loading={loading} />
          )}
          {state.step === "mode" && (
            <ModeStep onSelect={handleModeSelect} loading={loading} />
          )}
          {state.step === "risk" && (
            <RiskStep onSelect={handleRiskSelect} loading={loading} />
          )}
          {state.step === "consent" && (
            <ConsentStep
              onProceed={handleProceed}
              loading={loading}
              isVaultUnlocked={isVaultUnlocked}
            />
          )}
          {state.step === "ready" && <ReadyStep onComplete={handleComplete} />}
          {state.step === "dashboard" && <DashboardStep />}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function StepIndicator({ currentStep }: { currentStep: Step }) {
  const steps: Step[] = [
    "investor_detect",
    "welcome",
    "mode",
    "risk",
    "consent",
    "ready",
  ];
  const current = steps.indexOf(currentStep);

  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((s, i) => (
        <div
          key={s}
          className={`h-2 rounded-full transition-all duration-500 ${
            i < current
              ? "w-8 bg-linear-to-r from-blue-500 to-purple-500"
              : i === current
              ? "w-8 bg-linear-to-r from-blue-500/50 to-purple-500/50"
              : "w-2 bg-zinc-200 dark:bg-zinc-800"
          }`}
        />
      ))}
    </div>
  );
}

function WelcomeStep({
  onStart,
  loading,
}: {
  onStart: () => void;
  loading: boolean;
}) {
  return (
    <Card className="glass-interactive border-0 shadow-2xl">
      <CardHeader className="text-center pb-2">
        <div className="mx-auto w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-4 text-blue-500">
          <Sparkles size={32} />
        </div>
        <CardTitle className="text-3xl font-bold bg-clip-text text-transparent bg-linear-to-r from-blue-600 to-purple-600 p-1">
          Your Personal Investment Committee
        </CardTitle>
        <CardDescription className="text-lg mt-2">
          Three specialist agents. Debate-driven analysis. Privacy first.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6 pt-6">
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 text-sm flex items-start gap-3">
          <AlertTriangle className="shrink-0 w-5 h-5 text-amber-500" />
          <div className="space-y-2">
            <p className="font-semibold">Educational Tool Only</p>
            <p className="opacity-90">
              Kai is not an investment advisor. It does not manage portfolios or
              execute trades. Always consult a professional before making
              financial decisions.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex flex-col items-center text-center p-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-2 text-blue-500">
              <Shield size={20} />
            </div>
            <h4 className="font-semibold text-sm">Privacy First</h4>
            <p className="text-xs text-muted-foreground mt-1">
              Your data stays in your vault.
            </p>
          </div>
          <div className="flex flex-col items-center text-center p-3">
            <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-2 text-purple-500">
              <Scale size={20} />
            </div>
            <h4 className="font-semibold text-sm">Balanced Debate</h4>
            <p className="text-xs text-muted-foreground mt-1">
              Agents challenge each other.
            </p>
          </div>
          <div className="flex flex-col items-center text-center p-3">
            <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-2 text-green-500">
              <Check size={20} />
            </div>
            <h4 className="font-semibold text-sm">Explainable</h4>
            <p className="text-xs text-muted-foreground mt-1">
              Real receipts, no black boxes.
            </p>
          </div>
        </div>
      </CardContent>

      <CardFooter>
        <Button
          className="w-full bg-linear-to-r from-blue-600 to-purple-600 hover:opacity-90 transition-opacity"
          size="lg"
          onClick={onStart}
          disabled={loading}
        >
          {loading ? "Initializing..." : "Get Started"}
          {!loading && <ArrowRight className="ml-2 w-4 h-4" />}
        </Button>
      </CardFooter>
    </Card>
  );
}

function ModeStep({
  onSelect,
  loading,
}: {
  onSelect: (m: ProcessingMode) => void;
  loading: boolean;
}) {
  return (
    <Card className="glass-interactive border-0 shadow-2xl">
      <CardHeader>
        <CardTitle>Processing Mode</CardTitle>
        <CardDescription>
          How should Kai handle your financial data?
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {/* On-Device Option (Disabled) */}
        <button
          onClick={() => onSelect("on_device")}
          disabled={true}
          className="relative text-left p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 opacity-50 cursor-not-allowed pointer-events-none"
        >
          <div className="flex justify-between items-start mb-2">
            <Cpu className="text-zinc-500" size={24} />
            <span className="text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-full text-zinc-500">
              Coming Soon
            </span>
          </div>
          <h3 className="font-semibold">On-Device Only</h3>
          <p className="text-sm text-zinc-500 mt-1">
            Data never leaves your device. Maximum privacy.
          </p>
        </button>

        {/* Hybrid Option (Active) */}
        <button
          onClick={() => onSelect("hybrid")}
          className="relative text-left p-4 rounded-xl border-2 border-primary/50 hover:border-primary bg-primary/5 transition-all cursor-pointer"
        >
          <div className="flex justify-between items-start mb-2">
            <Cloud className="text-primary" size={24} />
            <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">
              Recommended
            </span>
          </div>
          <h3 className="font-semibold text-primary">Hybrid Cloud</h3>
          <p className="text-sm text-foreground/80 mt-1">
            Anonymized data is processed securely in the cloud. Faster results
            with live market data.
          </p>
        </button>
      </CardContent>
    </Card>
  );
}

function RiskStep({
  onSelect,
  loading,
}: {
  onSelect: (r: RiskProfile) => void;
  loading: boolean;
}) {
  const profiles: {
    id: RiskProfile;
    icon: any;
    title: string;
    desc: string;
  }[] = [
    {
      id: "conservative",
      icon: Shield,
      title: "Conservative",
      desc: "Prioritize preservation. Low volatility assets.",
    },
    {
      id: "balanced",
      icon: Scale,
      title: "Balanced",
      desc: "Mix of growth and stability. Moderate risk.",
    },
    {
      id: "aggressive",
      icon: TrendingUp,
      title: "Growth",
      desc: "Maximize returns. Higher volatility tolerance.",
    },
  ];

  return (
    <Card className="glass-interactive border-0 shadow-2xl">
      <CardHeader>
        <CardTitle>Risk Profile</CardTitle>
        <CardDescription>
          Tailor Kai's recommendations to your style.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {profiles.map(({ id, icon: Icon, title, desc }) => (
          <button
            key={id}
            onClick={() => onSelect(id)}
            className="w-full text-left p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-primary/50 hover:bg-primary/5 transition-all flex items-center gap-4 group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center group-hover:bg-primary/20 group-hover:text-primary transition-colors">
              <Icon size={20} />
            </div>
            <div>
              <h3 className="font-semibold">{title}</h3>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </div>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

function ConsentStep({
  onProceed,
  loading,
  isVaultUnlocked,
}: {
  onProceed: () => void;
  loading: boolean;
  isVaultUnlocked: boolean;
}) {
  return (
    <Card className="glass-interactive border-0 shadow-2xl">
      <CardHeader>
        <CardTitle>Permissions</CardTitle>
        <CardDescription>Review what Kai needs to operate.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-2">
              <Check className="text-green-500 w-5 h-5 shrink-0" />
              <span>
                <strong>Read Risk Profile:</strong> To verify your investment
                preferences.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="text-green-500 w-5 h-5 shrink-0" />
              <span>
                <strong>Write Decisions:</strong> To save analysis results to
                your protected Vault.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="text-green-500 w-5 h-5 shrink-0" />
              <span>
                <strong>Perform Analysis:</strong> To execute financial models
                on your behalf.
              </span>
            </li>
          </ul>
        </div>

        {!isVaultUnlocked && (
          <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-lg text-amber-600 dark:text-amber-400 text-sm flex items-center gap-2">
            <Lock size={16} />
            <span>Please unlock your Vault (Sidebar) to proceed.</span>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button
          className="w-full"
          disabled={loading || !isVaultUnlocked}
          onClick={onProceed}
        >
          {loading ? "Encrypting & Saving..." : "Proceed"}
        </Button>
      </CardFooter>
    </Card>
  );
}

function ReadyStep({ onComplete }: { onComplete: () => void }) {
  return (
    <Card className="glass-interactive border-0 shadow-2xl text-center">
      <CardContent className="pt-8 pb-8 space-y-4">
        <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto text-green-500">
          <Sparkles size={40} />
        </div>
        <div>
          <h2 className="text-2xl font-bold">You're All Set!</h2>
          <p className="text-zinc-500 mt-2">
            Kai is ready to analyze the market for you.
          </p>
        </div>
      </CardContent>
      <CardFooter className="justify-center pb-8">
        <Button
          onClick={onComplete}
          size="lg"
          className="w-full max-w-xs bg-green-600 hover:bg-green-700"
        >
          Start Analysis
        </Button>
      </CardFooter>
    </Card>
  );
}

function DashboardStep() {
  return (
    <div className="space-y-6 w-full max-w-2xl mx-auto">
      <div className="text-center space-y-3 mb-8">
        <div className="flex justify-center gap-2 mb-1">
          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 font-semibold uppercase tracking-wider">
            Hushh Technologies
          </span>
        </div>
        <h1 className="text-3xl font-black tracking-tighter uppercase">
          Investment <span className="text-primary">Committee</span>
        </h1>
        <p className="text-muted-foreground font-medium text-sm">
          Decide like a committee. Carry it in your pocket.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href="/dashboard/kai/analysis" className="block group">
          <Card className="h-full glass-interactive border-primary/20 hover:border-primary/50 transition-all hover:scale-[1.02] shadow-sm hover:shadow-xl">
            <CardHeader>
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-2 group-hover:bg-primary/20 transition-colors text-primary">
                <LineChart size={24} />
              </div>
              <CardTitle className=" text-lg">Analysis Engine</CardTitle>
              <CardDescription>
                Three specialist agents debate to find the truth. Sources
                included.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-xs font-mono text-muted-foreground bg-background/50 p-2 rounded border border-border/50">
                &gt; Awaiting prompt...
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/dashboard/kai/preferences" className="block group">
          <Card className="h-full glass-interactive border-border/50 hover:border-primary/50 transition-all hover:scale-[1.02] shadow-sm hover:shadow-xl">
            <CardHeader>
              <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-2 group-hover:bg-zinc-200 dark:group-hover:bg-zinc-700 transition-colors">
                <Settings size={24} />
              </div>
              <CardTitle className="text-lg">Agent Settings</CardTitle>
              <CardDescription>
                Calibrate your Risk Persona and Privacy Model.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-xs font-mono text-muted-foreground bg-background/50 p-2 rounded border border-border/50">
                &gt; System calibrated
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
