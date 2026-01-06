"use client";

/**
 * Agent Kai — Production Onboarding
 * Pure CSS transitions, no Framer Motion
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/lib/morphy-ux/morphy";
import {
  ArrowRight,
  Check,
  Shield,
  Cpu,
  Cloud,
  Scale,
  TrendingUp,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/lib/firebase/auth-context";
import {
  grantKaiConsent,
  hasValidConsent,
  type ProcessingMode,
  type RiskProfile,
} from "./actions";

// =============================================================================
// TYPES
// =============================================================================

type OnboardingStep =
  | "welcome"
  | "processing_mode"
  | "risk_profile"
  | "consent"
  | "ready";

interface OnboardingState {
  step: OnboardingStep;
  sessionId: string | null;
  processingMode: ProcessingMode | null;
  riskProfile: RiskProfile | null;
  legalAcknowledged: boolean;
  consentGranted: boolean;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function KaiOnboarding() {
  const router = useRouter();
  const { user } = useAuth();

  const [state, setState] = useState<OnboardingState>({
    step: "welcome",
    sessionId: null, // Will remove this entirely later
    processingMode: null,
    riskProfile: null,
    legalAcknowledged: false,
    consentGranted: false,
  });

  const [loading, setLoading] = useState(false);

  // ✅ Check for existing consent on mount (no session check needed)
  useEffect(() => {
    async function checkExistingConsent() {
      if (!user?.uid) return;

      // Check if user has valid consent tokens
      const hasConsent = hasValidConsent("agent.kai.analyze");

      if (hasConsent) {
        console.log("[Kai] User already has consent, redirecting to analysis");
        router.push("/dashboard/kai/analysis");
      }
    }

    checkExistingConsent();
  }, [user, router]);

  // Steps data
  const steps: OnboardingStep[] = [
    "welcome",
    "processing_mode",
    "risk_profile",
    "consent",
    "ready",
  ];
  const currentStepIndex = steps.indexOf(state.step);

  // Navigation handlers
  const handleNext = async () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      const nextStep = steps[nextIndex];
      if (nextStep) {
        setState((prev) => ({ ...prev, step: nextStep }));
      }
    }
  };

  // Start onboarding (no session creation needed!)
  const handleStart = () => {
    console.log("[Kai] Starting onboarding - no session needed");
    handleNext();
  };

  // Mode selection (no session update needed)
  const handleModeSelect = (mode: ProcessingMode) => {
    setState((prev) => ({ ...prev, processingMode: mode }));
    handleNext();
  };

  // Risk profile selection (no session update needed)
  const handleRiskSelect = (risk: RiskProfile) => {
    setState((prev) => ({ ...prev, riskProfile: risk }));
    handleNext();
  };

  // Consent handler (✅ uses userId now, not sessionId)
  const handleGrantConsent = async () => {
    if (!user?.uid) return;

    setLoading(true);
    try {
      const scopes = [
        "vault.read.risk_profile",
        "vault.write.decision",
        "agent.kai.analyze",
      ];

      // ✅ Grant consent with Firebase UID
      const { tokens } = await grantKaiConsent(user.uid, scopes);

      setState((prev) => ({
        ...prev,
        consentGranted: true,
        legalAcknowledged: true,
      }));

      console.log("[Kai] Consent granted, tokens stored:", Object.keys(tokens));
      handleNext();
    } catch (error) {
      console.error("Failed to grant consent:", error);
      alert("Failed to grant consent. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Complete onboarding
  const handleComplete = () => {
    router.push("/dashboard/kai/analysis");
  };

  return (
    <div className="min-h-dvh morphy-app-bg flex items-center justify-center p-4">
      {/* Background glow effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-2xl">
        {/* Step Indicator */}
        <StepIndicator current={currentStepIndex} total={steps.length} />

        {/* Step Content */}
        <div className="transition-opacity duration-300">
          {state.step === "welcome" && (
            <WelcomeStep onStart={handleStart} loading={loading} />
          )}

          {state.step === "processing_mode" && (
            <ModeStep onSelect={handleModeSelect} loading={loading} />
          )}

          {state.step === "risk_profile" && (
            <RiskStep onSelect={handleRiskSelect} loading={loading} />
          )}

          {state.step === "consent" && (
            <ConsentStep onGrant={handleGrantConsent} loading={loading} />
          )}

          {state.step === "ready" && <ReadyStep onComplete={handleComplete} />}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// STEP INDICATOR
