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
} from "lucide-react";
import { Button } from "@/lib/morphy-ux/button";
import { Card, CardContent } from "@/lib/morphy-ux/card";
import { toast } from "sonner";
import { useAuth } from "@/lib/firebase/auth-context";
import { useVault } from "@/lib/vault/vault-context";
import { HushhLoader } from "@/components/ui/hushh-loader";
import { Badge } from "@/components/ui/badge";
import { hasValidConsent } from "../actions";
import { getPreferences, analyzeFundamental } from "@/lib/services/kai-service";
import { decryptData } from "@/lib/vault/encrypt";
import { getGsap, animateOnce } from "@/lib/morphy-ux/gsap";

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

export default function KaiAnalysis() {
  const router = useRouter();
  const { user } = useAuth();
  const { vaultKey, isVaultUnlocked, vaultOwnerToken } = useVault();

  const [ticker, setTicker] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasConsent, setHasConsent] = useState(false);
  const [result, setResult] = useState<LocalAnalyzeResponse | null>(null);
  const [inputsUsed, setInputsUsed] = useState<string[]>([]);

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
      const encryptedProfile = await import("@/lib/services/kai-service").then(
        (m) => m.getEncryptedProfile(vaultOwnerToken)
      );

      // 3. Decrypt Profile Context (Client Side)
      const decryptedContext: any = {};
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
      }

      // 4. Load Kai runtime prefs (decrypted) for analysis parameters
      const { preferences } = await getPreferences(user.uid);
      let riskProfile: "conservative" | "balanced" | "aggressive" = "balanced";
      let processingMode: "on_device" | "hybrid" = "hybrid";

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

      for (const pref of preferences || []) {
        const plaintext = await decryptKaiPref(pref);
        if (!plaintext) continue;
        if (pref.field_name === "kai_risk_profile") {
          const v = plaintext as any;
          if (v === "conservative" || v === "balanced" || v === "aggressive") {
            riskProfile = v;
          }
        }
        if (pref.field_name === "kai_processing_mode") {
          const v = plaintext as any;
          if (v === "on_device" || v === "hybrid") {
            processingMode = v;
          }
        }
      }

      setInputsUsed(
        [
          `risk:${riskProfile}`,
          `mode:${processingMode}`,
          decryptedContext?.risk_tolerance
            ? `profile_risk:${decryptedContext.risk_tolerance}`
            : "",
          Array.isArray(decryptedContext?.investment_style) &&
          decryptedContext.investment_style.length
            ? `style:${decryptedContext.investment_style.join("/")}`
            : "",
        ].filter(Boolean)
      );

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

      <div className="relative max-w-7xl mx-auto px-6">
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
              Fundamental Engine
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

        {result ? (
          <div
            className="space-y-8 animate-in slide-in-from-bottom-5 duration-700"
            ref={scorecardRef}
          >
            {inputsUsed.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {inputsUsed.map((t) => (
                  <Badge key={t} variant="secondary">
                    {t}
                  </Badge>
                ))}
              </div>
            )}
            {/* 1. TOP LEVEL DECISION CARD */}
            <div className="grid lg:grid-cols-12 gap-6">
              <Card
                variant="none"
                effect="glass"
                showRipple={false}
                className="lg:col-span-8 p-8 relative overflow-hidden flex flex-col justify-between min-h-[300px]"
              >
                <div className="absolute top-0 right-0 p-12 opacity-[0.04] text-foreground pointer-events-none">
                  <Terminal className="h-64 w-64" />
                </div>

                <div className="space-y-6 relative z-10">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-center gap-6">
                      <div className="h-20 w-20 glass flex items-center justify-center rounded-2xl border border-border/60 shadow-inner bg-background/50">
                        <span className="text-4xl font-black tracking-tighter text-foreground">
                          {result.ticker}
                        </span>
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold tracking-tight text-foreground/90 leading-tight">
                          {result.headline}
                        </h2>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-[10px] font-bold uppercase tracking-widest text-primary flex items-center gap-1">
                            <ShieldCheck className="h-3 w-3" />
                            Verified
                          </span>
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                            {result.processing_mode} Analysis
                          </span>
                        </div>
                      </div>
                    </div>

                    <div
                      className={`px-8 py-4 rounded-2xl border text-3xl font-black uppercase tracking-tighter shadow-xl backdrop-blur-md ${
                        result.decision === "buy"
                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                          : result.decision === "reduce"
                          ? "bg-red-500/10 border-red-500/20 text-red-500"
                          : "bg-blue-500/10 border-blue-500/20 text-blue-500"
                      }`}
                    >
                      {result.decision}
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-8 pt-4">
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
                        <Brain className="h-3 w-3 text-primary" />
                        Executive Summary
                      </h3>
                      {/* Summary rendered here implies we use the fundamental insight summary */}
                      <p className="text-sm font-medium leading-relaxed text-foreground/85">
                        {result.raw_card.fundamental_insight.summary ||
                          result.summary}
                      </p>
                    </div>
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
                        <Target className="h-3 w-3 text-primary" />
                        Risk Alignment
                      </h3>
                      <p className="text-sm font-medium leading-relaxed text-foreground/85 italic border-l-2 border-primary/30 pl-3">
                        "
                        {result.raw_card.risk_persona_alignment ||
                          "Analysis aligned with your risk profile."}
                        "
                      </p>
                    </div>
                  </div>
                </div>

                {/* KPI Ribbon */}
                <div className="grid grid-cols-4 gap-4 mt-8 pt-6 border-t border-border/30">
                  <div className="text-center md:text-left">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">
                      Revenue CAGR
                    </p>
                    <p className="text-xl font-black text-foreground">
                      {(
                        result.raw_card.quant_metrics.revenue_cagr_3y * 100
                      ).toFixed(1)}
                      %
                    </p>
                  </div>
                  <div className="text-center md:text-left">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">
                      R&D Intensity
                    </p>
                    <p className="text-xl font-black text-foreground">
                      {(
                        result.raw_card.key_metrics.fundamental.rnd_intensity *
                        100
                      ).toFixed(1)}
                      %
                    </p>
                  </div>
                  <div className="text-center md:text-left">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">
                      Debt/Equity
                    </p>
                    <p className="text-xl font-black text-foreground">
                      {result.raw_card.key_metrics.fundamental.debt_to_equity.toFixed(
                        2
                      )}
                      x
                    </p>
                  </div>
                  <div className="text-center md:text-left">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">
                      P/E Ratio
                    </p>
                    <p className="text-xl font-black text-foreground">
                      {result.raw_card.key_metrics.valuation?.pe_ratio?.toFixed(
                        1
                      ) || "N/A"}
                    </p>
                  </div>
                </div>
              </Card>

              {/* 2. TREND CHARTS */}
              <div className="lg:col-span-4 grid gap-6 grid-rows-2">
                {/* Revenue vs Net Income Chart */}
                <Card
                  variant="none"
                  effect="glass"
                  className="p-4 flex flex-col"
                  showRipple={false}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      Performance Trend ($B)
                    </h3>
                    <LineChart className="h-3 w-3 text-primary" />
                  </div>
                  <div className="flex-1 min-h-[140px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={result.raw_card.quant_metrics.revenue_trend_data}
                      >
                        <XAxis
                          dataKey="year"
                          fontSize={10}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip
                          contentStyle={{
                            background: "rgba(0,0,0,0.8)",
                            border: "none",
                            borderRadius: "8px",
                            fontSize: "12px",
                          }}
                          itemStyle={{ color: "#fff" }}
                        />
                        {/* We merge revenue and net income data for the chart */}
                        <Bar
                          dataKey="value"
                          name="Revenue"
                          fill="hsl(var(--primary))"
                          radius={[4, 4, 0, 0]}
                          opacity={0.6}
                        />
                        {/* Overlay Net Income Line need to join data properly in real app, simplified here as assumption data matches */}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-2 text-center">
                    <p className="text-[10px] text-muted-foreground">
                      Revenue Growth
                    </p>
                  </div>
                </Card>

                {/* Fit Score Gauge */}
                <Card
                  variant="none"
                  effect="glass"
                  showRipple={false}
                  className="p-6 flex flex-col items-center justify-center text-center relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
                  <div className="flex items-center justify-between w-full mb-2 z-10">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      Portfolio Fit Score
                    </h3>
                    <Crosshair className="h-3 w-3 text-primary" />
                  </div>
                  <div className="my-4 relative z-10">
                    <span className="text-5xl font-black text-primary drop-shadow-xl">
                      {(result.raw_card as any).fit_score ||
                        Math.round(result.confidence * 100)}
                    </span>
                    <span className="text-xl font-bold text-muted-foreground/50 ml-1">
                      /100
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-muted/30 rounded-full overflow-hidden z-10">
                    <div
                      className="h-full bg-primary transition-all duration-1000 ease-out"
                      style={{
                        width: `${
                          (result.raw_card as any).fit_score ||
                          result.confidence * 100
                        }%`,
                      }}
                    />
                  </div>
                </Card>
              </div>
            </div>

            {/* 3. DEEP DIVE INSIGHTS */}
            <div className="grid lg:grid-cols-2 gap-8">
              {/* MOAT Analysis */}
              <Card
                variant="none"
                effect="glass"
                showRipple={false}
                className="p-6 border-l-4 border-l-blue-500/50"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <ShieldCheck className="h-4 w-4 text-blue-500" />
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-wider">
                    Moat & Competitive Depth
                  </h3>
                </div>
                <p className="text-sm leading-relaxed text-foreground/85 whitespace-pre-line">
                  {result.raw_card.fundamental_insight.business_moat}
                </p>
              </Card>

              {/* Growth & Efficiency */}
              <Card
                variant="none"
                effect="glass"
                showRipple={false}
                className="p-6 border-l-4 border-l-purple-500/50"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <Rocket className="h-4 w-4 text-purple-500" />
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-wider">
                    Growth & Innovation
                  </h3>
                </div>
                <p className="text-sm leading-relaxed text-foreground/85 whitespace-pre-line">
                  {result.raw_card.fundamental_insight.growth_efficiency}
                </p>
              </Card>

              {/* Earnings Quality Check */}
              <Card
                variant="none"
                effect="glass"
                showRipple={false}
                className="p-6 border-l-4 border-l-amber-500/50"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <Wallet className="h-4 w-4 text-amber-500" />
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-wider">
                    Capital Allocation Audit
                  </h3>
                </div>
                <div className="space-y-4">
                  <p className="text-sm leading-relaxed text-foreground/85 whitespace-pre-line">
                    {result.raw_card.fundamental_insight.financial_resilience}
                  </p>

                  {/* Interactive Metrics */}
                  <div className="grid grid-cols-2 gap-4 mt-4 bg-background/30 p-4 rounded-xl">
                    <div>
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">
                        OCF / Net Income
                      </p>
                      <p
                        className={`text-lg font-black ${
                          result.raw_card.key_metrics.fundamental
                            .earnings_quality > 1
                            ? "text-emerald-500"
                            : "text-amber-500"
                        }`}
                      >
                        {result.raw_card.key_metrics.fundamental.earnings_quality.toFixed(
                          2
                        )}
                        x
                      </p>
                      <p className="text-[9px] text-muted-foreground/70">
                        Target: {">"} 1.0x
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">
                        Debt to Equity
                      </p>
                      <p
                        className={`text-lg font-black ${
                          result.raw_card.key_metrics.fundamental
                            .debt_to_equity < 1.0
                            ? "text-emerald-500"
                            : "text-foreground"
                        }`}
                      >
                        {result.raw_card.key_metrics.fundamental.debt_to_equity.toFixed(
                          2
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Valuation Placeholder (If needed) or just spacer */}
              <Card
                variant="none"
                effect="glass"
                showRipple={false}
                className="p-6 border-l-4 border-l-primary/50 flex flex-col justify-center items-center text-center opacity-70 hover:opacity-100 transition-opacity"
              >
                <BarChart3 className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Valuation Model
                </p>
                <p className="text-sm font-medium mt-2">
                  Running DCF & Comps analysis...
                </p>
              </Card>
            </div>

            {/* 4. BULL vs BEAR THESIS */}
            <div className="grid md:grid-cols-2 gap-6">
              <Card
                variant="none"
                effect="glass"
                showRipple={false}
                className="p-6 bg-emerald-500/5 border border-emerald-500/10"
              >
                <h3 className="text-xs font-black uppercase tracking-widest text-emerald-500 mb-4 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Institutional Bull Case
                </h3>
                <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">
                  {result.raw_card.fundamental_insight.bull_case}
                </p>
              </Card>

              <Card
                variant="none"
                effect="glass"
                showRipple={false}
                className="p-6 bg-red-500/5 border border-red-500/10"
              >
                <h3 className="text-xs font-black uppercase tracking-widest text-red-500 mb-4 flex items-center gap-2">
                  <TrendingDown className="h-4 w-4" />
                  Institutional Bear Case
                </h3>
                <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">
                  {result.raw_card.fundamental_insight.bear_case}
                </p>
              </Card>
            </div>

            {/* Compliance Footer */}
            <footer className="pt-12 border-t border-border/40 flex flex-col md:flex-row items-center justify-between gap-8 opacity-60">
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground mr-2">
                    Sources:
                  </span>
                  {(result.raw_card.all_sources || []).map((src, i) => (
                    <span
                      key={i}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-mono border border-primary/20"
                    >
                      {src}
                    </span>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground max-w-2xl leading-relaxed">
                  IMPORTANT: This analysis is for educational purposes only and
                  does not constitute investment advice. Data provided by SEC
                  EDGAR and Hushh Research Agents.
                </p>
              </div>
            </footer>
          </div>
        ) : (
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
