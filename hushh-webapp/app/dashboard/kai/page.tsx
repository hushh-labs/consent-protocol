"use client";

/**
 * Agent Kai — Luxurious Investor Onboarding
 *
 * Premium onboarding experience with:
 * - Framer Motion page transitions
 * - Glassmorphism styling
 * - Micro-interactions
 * - Compliance-first design (consent protocol integration)
 *
 * @see docs/vision/kai/README.md
 */

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
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
  Lock,
  Fingerprint,
} from "lucide-react";
import { createInvestorSession, grantConsent, logAudit } from "./actions";

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
// ANIMATION VARIANTS
// =============================================================================

const pageTransition = {
  duration: 0.4,
  ease: [0.22, 1, 0.36, 1] as const,
};

const exitTransition = {
  duration: 0.3,
  ease: [0.22, 1, 0.36, 1] as const,
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const scaleIn = {
  initial: { opacity: 0, scale: 0.8 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.4 } },
};

// =============================================================================
// PREMIUM STEP INDICATOR
// =============================================================================

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-3 mt-8 mb-4">
      {Array.from({ length: total }).map((_, i) => (
        <motion.div
          key={i}
          className="relative"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: i * 0.1 }}
        >
          <motion.div
            className={`h-2.5 rounded-full transition-all duration-500 ${
              i < current
                ? "w-10 bg-gradient-to-r from-blue-500 to-purple-500"
                : i === current
                ? "w-10 bg-gradient-to-r from-blue-500/50 to-purple-500/50"
                : "w-2.5 bg-white/20"
            }`}
            layoutId={`step-${i}`}
          />
          {i < current && (
            <motion.div
              className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
            />
          )}
        </motion.div>
      ))}
    </div>
  );
}

// =============================================================================
// GLASSMORPHIC CARD WRAPPER
// =============================================================================

function GlassCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.98 }}
      transition={pageTransition}
      className={`relative max-w-lg mx-auto ${className}`}
    >
      {/* Glow effect */}
      <div className="absolute -inset-1 bg-linear-to-r from-blue-500/20 via-purple-500/20 to-blue-500/20 rounded-3xl blur-xl opacity-70" />

      {/* Card */}
      <div className="relative bg-background/80 dark:bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        {children}
      </div>
    </motion.div>
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
    <GlassCard>
      <CardHeader className="text-center pt-8">
        <motion.div
          variants={scaleIn}
          initial="initial"
          animate="animate"
          className="mx-auto h-20 w-20 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-4xl shadow-lg shadow-purple-500/25 mb-6"
        >
          <span className="drop-shadow-lg">🤫</span>
        </motion.div>

        <motion.div variants={fadeInUp} initial="initial" animate="animate">
          <p className="text-sm font-medium bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent uppercase tracking-wider mb-2">
            Personal Agent
          </p>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-white to-white/80 bg-clip-text">
            Kai
          </CardTitle>
          <CardDescription className="mt-2">
            by Hushh Technologies
          </CardDescription>
        </motion.div>
      </CardHeader>

      <CardContent className="space-y-6">
        <motion.p
          variants={fadeInUp}
          initial="initial"
          animate="animate"
          className="text-center text-muted-foreground text-lg"
        >
          Your personal investment committee.
          <br />
          <span className="text-white/90">
            Three specialists. One decision. Your receipts.
          </span>
        </motion.p>

        {/* Compliance section - Premium styled */}
        <motion.div
          variants={fadeInUp}
          initial="initial"
          animate="animate"
          className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl p-5 space-y-4"
        >
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-amber-500" />
            <p className="text-sm font-semibold text-amber-400">
              Important Disclosure
            </p>
          </div>
          <p className="text-sm text-amber-200/80">
            Kai provides educational analysis, NOT investment advice.
          </p>

          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="space-y-3"
          >
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
              <motion.label
                key={key}
                variants={fadeInUp}
                className="flex items-center gap-3 cursor-pointer group"
              >
                <div
                  className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all duration-300 ${
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
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 500 }}
                    >
                      <Check className="h-4 w-4 text-white" />
                    </motion.div>
                  )}
                </div>
                <span className="text-sm text-amber-100/90">{label}</span>
              </motion.label>
            ))}
          </motion.div>
        </motion.div>
      </CardContent>

      <CardFooter className="pb-6">
        <motion.div
          className="w-full"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Button
            variant="gradient"
            size="lg"
            className={`w-full h-14 text-lg font-semibold transition-all duration-300 ${
              allChecked
                ? "opacity-100 shadow-lg shadow-purple-500/25"
                : "opacity-50"
            }`}
            disabled={!allChecked}
            onClick={onContinue}
          >
            I Understand — Get Started
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </motion.div>
      </CardFooter>

      <StepIndicator current={0} total={5} />
    </GlassCard>
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
    gradient: "from-emerald-500 to-teal-500",
  },
  {
    id: "hybrid" as ProcessingMode,
    icon: Cloud,
    title: "Hybrid Mode",
    subtitle: "Best Accuracy",
    description: "Reasoning on-device, live data with your consent.",
    highlight: "You approve each external source",
    gradient: "from-blue-500 to-purple-500",
  },
];