// =============================================================================

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-2 rounded-full transition-all duration-500 ${
            i < current
              ? "w-8 bg-gradient-to-r from-blue-500 to-purple-500"
              : i === current
              ? "w-8 bg-gradient-to-r from-blue-500/50 to-purple-500/50"
              : "w-2 bg-white/20"
          }`}
        />
      ))}
    </div>
  );
}

// =============================================================================
// STEP COMPONENTS
// =============================================================================

function WelcomeStep({
  onStart,
  loading,
}: {
  onStart: () => void;
  loading: boolean;
}) {
  const [checks, setChecks] = useState({
    notAdvice: false,
    consultPro: false,
    mayLose: false,
  });

  const allChecked = Object.values(checks).every(Boolean);

  return (
    <div className="opacity-100 transition-opacity duration-300">
      <Card variant="none" effect="glass">
        <CardHeader>
          <div className="mx-auto mb-4 text-6xl">🤫</div>
          <CardTitle className="text-headline text-center">Agent Kai</CardTitle>
          <CardDescription className="text-title text-center">
            Your Investment Committee
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <p className="text-body text-center text-muted-foreground">
            Three specialists. One decision. Your receipts.
          </p>

          {/* Legal Disclaimer */}
          <div className="glass-interactive p-6 rounded-xl border border-amber-500/30 space-y-4 bg-gradient-to-br from-amber-500/10 to-orange-500/10">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-amber-500" />
              <p className="text-caption font-semibold text-amber-400">
                Important Disclosure
              </p>
            </div>
            <p className="text-small text-amber-200/80">
              Kai provides educational analysis, NOT investment advice.
            </p>

            <div className="space-y-3">
              {[
                {
                  key: "notAdvice",
                  label: "I understand this is not investment advice",
                },
                {
                  key: "consultPro",
                  label: "I will consult professionals before investing",
                },
                { key: "mayLose", label: "I understand I may lose money" },
              ].map(({ key, label }) => (
                <label
                  key={key}
                  className="flex items-center gap-3 cursor-pointer group"
                >
                  <button
                    type="button"
                    className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors ${
                      checks[key as keyof typeof checks]
                        ? "bg-gradient-to-br from-amber-500 to-orange-500 border-amber-500"
                        : "border-amber-500/50 group-hover:border-amber-400"
                    }`}
                    onClick={() =>
                      setChecks((c) => ({
                        ...c,
                        [key]: !c[key as keyof typeof c],
                      }))
                    }
                  >
                    {checks[key as keyof typeof checks] && (
                      <Check className="h-4 w-4 text-white" />
                    )}
                  </button>
                  <span className="text-small text-amber-100/90">{label}</span>
                </label>
              ))}
            </div>
          </div>
        </CardContent>

        <CardFooter>
          <Button
            variant="gradient"
            size="lg"
            className="w-full"
            onClick={onStart}
            disabled={!allChecked || loading}
            showRipple
          >
            {loading ? (
              "Starting..."
            ) : (
              <>
                Get Started
                <ArrowRight className="ml-2 h-5 w-5" />
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

function ModeStep({
  onSelect,
  loading,
}: {
  onSelect: (mode: ProcessingMode) => void;
  loading: boolean;
}) {
  return (
    <div className="opacity-100 transition-opacity duration-300">
      <Card variant="none" effect="glass">
        <CardHeader>
          <CardTitle className="text-title text-center">
            Choose Your Mode
          </CardTitle>
          <CardDescription className="text-body text-center">
            How should Kai analyze stocks?
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <Card
            variant="none"
            effect="glass"
            className="cursor-pointer hover:bg-white/10 transition-colors"
            showRipple
            onClick={() => !loading && onSelect("on_device")}
          >
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <Cpu className="h-6 w-6 text-blue-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-title font-semibold mb-1">On-Device</h3>
                  <p className="text-caption text-muted-foreground">
                    100% private. Analysis runs locally on your phone.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            variant="none"
            effect="glass"
            className="cursor-pointer hover:bg-white/10 transition-colors"
            showRipple
            onClick={() => !loading && onSelect("hybrid")}
          >
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <Cloud className="h-6 w-6 text-purple-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-title font-semibold mb-1">Hybrid</h3>
                  <p className="text-caption text-muted-foreground">
                    Get real-time data (SEC filings, news, market prices).
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}

function RiskStep({
  onSelect,
  loading,
}: {
  onSelect: (risk: RiskProfile) => void;
  loading: boolean;
}) {
  const profiles = [
    {
      id: "conservative" as RiskProfile,
      icon: Shield,
      color: "green",
      title: "Conservative",
      description: "Prioritize fundamentals and stability",
    },
    {
      id: "balanced" as RiskProfile,
      icon: Scale,
      color: "blue",
      title: "Balanced",
      description: "Mix of growth and stability",
    },
    {
      id: "aggressive" as RiskProfile,
      icon: TrendingUp,
      color: "red",
      title: "Aggressive",
      description: "Focus on growth and momentum",
    },
  ];

  return (
    <div className="opacity-100 transition-opacity duration-300">
      <Card variant="none" effect="glass">
        <CardHeader>
          <CardTitle className="text-title text-center">Risk Profile</CardTitle>
          <CardDescription className="text-body text-center">
            This tailors how our agents vote
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {profiles.map(({ id, icon: Icon, title, description }) => (
            <Card
              key={id}
              variant="none"
              effect="glass"
              className="cursor-pointer hover:bg-white/10 transition-colors"
              showRipple
              onClick={() => !loading && onSelect(id)}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <Icon className="h-6 w-6 text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-title font-semibold mb-1">{title}</h3>
                    <p className="text-caption text-muted-foreground">
                      {description}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function ConsentStep({
  onGrant,
  loading,
}: {
  onGrant: () => void;
  loading: boolean;
}) {
  return (
    <div className="opacity-100 transition-opacity duration-300">
      <Card variant="none" effect="glass">
        <CardHeader>
          <CardTitle className="text-title text-center">Grant Access</CardTitle>
          <CardDescription className="text-body text-center">
            Let Kai analyze stocks and save decisions
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-3">
            {[
              "Read your risk profile",
              "Analyze stocks on your behalf",
              "Save decisions to your vault",
            ].map((scope, i) => (
              <div key={i} className="flex items-center gap-3 text-caption">
                <div className="h-6 w-6 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Check className="h-4 w-4 text-green-400" />
                </div>
                <span>{scope}</span>
              </div>
            ))}
          </div>
        </CardContent>

        <CardFooter>
          <Button
            variant="gradient"
            size="lg"
            className="w-full"
            onClick={onGrant}
            disabled={loading}
            showRipple
          >
            {loading ? "Granting..." : "Grant Access"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

function ReadyStep({ onComplete }: { onComplete: () => void }) {
  return (
    <div className="opacity-100 transition-opacity duration-300">
      <Card variant="none" effect="glass">
        <CardContent className="p-12 text-center">
          <div className="mb-6 text-8xl">✅</div>
          <h2 className="text-headline mb-4">You're Ready!</h2>
          <p className="text-body text-muted-foreground mb-8">
            Your investment committee is standing by.
          </p>
          <Button variant="gradient" size="lg" onClick={onComplete} showRipple>
            <Sparkles className="mr-2 h-5 w-5" />
            Start Analyzing
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
