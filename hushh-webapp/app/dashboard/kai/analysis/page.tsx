"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  ComposedChart,
  Line,
  LineChart as RechartsLineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Search,
  Brain,
  Target,
  LineChart,
  Crosshair,
  Rocket,
  Wallet,
  Sparkles,
  Lock,
  AlertTriangle,
  Info,
  TrendingUp,
  Zap,
  Cpu,
  BarChart3,
  ArrowRight,
  Loader2,
  TrendingDown,
  Scale,
  ShieldCheck,
  Terminal,
  DollarSign,
} from "lucide-react";
import { Button } from "@/lib/morphy-ux/button";
import { Card, CardContent } from "@/lib/morphy-ux/card";
import { toast } from "sonner";
import { useAuth } from "@/lib/firebase/auth-context";
import { useVault } from "@/lib/vault/vault-context";
import { HushhLoader } from "@/components/ui/hushh-loader";
import { Badge } from "@/components/ui/badge";
import { getPreferences, analyzeFundamental } from "@/lib/services/kai-service";
import { decryptData } from "@/lib/vault/encrypt";
import { getGsap, animateOnce } from "@/lib/morphy-ux/gsap";
import { DebateStreamView } from "@/components/kai/debate-stream-view";
import KaiDebateInline from "@/components/kai/kai-debate-inline";

interface TrendDataPoint {
  year: string;
  value: number;
}

// MATCHING BACKEND SCHEMA (DecisionCard)
interface LocalAnalyzeResponse {
  ticker: string;
  decision: "buy" | "hold" | "reduce";
  headline: string;
  summary: string;
  confidence: number;
  processing_mode: string;
  raw_card: {
    fundamental_insight: {
      business_moat: string;
      financial_resilience: string;
      growth_efficiency: string;
      bull_case: string;
      bear_case: string;
      summary?: string;
    };
    quant_metrics: {
      revenue_growth_yoy: number;
      net_income_growth_yoy: number;
      ocf_growth_yoy: number;
      revenue_cagr_3y: number;
      revenue_trend_data: TrendDataPoint[];
      net_income_trend_data: TrendDataPoint[];
      ocf_trend_data: TrendDataPoint[];
      rnd_trend_data: TrendDataPoint[];
    };
    all_sources: string[];
    key_metrics: {
      fundamental: {
        revenue_billions: number;
        fcf_billions: number;
        fcf_margin: number;
        debt_to_equity: number;
        rnd_intensity: number;
        earnings_quality: number;
      };
      valuation?: {
        pe_ratio: number;
        ps_ratio: number;
        enterprise_value_billions: number;
      };
    };
    risk_persona_alignment?: string;
  };
}

const QUICK_TICKERS = ["NVDA", "AAPL", "MSFT", "TSLA"];

// Helper to format preference badges in a user-friendly way
const formatPreferenceBadge = (key: string, value: string | string[]) => {
  const labels: Record<string, string> = {
    conservative: "🛡️ Conservative",
    moderate: "⚖️ Balanced",
    aggressive: "🚀 Growth-Focused",
    hybrid: "🤖 AI-Powered",
    on_device: "📱 Private Mode",
  };

  if (key === "risk") {
    return labels[value as string] || value;
  }
  if (key === "mode") {
    return labels[value as string] || value;
  }
  if (key === "style" && Array.isArray(value)) {
    return `📊 ${value.join(" · ")}`;
  }
  if (key === "style") {
    return `📊 ${value}`;
  }
  return value;
};

// Chart configurations for shadcn charts
const revenueTrendConfig = {
  value: { label: "Revenue ($B)", color: "var(--chart-1)" },
} satisfies ChartConfig;

const netIncomeTrendConfig = {
  value: { label: "Net Income ($B)", color: "var(--chart-2)" },
} satisfies ChartConfig;

const cashFlowConfig = {
  ocf: { label: "OCF ($B)", color: "var(--chart-3)" },
  rnd: { label: "R&D ($B)", color: "var(--chart-4)" },
} satisfies ChartConfig;