function ProcessingModeScreen({
  onSelect,
}: {
  onSelect: (mode: ProcessingMode) => void;
}) {
  const [selected, setSelected] = useState<ProcessingMode | null>(null);

  return (
    <GlassCard>
      <CardHeader className="text-center pt-8">
        <motion.div variants={fadeInUp} initial="initial" animate="animate">
          <CardTitle className="text-2xl">
            How should Kai process your requests?
          </CardTitle>
          <CardDescription className="mt-2">
            Choose your preferred privacy/accuracy balance
          </CardDescription>
        </motion.div>
      </CardHeader>

      <CardContent className="space-y-4">
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="space-y-4"
        >
          {PROCESSING_MODES.map((mode, idx) => {
            const Icon = mode.icon;
            const isSelected = selected === mode.id;

            return (
              <motion.button
                key={mode.id}
                variants={fadeInUp}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelected(mode.id)}
                className={`w-full p-5 rounded-xl border-2 transition-all duration-300 text-left ${
                  isSelected
                    ? `border-white/30 bg-gradient-to-br ${mode.gradient}/10`
                    : "border-white/10 hover:border-white/20 bg-white/5"
                }`}
              >
                <div className="flex items-start gap-4">
                  <motion.div
                    animate={{ rotate: isSelected ? 360 : 0 }}
                    transition={{ duration: 0.5 }}
                    className={`h-12 w-12 rounded-xl flex items-center justify-center bg-gradient-to-br ${mode.gradient} shadow-lg`}
                  >
                    <Icon className="h-6 w-6 text-white" />
                  </motion.div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-lg">
                        {mode.title}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full bg-gradient-to-r ${mode.gradient}/20 border border-white/10`}
                      >
                        {mode.subtitle}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {mode.description}
                    </p>
                    <p className="text-xs text-white/50 mt-2 italic">
                      {mode.highlight}
                    </p>
                  </div>
                  <AnimatePresence>
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        className={`h-6 w-6 rounded-full bg-gradient-to-br ${mode.gradient} flex items-center justify-center`}
                      >
                        <Check className="h-4 w-4 text-white" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.button>
            );
          })}
        </motion.div>
      </CardContent>

      <CardFooter className="pb-6">
        <motion.div
          className="w-full"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Button
            variant="gradient"
            size="lg"
            className={`w-full h-14 text-lg font-semibold transition-all duration-300 ${
              selected
                ? "opacity-100 shadow-lg shadow-purple-500/25"
                : "opacity-50"
            }`}
            disabled={!selected}
            onClick={() => selected && onSelect(selected)}
          >
            Continue
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </motion.div>
      </CardFooter>

      <StepIndicator current={1} total={5} />
    </GlassCard>
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
    gradient: "from-blue-400 to-cyan-400",
  },
  {
    id: "balanced" as RiskProfile,
    icon: Scale,
    title: "Balanced",
    description: "I want growth with protection",
    behavior: "Balanced agent weighting",
    gradient: "from-purple-400 to-pink-400",
  },
  {
    id: "aggressive" as RiskProfile,
    icon: TrendingUp,
    title: "Aggressive",
    description: "I'm focused on growth opportunities",
    behavior: "Weighs momentum and opportunity higher",
    gradient: "from-orange-400 to-red-400",
  },
];

function RiskProfileScreen({
  onSelect,
}: {
  onSelect: (profile: RiskProfile) => void;
}) {
  const [selected, setSelected] = useState<RiskProfile | null>(null);

  return (
    <GlassCard>
      <CardHeader className="text-center pt-8">
        <motion.div variants={fadeInUp} initial="initial" animate="animate">
          <CardTitle className="text-2xl">
            How do you approach investing?
          </CardTitle>
          <CardDescription className="mt-2">
            This helps Kai align recommendations to your style
          </CardDescription>
        </motion.div>
      </CardHeader>

      <CardContent className="space-y-4">
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="space-y-4"
        >
          {RISK_PROFILES.map((profile) => {
            const Icon = profile.icon;
            const isSelected = selected === profile.id;

            return (
              <motion.button
                key={profile.id}
                variants={fadeInUp}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelected(profile.id)}
                className={`w-full p-5 rounded-xl border-2 transition-all duration-300 text-left ${
                  isSelected
                    ? `border-white/30 bg-gradient-to-br ${profile.gradient}/10`
                    : "border-white/10 hover:border-white/20 bg-white/5"
                }`}
              >
                <div className="flex items-start gap-4">
                  <motion.div
                    animate={{ scale: isSelected ? 1.1 : 1 }}
                    className={`h-12 w-12 rounded-xl flex items-center justify-center bg-gradient-to-br ${profile.gradient} shadow-lg`}
                  >
                    <Icon className="h-6 w-6 text-white" />
                  </motion.div>
                  <div className="flex-1">
                    <span className="font-semibold text-lg">
                      {profile.title}
                    </span>
                    <p className="text-sm text-muted-foreground mt-1">
                      {profile.description}
                    </p>
                    <p className="text-xs text-white/50 mt-2 italic">
                      {profile.behavior}
                    </p>
                  </div>
                  <AnimatePresence>
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        className={`h-6 w-6 rounded-full bg-gradient-to-br ${profile.gradient} flex items-center justify-center`}
                      >
                        <Check className="h-4 w-4 text-white" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.button>
            );
          })}
        </motion.div>
      </CardContent>

      <CardFooter className="pb-6">
        <motion.div
          className="w-full"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Button
            variant="gradient"
            size="lg"
            className={`w-full h-14 text-lg font-semibold transition-all duration-300 ${
              selected
                ? "opacity-100 shadow-lg shadow-purple-500/25"
                : "opacity-50"
            }`}
            disabled={!selected}
            onClick={() => selected && onSelect(selected)}
          >
            Continue
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </motion.div>
      </CardFooter>

      <StepIndicator current={2} total={5} />
    </GlassCard>
  );
}

// =============================================================================
// SCREEN 4: CONSENT GRANT (COMPLIANCE-FIRST)
// =============================================================================

function ConsentScreen({
  onGrant,
  onDeny,
}: {
  onGrant: () => void;
  onDeny: () => void;
}) {
  return (
    <GlassCard>
      <CardHeader className="text-center pt-8">
        <motion.div
          variants={scaleIn}
          initial="initial"
          animate="animate"
          className="mx-auto h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/25 mb-4"
        >
          <Lock className="h-8 w-8 text-white" />
        </motion.div>
        <motion.div variants={fadeInUp} initial="initial" animate="animate">
          <CardTitle className="text-2xl">Data Access Consent</CardTitle>
          <CardDescription className="mt-2">
            Kai operates under strict consent protocol
          </CardDescription>
        </motion.div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* What Kai WILL do */}
        <motion.div
          variants={fadeInUp}
          initial="initial"
          animate="animate"
          className="space-y-3"
        >
          <p className="text-sm font-semibold text-emerald-400 flex items-center gap-2">
            <Check className="h-4 w-4" /> Kai will:
          </p>
          {[
            "Analyze stocks you request",
            "Remember your risk profile",
            "Store decision history on your device",
          ].map((item) => (
            <motion.div
              key={item}
              whileHover={{ x: 4 }}
              className="flex items-center gap-3 pl-6"
            >
              <div className="h-2 w-2 rounded-full bg-gradient-to-r from-emerald-400 to-teal-400" />
              <span className="text-sm text-white/80">{item}</span>
            </motion.div>
          ))}
        </motion.div>

        {/* What Kai will NEVER do */}
        <motion.div
          variants={fadeInUp}
          initial="initial"
          animate="animate"
          className="space-y-3"
        >
          <p className="text-sm font-semibold text-red-400 flex items-center gap-2">
            <span>✗</span> Kai will NEVER:
          </p>
          {[
            "Execute trades without explicit consent",
            "Share your data with third parties",
            "Make decisions without showing you why",
          ].map((item) => (
            <motion.div
              key={item}
              whileHover={{ x: 4 }}
              className="flex items-center gap-3 pl-6 text-muted-foreground"
            >
              <div className="h-2 w-2 rounded-full bg-red-400/50" />
              <span className="text-sm">{item}</span>
            </motion.div>
          ))}
        </motion.div>

        {/* Consent Protocol Badge */}
        <motion.div
          variants={fadeInUp}
          initial="initial"
          animate="animate"
          className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-white/10"
        >
          <Shield className="h-4 w-4 text-blue-400" />
          <span className="text-xs text-white/60">
            Protected by Hushh Consent Protocol (MCP)
          </span>
        </motion.div>
      </CardContent>

      <CardFooter className="flex flex-col gap-3 pb-6">
        <motion.div
          className="w-full"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Button
            variant="gradient"
            size="lg"
            className="w-full h-14 text-lg font-semibold shadow-lg shadow-purple-500/25"
            onClick={onGrant}
          >
            <Fingerprint className="mr-2 h-5 w-5" />
            Approve
          </Button>
        </motion.div>
        <motion.div
          className="w-full"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Button
            variant="none"
            size="lg"
            className="w-full h-12 border border-white/20 text-muted-foreground hover:bg-white/5"
            onClick={onDeny}
          >
            Deny
          </Button>
        </motion.div>
      </CardFooter>

      <StepIndicator current={3} total={5} />
    </GlassCard>
  );
}

// =============================================================================
// SCREEN 5: READY (CELEBRATION)
// =============================================================================

function ReadyScreen({ onStart }: { onStart: () => void }) {
  return (
    <GlassCard>
      <CardHeader className="text-center pt-8">
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
          className="mx-auto h-20 w-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center shadow-lg shadow-emerald-500/25 mb-6"
        >
          <Sparkles className="h-10 w-10 text-white" />
        </motion.div>
        <motion.div variants={fadeInUp} initial="initial" animate="animate">
          <CardTitle className="text-3xl font-bold">You're all set!</CardTitle>
          <CardDescription className="mt-2 text-lg">
            Ask Kai about any stock or ETF
          </CardDescription>
        </motion.div>
      </CardHeader>

      <CardContent className="text-center space-y-6">
        <motion.p
          variants={fadeInUp}
          initial="initial"
          animate="animate"
          className="text-muted-foreground"
        >
          Try asking something like:
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gradient-to-br from-white/5 to-white/10 border border-white/10 rounded-xl p-6"
        >
          <p className="text-xl font-medium text-white/90 italic">
            "Should I buy Apple?"
          </p>
        </motion.div>

        {/* Success badges */}
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="flex flex-wrap justify-center gap-2"
        >
          {["Consent Granted", "Profile Saved", "Ready to Analyze"].map(
            (badge) => (
              <motion.span
                key={badge}
                variants={fadeInUp}
                className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-xs text-emerald-400"
              >
                ✓ {badge}
              </motion.span>
            )
          )}
        </motion.div>
      </CardContent>

      <CardFooter className="pb-6">
        <motion.div
          className="w-full"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Button
            variant="gradient"
            size="lg"
            className="w-full h-14 text-lg font-semibold shadow-lg shadow-purple-500/25"
            onClick={onStart}
          >
            Start Analyzing
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </motion.div>
      </CardFooter>

      <StepIndicator current={4} total={5} />
    </GlassCard>
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
      "vault.read.risk_profile",
      "vault.write.decision",
      "agent.kai.analyze",
    ]);
    setState((s) => ({ ...s, consentGranted: true, step: "ready" }));
  }, [state.sessionId]);

  const handleConsentDeny = useCallback(() => {
    alert(
      "You've declined to grant permission. Kai needs these permissions to operate."
    );
  }, []);

  const handleStartAnalyzing = useCallback(() => {
    // Redirect to Kai Analysis Dashboard after onboarding
    router.push("/dashboard/kai/analysis");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {state.step === "welcome" && (
          <WelcomeScreen key="welcome" onContinue={handleWelcomeContinue} />
        )}
        {state.step === "processing_mode" && (
          <ProcessingModeScreen
            key="mode"
            onSelect={handleProcessingModeSelect}
          />
        )}
        {state.step === "risk_profile" && (
          <RiskProfileScreen key="risk" onSelect={handleRiskProfileSelect} />
        )}
        {state.step === "consent" && (
          <ConsentScreen
            key="consent"
            onGrant={handleConsentGrant}
            onDeny={handleConsentDeny}
          />
        )}
        {state.step === "ready" && (
          <ReadyScreen key="ready" onStart={handleStartAnalyzing} />
        )}
      </AnimatePresence>
    </div>
  );
}
