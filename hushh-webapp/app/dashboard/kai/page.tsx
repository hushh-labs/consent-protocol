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
} from "lucide-react";
import { useAuth } from "@/lib/firebase/auth-context";
import { useVault } from "@/lib/vault/vault-context";
import { HushhVault } from "@/lib/capacitor";
import { grantKaiConsent, hasValidConsent } from "./actions";
import { type ProcessingMode, type RiskProfile } from "./actions";
import { storePreferences, getPreferences } from "@/lib/services/kai-service";

// ============================================================================
// TYPES & STATE
// ============================================================================

type Step = "welcome" | "mode" | "risk" | "consent" | "ready";

interface OnboardingState {
  step: Step;
  processingMode: ProcessingMode;
  riskProfile: RiskProfile;
}

export default function KaiOnboarding() {
  const router = useRouter();
  const { user } = useAuth();
  const { isVaultUnlocked, vaultKey } = useVault();

  const [state, setState] = useState<OnboardingState>({
    step: "welcome",
    processingMode: "hybrid",
    riskProfile: "balanced",
  });

  const [loading, setLoading] = useState(false);
  const [checkingDb, setCheckingDb] = useState(true);

  // Check for existing preferences on mount (SKIP onboarding if found)
  useEffect(() => {
    async function checkExistingUser() {
      if (!user?.uid) return;

      try {
        const { preferences } = await getPreferences(user.uid);
        if (preferences && preferences.length > 0) {
          console.log("[Kai] Found existing preferences, skipping onboarding.");
          router.push("/dashboard/kai/analysis");
        }
      } catch (error) {
        // If 404 or empty, just proceed with onboarding
        console.log(
          "[Kai] New user or no prefs found. Proceeding with onboarding."
        );
      } finally {
        setCheckingDb(false);
      }
    }

    // Also check if we already have consent in session
    const hasConsent = hasValidConsent("agent.kai.analyze");
    if (hasConsent) {
      // We might have consent but checking DB is safer source of truth for "completed" state
    }

    checkExistingUser();
  }, [user, router]);

  if (checkingDb) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-zinc-500 text-sm">Checking Kai status...</p>
        </div>
      </div>
    );
  }

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const nextStep = (step: Step) => {
    setState((prev) => ({ ...prev, step }));
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
      // 1. Grant Consent (Get Tokens)
      const consentGranted = await grantKaiConsent(user.uid, [
        "vault.read.risk_profile",
        "vault.write.decision",
        "agent.kai.analyze", // The crucial permission
      ]);

      if (!consentGranted) throw new Error("Failed to grant consent");

      // 2. Encrypt Preferences
      // We store them in the DB so next time checkingDb finds them
      const encRisk = await HushhVault.encryptData({
        keyHex: vaultKey,
        plaintext: state.riskProfile,
      });

      const encMode = await HushhVault.encryptData({
        keyHex: vaultKey,
        plaintext: state.processingMode,
      });

      // 3. Store in DB
      await storePreferences({
        user_id: user.uid,
        preferences: [
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
        ],
      });

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
    <div className="min-h-screen p-6 flex items-center justify-center relative overflow-hidden">
      {/* 
          Standard Design System Background is 'morphy-app-bg' 
          No extra blob divs required.
      */}

      <div className="relative z-10 w-full max-w-2xl">
        <StepIndicator currentStep={state.step} />

        <div className="mt-8 transition-all duration-500 ease-in-out">
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
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function StepIndicator({ currentStep }: { currentStep: Step }) {
  const steps: Step[] = ["welcome", "mode", "risk", "consent", "ready"];
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