const radarConfig = {
  value: { label: "Score", color: "var(--chart-1)" },
} satisfies ChartConfig;

export default function KaiAnalysis() {
  const router = useRouter();
  const { user } = useAuth();
  const { vaultKey, isVaultUnlocked, vaultOwnerToken } = useVault();

  const [ticker, setTicker] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showDebateStream, setShowDebateStream] = useState(false);
  const [hasConsent, setHasConsent] = useState(false);
  const [result, setResult] = useState<LocalAnalyzeResponse | null>(null);
  const [userPreferences, setUserPreferences] = useState<{
    riskProfile: string;
    processingMode: string;
    investmentStyle: string[];
  } | null>(null);
  const [userContext, setUserContext] = useState<any>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const scorecardRef = useRef<HTMLDivElement>(null);

  // Load user preferences on mount
  useEffect(() => {
    const loadPreferences = async () => {
      if (!user || !isVaultUnlocked || !vaultKey || !vaultOwnerToken) return;

      try {
        const encryptedProfile = await import(
          "@/lib/services/kai-service"
        ).then((m) => m.getEncryptedProfile(vaultOwnerToken));

        if (encryptedProfile.profile_data) {
          const profileJson = await decryptData(
            {
              ciphertext: encryptedProfile.profile_data.ciphertext,
              iv: encryptedProfile.profile_data.iv,
              tag: encryptedProfile.profile_data.tag,
              encoding: "base64",
              algorithm: "aes-256-gcm",
            },
            vaultKey
          );
          const profileObj = JSON.parse(profileJson);

          setUserPreferences({
            riskProfile: profileObj.risk_tolerance || "moderate",
            processingMode: "hybrid",
            investmentStyle: Array.isArray(profileObj.investment_style)
              ? profileObj.investment_style
              : [],
          });
        }
      } catch (error) {
        console.error("[Kai] Failed to load preferences:", error);
      }
    };

    loadPreferences();
  }, [user, isVaultUnlocked, vaultKey, vaultOwnerToken]);

  // Check consent on mount
  // Vault owners have consent via vault.owner token (master scope)
  useEffect(() => {
    // If vault owner token exists, user has consent for all Kai operations
    // vault.owner satisfies agent.kai.analyze via hierarchical scope validation
    if (vaultOwnerToken) {
      setHasConsent(true);
    }
  }, [vaultOwnerToken]);

  // GSAP Entry Animation for Scorecard
  useEffect(() => {
    if (result && scorecardRef.current) {
      const runAnimation = async () => {
        const gsap = await getGsap();
        if (gsap) {
          gsap.fromTo(
            scorecardRef.current,
            { opacity: 0, y: 20 },
            { opacity: 1, y: 0, duration: 0.8, ease: "power3.out" }
          );
        }
      };
      runAnimation();
    }
  }, [result]);

  const handleSubmit = async (e?: React.FormEvent, overrideTicker?: string) => {
    if (e) e.preventDefault();
    const targetTicker = overrideTicker || ticker;

    if (!targetTicker.trim() || !user?.uid) return;

    if (!isVaultUnlocked || !vaultKey) {
      toast.error("Please unlock your vault to perform analysis.");
      return;
    }

    // 1. Get VAULT OWNER Token from Context (Managed by VaultLockGuard)
    if (!vaultOwnerToken) {
      toast.error("Session expired. Please unlock vault again.");
      return;
    }

    setIsAnalyzing(true);
    setResult(null);
    if (overrideTicker) setTicker(overrideTicker);

    // 2. Fetch Encrypted Profile (Ciphertext)
    const decryptedContext: any = {};
    try {
      const encryptedProfile = await import("@/lib/services/kai-service").then(
        (m) => m.getEncryptedProfile(vaultOwnerToken)
      );

      // 3. Decrypt Profile Context (Client Side)
      if (encryptedProfile.profile_data) {
        const profileJson = await decryptData(
          {
            ciphertext: encryptedProfile.profile_data.ciphertext,
            iv: encryptedProfile.profile_data.iv,
            tag: encryptedProfile.profile_data.tag,
            encoding: "base64",
            algorithm: "aes-256-gcm",
          },
          vaultKey
        );
        const profileObj = JSON.parse(profileJson);
        Object.assign(decryptedContext, profileObj);
        setUserContext(decryptedContext);
      }
    } catch (e) {
      console.error("Failed to load user context", e);
    }

    // Use streaming mode for real-time agent visualization
    // MOVED OUTSIDE of the legacy try-catch-finally block to prevent premature setIsAnalyzing(false)
    const useStreaming = true; 
    if (useStreaming) {
      setShowDebateStream(true);
      return; 
    }

    // LEGACY: Non-streaming path (kept for reference or fallback)
    try {
      // 4. Load Kai runtime prefs (decrypted) for analysis parameters
      const { preferences } = await getPreferences(user.uid, vaultOwnerToken);
      // Risk profile now comes from profile's risk_tolerance (not separate encrypted pref)
      let riskProfile: "conservative" | "balanced" | "aggressive" = "balanced";
      let processingMode: "on_device" | "hybrid" = "hybrid";

      // Map profile's risk_tolerance to orchestrator's risk_profile
      const profileRisk = decryptedContext?.risk_tolerance?.toLowerCase();
      if (
        profileRisk === "conservative" ||
        profileRisk === "balanced" ||
        profileRisk === "aggressive"
      ) {
        riskProfile = profileRisk;
      }

      const decryptKaiPref = async (pref: any): Promise<string | null> => {
        if (!pref?.ciphertext || !pref?.iv || !pref?.tag) return null;
        return decryptData(
          {
            ciphertext: pref.ciphertext,
            iv: pref.iv,
            tag: pref.tag,
            encoding: "base64",
            algorithm: "aes-256-gcm",
          },
          vaultKey
        );
      };

      // Only load processing_mode from preferences (risk comes from profile)
      for (const pref of preferences || []) {
        const plaintext = await decryptKaiPref(pref);
        if (!plaintext) continue;
        if (pref.field_name === "kai_processing_mode") {
          const v = plaintext as any;
          if (v === "on_device" || v === "hybrid") {
            processingMode = v;
          }
        }
      }

      // 5. Call Fundamental Agent with Decrypted Context
      const analysisResponse = await analyzeFundamental({
        user_id: user.uid,
        ticker: targetTicker,
        risk_profile: riskProfile,
        processing_mode: processingMode,
        context: decryptedContext,
        token: vaultOwnerToken,
      });

      // Map to UI Model (Standardizing on Rich Output)
      setResult({
        ticker: analysisResponse.ticker,
        decision: analysisResponse.decision,
        headline: analysisResponse.headline,
        summary:
          analysisResponse.raw_card.fundamental_insight?.summary ||
          analysisResponse.raw_card.debate_digest,
        confidence: analysisResponse.confidence,
        processing_mode: analysisResponse.processing_mode,
        raw_card: analysisResponse.raw_card,
      } as any);

      toast.success(`Analysis complete for ${targetTicker}`);
    } catch (error) {
      console.error("[Kai] Analysis error:", error);
      toast.error("Analysis failed.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div
      className="min-h-dvh text-foreground selection:bg-primary/30 selection:text-foreground pb-20"
      ref={containerRef}
    >
      {/* Background Glow */}
      <div className="fixed inset-0 opacity-30 pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
        {/* Terminal Header */}
        <header className="flex flex-col md:flex-row items-center justify-between gap-8 py-6 border-b border-border/40 backdrop-blur-xs mb-8">
          <div className="space-y-1 text-center md:text-left">
            <div className="flex justify-center md:justify-start gap-2 mb-1">
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 font-semibold uppercase tracking-wider">
                Hushh Technologies
              </span>
            </div>
            <h1 className="text-3xl font-black tracking-tighter flex items-center justify-center md:justify-start gap-3">
              KAI <span className="text-primary/80"></span>
            </h1>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground/80">
              Your Explainable Investing Copilot
            </p>
          </div>

          <form
            onSubmit={(e) => handleSubmit(e)}
            className="w-full md:max-w-md"
          >
            <div className="flex items-center gap-2 p-1.5 rounded-xl border border-border shadow-2xl transition-all focus-within:ring-2 focus-within:ring-primary/20 backdrop-blur-md bg-background/40">
              <div className="flex items-center gap-3 flex-1 px-4">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Ticker (e.g. NVDA)"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value)}
                  className="bg-transparent border-0 outline-none text-base font-black placeholder:text-muted-foreground/50 w-full uppercase tracking-wider"
                  disabled={isAnalyzing}
                />
              </div>
              <Button
                variant="gradient"
                effect="glass"
                showRipple
                size="sm"
                type="submit"
                disabled={!ticker.trim() || isAnalyzing}
                className="rounded-lg h-10 px-6 font-black text-[10px] uppercase tracking-[0.2em] shadow-lg"
              >
                {isAnalyzing ? <HushhLoader variant="compact" /> : "ANALYZE"}
              </Button>
            </div>
            {/* Quick Actions (Persisted) */}
            <div className="flex gap-2 mt-2 justify-center md:justify-end">
              {QUICK_TICKERS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleSubmit(undefined, t)}
                  disabled={isAnalyzing}
                  className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors border border-border/40 hover:border-primary/40 px-3 py-1 rounded-full bg-background/20 disabled:opacity-50 disabled:pointer-events-none"
                >
                  {t}
                </button>
              ))}
            </div>
          </form>
        </header>

        {/* User Preferences Display - Always Visible */}
        {userPreferences && (
          <div className="flex flex-wrap gap-2 mb-6">
            <Badge variant="secondary" className="text-xs px-3 py-1">
              {formatPreferenceBadge("risk", userPreferences.riskProfile)}
            </Badge>
            <Badge variant="secondary" className="text-xs px-3 py-1">
              {formatPreferenceBadge("mode", userPreferences.processingMode)}
            </Badge>
            {userPreferences.investmentStyle.length > 0 && (
              <Badge variant="secondary" className="text-xs px-3 py-1">
                {formatPreferenceBadge(
                  "style",
                  userPreferences.investmentStyle
                )}
              </Badge>
            )}
          </div>
        )}

        {/* INLINE DEBATE VIEW - ALWAYS shows when active (tabs persist after decision) */}
        {showDebateStream && vaultOwnerToken && user && (
          <div className="mb-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <KaiDebateInline
              key={ticker}
              ticker={ticker}
              userId={user.uid}
              riskProfile={userPreferences?.riskProfile || "balanced"}
              vaultOwnerToken={vaultOwnerToken}
              fullResult={result}
              userContext={userContext}
              onComplete={(decision) => {
                // Store result but KEEP debate view visible (tabs persist)
                setResult({
                  ticker: decision.ticker,
                  decision: decision.decision as "buy" | "hold" | "reduce",
                  headline: decision.final_statement,
                  summary: decision.raw_card?.fundamental_insight?.summary || decision.final_statement,
                  confidence: decision.confidence,
                  processing_mode: "hybrid",
                  raw_card: decision.raw_card || ({} as any),
                });
                setIsAnalyzing(false);
                // DON'T hide - tabs stay visible, Decision Card shows full KPI report
                toast.success(`Analysis complete for ${decision.ticker}`);
              }}
              onError={(error) => {
                toast.error(error);
                setShowDebateStream(false);
                setIsAnalyzing(false);
              }}
            />
          </div>
        )}

        {/* Welcome Screen - Only when idle */}
        {!isAnalyzing && !result && (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-12 animate-in fade-in duration-1000">
            <div className="space-y-2 max-w-md mx-auto text-center">
              <p className="text-sm font-medium text-muted-foreground/80 leading-relaxed">
                Initialize analysis on any US equity. The engine will decrypt
                your investor profile locally and securely compute a
                personalized fit score.
              </p>
            </div>

            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
              <Lock className="h-3 w-3" />
              <span>Zero-Knowledge Encryption Active</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
