"use client";

/**
 * Agent Kai — Personal Agent 🤫 by Hushh Technologies
 *
 * This is the main Kai page with:
 * 1. Welcome + Legal Acknowledgment
 * 2. Processing Mode Selection (On-Device / Hybrid)
 * 3. Risk Profile Setup (Conservative / Balanced / Aggressive)
 * 4. Consent Grant
 * 5. Ready to Analyze
 *
 * After onboarding, investor can use Kai's investment analysis mode.
 *
 * @see docs/vision/kai/README.md for full specification
 */

import { useState, useCallback } from "react";
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
  TrendingDown,
  Scale,
  TrendingUp,
  Sparkles,
} from "lucide-react";
import {
  createInvestorSession,
  recordManagerSelection,
  grantConsent,
  logAudit,
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

type ProcessingMode = "on_device" | "hybrid";
type RiskProfile = "conservative" | "balanced" | "aggressive";

interface OnboardingState {
  step: OnboardingStep;
  sessionId: string | null;
  processingMode: ProcessingMode | null;
  riskProfile: RiskProfile | null;
  legalAcknowledged: boolean;
  consentGranted: boolean;
}

// =============================================================================
// STEP INDICATOR
// =============================================================================

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 justify-center mt-6">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-2 w-8 rounded-full transition-colors ${
            i < current
              ? "bg-primary"
              : i === current
              ? "bg-primary/50"
              : "bg-muted"
          }`}
        />
      ))}
    </div>
  );
}

// =============================================================================
// SCREEN 1: WELCOME + LEGAL
// =============================================================================

function WelcomeScreen({ onContinue }: { onContinue: () => void }) {
  const [checks, setChecks] = useState({
    notAdvice: false,
    consultPro: false,
    mayLose: false,
  });

  const allChecked = checks.notAdvice && checks.consultPro && checks.mayLose;

  return (
    <Card className="max-w-lg mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto h-16 w-16 rounded-full bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center text-3xl shadow-lg mb-4">
          🤫
        </div>
        <p className="text-sm text-muted-foreground">Personal Agent</p>
        <CardTitle className="text-2xl">Kai</CardTitle>
        <CardDescription>by Hushh Technologies</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-center text-muted-foreground">
          Your personal investment committee.
          <br />
          Three specialists. One decision. Your receipts.
        </p>

        {/* Legal checkboxes - Yellow/Black in both modes */}
        <div className="bg-yellow-100 border border-yellow-400 rounded-lg p-4 space-y-3">
          <p className="text-sm font-medium text-black">
            ⚠️ Important: Kai provides educational analysis, NOT investment
            advice.
          </p>

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
            <label key={key} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={checks[key as keyof typeof checks]}
                onChange={(e) =>
                  setChecks((c) => ({ ...c, [key]: e.target.checked }))
                }
                className="w-5 h-5 rounded border-yellow-500 text-yellow-600 focus:ring-yellow-500"
              />
              <span className="text-sm text-black">{label}</span>
            </label>
          ))}
        </div>
      </CardContent>

      <CardFooter>
        <Button
          variant="gradient"
          size="lg"
          className="w-full"
          disabled={!allChecked}
          onClick={onContinue}
        >
          I Understand - Get Started
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </CardFooter>

      <StepIndicator current={0} total={5} />
    </Card>
  );
}

// =============================================================================
// SCREEN 2: PROCESSING MODE
// =============================================================================

const PROCESSING_MODES = [
  {
    id: "on_device" as ProcessingMode,
    icon: Cpu,
    title: "On-Device Only",
    subtitle: "Maximum Privacy",
    description:
      "Analysis runs entirely on your device. No data ever leaves your phone.",
    highlight: "Uses cached/historical data",
  },
  {
    id: "hybrid" as ProcessingMode,
    icon: Cloud,
    title: "Hybrid Mode",
    subtitle: "Best Accuracy",
    description: "Reasoning on-device, live data with your consent.",
    highlight: "You approve each external source",
  },
];

function ProcessingModeScreen({
  onSelect,
}: {
  onSelect: (mode: ProcessingMode) => void;
}) {
  const [selected, setSelected] = useState<ProcessingMode | null>(null);

  return (
    <Card className="max-w-lg mx-auto">
      <CardHeader className="text-center">
        <CardTitle>How should Kai process your requests?</CardTitle>
        <CardDescription>
          Choose your preferred privacy/accuracy balance
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {PROCESSING_MODES.map((mode) => {
          const Icon = mode.icon;
          const isSelected = selected === mode.id;

          return (
            <button
              key={mode.id}
              onClick={() => setSelected(mode.id)}
              className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{mode.title}</span>
                    <span className="text-xs bg-muted px-2 py-0.5 rounded">
                      {mode.subtitle}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {mode.description}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 italic">
                    {mode.highlight}
                  </p>
                </div>
                {isSelected && <Check className="h-5 w-5 text-primary" />}
              </div>
            </button>
          );
        })}
      </CardContent>

      <CardFooter>
        <Button
          variant="gradient"
          size="lg"
          className="w-full"
          disabled={!selected}
          onClick={() => selected && onSelect(selected)}
        >
          Continue
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </CardFooter>

      <StepIndicator current={1} total={5} />
    </Card>
  );
}

// =============================================================================
// SCREEN 3: RISK PROFILE
// =============================================================================

const RISK_PROFILES = [
  {
    id: "conservative" as RiskProfile,
    icon: TrendingDown,
    title: "Conservative",
    description: "I prioritize protecting what I have",
    behavior: "Emphasizes downside risks, higher confidence thresholds",
  },
  {
    id: "balanced" as RiskProfile,
    icon: Scale,
    title: "Balanced",
    description: "I want growth with protection",
    behavior: "Balanced agent weighting",
  },
  {
    id: "aggressive" as RiskProfile,
    icon: TrendingUp,
    title: "Aggressive",
    description: "I'm focused on growth opportunities",
    behavior: "Weighs momentum and opportunity higher",
  },
];

function RiskProfileScreen({
  onSelect,
}: {
  onSelect: (profile: RiskProfile) => void;
}) {
  const [selected, setSelected] = useState<RiskProfile | null>(null);

  return (
    <Card className="max-w-lg mx-auto">
      <CardHeader className="text-center">
        <CardTitle>How do you approach investing?</CardTitle>
        <CardDescription>
          This helps Kai align recommendations to your style
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {RISK_PROFILES.map((profile) => {
          const Icon = profile.icon;
          const isSelected = selected === profile.id;

          return (
            <button
              key={profile.id}
              onClick={() => setSelected(profile.id)}
              className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <span className="font-semibold">{profile.title}</span>
                  <p className="text-sm text-muted-foreground mt-1">
                    {profile.description}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 italic">
                    {profile.behavior}
                  </p>
                </div>
                {isSelected && <Check className="h-5 w-5 text-primary" />}
              </div>
            </button>
          );
        })}
      </CardContent>

      <CardFooter>
        <Button
          variant="gradient"
          size="lg"
          className="w-full"
          disabled={!selected}
          onClick={() => selected && onSelect(selected)}
        >
          Continue
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </CardFooter>

      <StepIndicator current={2} total={5} />
    </Card>
  );
}

// =============================================================================
// SCREEN 4: CONSENT GRANT
// =============================================================================

function ConsentScreen({
  onGrant,
  onDeny,
}: {
  onGrant: () => void;
  onDeny: () => void;
}) {
  return (
    <Card className="max-w-lg mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center mb-2">
          <Shield className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        </div>
        <CardTitle>Data Access</CardTitle>
        <CardDescription>Kai needs your permission to operate</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* What Kai will do */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Kai will:</p>
          {[
            "Analyze stocks you request",
            "Remember your risk profile",
            "Store decision history on your device",
          ].map((item) => (
            <div key={item} className="flex items-center gap-3">
              <div className="h-6 w-6 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <span className="text-sm">{item}</span>
            </div>
          ))}
        </div>

        {/* What Kai will NOT do */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Kai will NEVER:
          </p>
          {[
            "Execute trades without explicit consent",
            "Share your data with third parties",
            "Make decisions without showing you why",
          ].map((item) => (
            <div
              key={item}
              className="flex items-center gap-3 text-muted-foreground"
            >
              <div className="h-6 w-6 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                <span className="text-red-600 dark:text-red-400 text-sm">
                  ✗
                </span>
              </div>
              <span className="text-sm">{item}</span>
            </div>
          ))}
        </div>
      </CardContent>

      <CardFooter className="flex flex-col gap-3">
        <Button
          variant="gradient"
          size="lg"
          className="w-full"
          onClick={onGrant}
        >
          Approve
          <Check className="ml-2 h-5 w-5" />
        </Button>
        <Button variant="outline" size="lg" className="w-full" onClick={onDeny}>
          Deny
        </Button>
      </CardFooter>

      <StepIndicator current={3} total={5} />
    </Card>
  );
}

// =============================================================================
// SCREEN 5: READY
// =============================================================================

function ReadyScreen({ onStart }: { onStart: () => void }) {
  return (
    <Card className="max-w-lg mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto h-16 w-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mb-2">
          <Sparkles className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>
        <CardTitle>You're all set!</CardTitle>
        <CardDescription>Ask Kai about any stock or ETF</CardDescription>
      </CardHeader>

      <CardContent className="text-center space-y-4">
        <p className="text-muted-foreground">Try asking something like:</p>
        <div className="bg-muted rounded-lg p-4 text-lg font-medium">
          "Should I buy Apple?"
        </div>
      </CardContent>

      <CardFooter>
        <Button
          variant="gradient"
          size="lg"
          className="w-full"
          onClick={onStart}
        >
          Start Analyzing
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </CardFooter>

      <StepIndicator current={4} total={5} />
    </Card>
  );
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function KaiPage() {
  const router = useRouter();
  const [state, setState] = useState<OnboardingState>({
    step: "welcome",
    sessionId: null,
    processingMode: null,
    riskProfile: null,
    legalAcknowledged: false,
    consentGranted: false,
  });

  // Handlers
  const handleWelcomeContinue = useCallback(async () => {
    const { sessionId } = await createInvestorSession(
      "user_demo",
      "kai_analysis"
    );
    await logAudit(sessionId, "session_started", { legalAcknowledged: true });
    setState((s) => ({
      ...s,
      sessionId,
      legalAcknowledged: true,
      step: "processing_mode",
    }));
  }, []);

  const handleProcessingModeSelect = useCallback(
    async (mode: ProcessingMode) => {
      if (!state.sessionId) return;
      await logAudit(state.sessionId, "intro_viewed", { processingMode: mode });
      setState((s) => ({ ...s, processingMode: mode, step: "risk_profile" }));
    },
    [state.sessionId]
  );

  const handleRiskProfileSelect = useCallback(
    async (profile: RiskProfile) => {
      if (!state.sessionId) return;
      await logAudit(state.sessionId, "manager_selected", {
        riskProfile: profile,
      });
      setState((s) => ({ ...s, riskProfile: profile, step: "consent" }));
    },
    [state.sessionId]
  );

  const handleConsentGrant = useCallback(async () => {
    if (!state.sessionId) return;
    await grantConsent(state.sessionId, [
      "kyc_verification", // Repurposed: analyze stocks
      "aml_verification", // Repurposed: remember risk profile
      "accreditation", // Repurposed: store decision history
    ]);
    setState((s) => ({ ...s, consentGranted: true, step: "ready" }));
  }, [state.sessionId]);

  const handleConsentDeny = useCallback(() => {
    alert(
      "You've declined to grant permission. Kai needs these permissions to operate."
    );
  }, []);

  const handleStartAnalyzing = useCallback(() => {
    // TODO: Navigate to Kai analysis/chat interface
    router.push("/dashboard");
  }, [router]);

  // Render current step
  return (
    <div className="py-8">
      {state.step === "welcome" && (
        <WelcomeScreen onContinue={handleWelcomeContinue} />
      )}
      {state.step === "processing_mode" && (
        <ProcessingModeScreen onSelect={handleProcessingModeSelect} />
      )}
      {state.step === "risk_profile" && (
        <RiskProfileScreen onSelect={handleRiskProfileSelect} />
      )}
      {state.step === "consent" && (
        <ConsentScreen
          onGrant={handleConsentGrant}
          onDeny={handleConsentDeny}
        />
      )}
      {state.step === "ready" && <ReadyScreen onStart={handleStartAnalyzing} />}
    </div>
  );
}
