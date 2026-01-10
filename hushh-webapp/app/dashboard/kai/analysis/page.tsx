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
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Search,
  Sparkles,
  Lock,
  AlertTriangle,
  Info,
  TrendingUp,
  Activity,
  ShieldCheck,
  Zap,
  Terminal,
  Cpu,
  BarChart3,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { Button } from "@/lib/morphy-ux/button";
import { Card, CardContent } from "@/lib/morphy-ux/card";
import { toast } from "sonner";
import { useAuth } from "@/lib/firebase/auth-context";
import { useVault } from "@/lib/vault/vault-context";
import { hasValidConsent } from "../actions";
import { getPreferences, analyzeFundamental } from "@/lib/services/kai-service";
import { decryptData } from "@/lib/vault/encrypt";
import { getGsap, animateOnce } from "@/lib/morphy-ux/gsap";

interface TrendDataPoint {
  year: string;
  value: number;
}

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
      key_metrics?: {
        cik?: string;
      };
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
    };
  };
}

const QUICK_TICKERS = ["NVDA", "AAPL", "MSFT", "TSLA"];

export default function KaiAnalysis() {
  const router = useRouter();
  const { user } = useAuth();
  const { vaultKey, isVaultUnlocked, vaultOwnerToken } = useVault();

  const [ticker, setTicker] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasConsent, setHasConsent] = useState(false);
  const [result, setResult] = useState<LocalAnalyzeResponse | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const scorecardRef = useRef<HTMLDivElement>(null);

  // Check consent on mount
  useEffect(() => {
    const checkConsent = async () => {
      if (!user) return;
      const hasTokens = await hasValidConsent("agent.kai.analyze");
      setHasConsent(hasTokens);
    };
    checkConsent();
  }, [user]);

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

    try {
      // 2. Fetch Encrypted Profile (Ciphertext)
      // Requires VAULT_OWNER token
      const encryptedProfile = await import("@/lib/services/kai-service").then(
        (m) => m.getEncryptedProfile(vaultOwnerToken)
      );

      // 3. Decrypt Profile Context (Client Side)
      const decryptedContext: any = {};

      // Decrypt "profile_data" blob
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
        // Parse JSON string -> Object
        const profileObj = JSON.parse(profileJson);
        Object.assign(decryptedContext, profileObj);
      }

      // 4. Call Fundamental Agent with Decrypted Context (Rich Engine)
      const analysisResponse = await analyzeFundamental({
        user_id: user.uid,
        ticker: targetTicker,
        risk_profile: "balanced", // TODO: Derive from context or preferences
        processing_mode: "hybrid",
        context: decryptedContext,
        token: vaultOwnerToken,
      });

      // Map to UI Model (Adapter)
      // The Rich Engine returns { decision, headline, raw_card: { fundamental_insight, ... } }
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
      toast.error(
        "Analysis failed. Ensure you have an Investor Profile loaded."
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div
      className="min-h-dvh text-foreground selection:bg-primary/30 selection:text-foreground"
      ref={containerRef}
    >
      {/* Background Glow */}
      <div className="fixed inset-0 opacity-30 pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-6">
        {/* Terminal Header */}
        <header className="flex flex-col md:flex-row items-center justify-between gap-8 py-4 border-b border-border/40 backdrop-blur-xs">
          <div className="space-y-1 text-center md:text-left">
            <h1 className="text-3xl font-black tracking-tighter flex items-center justify-center md:justify-start gap-2">
              <Activity className="h-6 w-6 text-primary animate-pulse" />
              KAI <span className="text-primary">TERMINAL</span>
            </h1>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">
              Institutional Grade Fundamental Engine
            </p>
          </div>

          {/* Preferences Button - Use Link for client-side nav to preserve vault state */}
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/kai/preferences"
              className="glass-interactive px-3 py-2 rounded-lg flex items-center gap-2 text-sm font-medium hover:bg-primary/10 transition-colors"
            >
              <ShieldCheck className="h-4 w-4 text-primary" />
              Preferences
            </Link>
          </div>

          <form
            onSubmit={(e) => handleSubmit(e)}
            className="w-full md:max-w-md"
          >
            <div className="glass-interactive flex items-center gap-2 p-1.5 rounded-xl border border-border shadow-2xl transition-all focus-within:ring-2 focus-within:ring-primary/20 backdrop-blur-md">
              <div className="flex items-center gap-2 flex-1 px-3">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Ticker (e.g. NVDA)"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value)}
                  className="bg-transparent border-0 outline-none text-sm font-bold placeholder:text-muted-foreground/50 w-full uppercase"
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
                className="rounded-lg h-9 px-4 font-black text-[10px] uppercase tracking-widest shadow-lg"
              >
                {isAnalyzing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "ANALYZE"
                )}
              </Button>
            </div>
          </form>
        </header>

        {result ? (
          <div className="space-y-8" ref={scorecardRef}>
            {/* Institutional Scorecard Header */}
            <div className="grid lg:grid-cols-3 gap-6">
              <Card
                variant="none"
                effect="glass"
                className="lg:col-span-2 p-8 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-12 opacity-[0.03] text-foreground pointer-events-none">
                  <Terminal className="h-64 w-64" />
                </div>
                <div className="relative space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="h-16 w-16 glass flex items-center justify-center rounded-2xl border border-border shadow-inner">
                        <span className="text-3xl font-black tracking-tighter">
                          {result.ticker}
                        </span>
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold tracking-tight">
                          {result.headline}
                        </h2>
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                          <ShieldCheck className="h-3 w-3" />
                          Authenticated • {result.processing_mode} Analysis
                        </p>
                      </div>
                    </div>
                    <div
                      className={`px-8 py-3 rounded-2xl border text-xl font-black uppercase tracking-tighter shadow-xl ${
                        result.decision === "buy"
                          ? "bg-green-500/10 border-green-500/20 text-green-500"
                          : result.decision === "reduce"
                          ? "bg-red-500/10 border-red-500/20 text-red-500"
                          : "bg-blue-500/10 border-blue-500/20 text-blue-500"
                      }`}
                    >
                      {result.decision}
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed text-foreground/80 font-medium max-w-2xl">
                    {result.summary}
                  </p>
                </div>
              </Card>

              {/* Confidence & Quick Stats */}
              <div className="space-y-6">
                <Card variant="none" effect="glass" className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      Fit Score
                    </span>
                    <span className="text-lg font-black text-primary">
                      {(result.raw_card as any).fit_score || 0}/100
                    </span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      style={{
                        width: `${(result.raw_card as any).fit_score || 0}%`,
                      }}
                      className="h-full bg-primary transition-all duration-1000 ease-out"
                    />
                  </div>
                </Card>

                <div className="grid grid-cols-2 gap-4">
                  <Card
                    variant="metallic"
                    effect="glass"
                    className="p-4 text-center"
                  >
                    <p className="text-[9px] font-black text-muted-foreground uppercase mb-1">
                      P/E Ratio
                    </p>
                    <p className="text-lg font-black text-foreground">
                      {(result.raw_card as any).market_data?.pe_ratio?.toFixed(
                        1
                      ) || "N/A"}
                    </p>
                  </Card>
                  <Card
                    variant="metallic"
                    effect="glass"
                    className="p-4 text-center"
                  >
                    <p className="text-[9px] font-black text-muted-foreground uppercase mb-1">
                      Beta
                    </p>
                    <p className="text-lg font-black text-foreground">
                      {(result.raw_card as any).market_data?.beta?.toFixed(2) ||
                        "N/A"}
                    </p>
                  </Card>
                </div>
              </div>
            </div>

            {/* Contextual Logic Factors (The "Why") */}
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Render Factors dynamically */}
              {((result.raw_card as any).factors || []).map(
                (factor: any, idx: number) => (
                  <Card
                    key={idx}
                    variant="none"
                    effect="glass"
                    className="p-6 h-full border-t-4 border-t-primary/50"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">
                        {factor.factor_name}
                      </h3>
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded ${
                          factor.score > 0
                            ? "bg-green-500/20 text-green-500"
                            : "bg-red-500/20 text-red-500"
                        }`}
                      >
                        {factor.score > 0 ? "+" : ""}
                        {factor.score}
                      </span>
                    </div>
                    <p className="text-sm font-medium leading-relaxed text-foreground/90">
                      {factor.reasoning}
                    </p>
                  </Card>
                )
              )}
            </div>

            {/* Compliance Footer */}
            <footer className="pt-12 border-t border-border/40 flex flex-col md:flex-row items-center justify-between gap-8 opacity-60">
              <div className="flex flex-wrap gap-2">
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground mr-2">
                  Market Data:
                </span>
                <span className="text-xs font-mono">
                  {(result.raw_card as any).market_data?.description?.substring(
                    0,
                    100
                  )}
                  ...
                </span>
              </div>
            </footer>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-12 animate-in fade-in duration-1000">
            {/* Terminal Quick Start */}
            <div className="relative group">
              <div className="absolute inset-0 bg-primary/20 blur-3xl opacity-20 rounded-full group-hover:opacity-30 transition-opacity" />
              <div className="h-24 w-24 glass rounded-4xl flex items-center justify-center border border-border bg-background/50 backdrop-blur-md shadow-2xl relative z-10 mx-auto">
                <Terminal className="h-10 w-10 text-primary" />
              </div>
            </div>

            <div className="space-y-2 max-w-md mx-auto">
              <h3 className="text-2xl font-black tracking-tight">
                Command Center Ready
              </h3>
              <p className="text-sm font-medium text-muted-foreground/80 leading-relaxed">
                Initialize analysis on any US equity. The engine will decrypt
                your investor profile locally and securely compute a
                personalized fit score.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-2xl">
              {QUICK_TICKERS.map((t) => (
                <Button
                  key={t}
                  variant="metallic"
                  effect="glass"
                  showRipple
                  onClick={() => handleSubmit(undefined, t)}
                  className="h-16 flex flex-col items-center justify-center gap-1 rounded-2xl border border-border/50 hover:border-primary/50 transition-colors"
                >
                  <span className="text-lg font-black tracking-tighter">
                    {t}
                  </span>
                  <span className="text-[9px] font-bold uppercase text-muted-foreground">
                    Quick Scan
                  </span>
                </Button>
              ))}
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
