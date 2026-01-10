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
import { hasValidConsent, getConsentToken } from "../actions";
import { getPreferences, analyzeTicker } from "@/lib/services/kai-service";
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
  const { vaultKey, isVaultUnlocked } = useVault();

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

    const consentToken = await getConsentToken("agent.kai.analyze");

    // Implicit Auth: If no token, we proceed relying on Session Cookie/Header
    if (!consentToken) {
      console.log(
        "[Kai] No explicit consent token. Attempting implicit session auth."
      );
    }

    setIsAnalyzing(true);
    // Don't clear result immediately to allow transition if re-analyzing
    setResult(null);

    if (overrideTicker) setTicker(overrideTicker);

    try {
      let riskProfile = "balanced";
      let processingMode = "hybrid";

      try {
        const { preferences } = await getPreferences(user.uid);
        for (const pref of preferences) {
          const decryptedResult = await decryptData(
            {
              ciphertext: pref.ciphertext,
              iv: pref.iv,
              tag: pref.tag || "",
              encoding: "base64",
              algorithm: "aes-256-gcm",
            },
            vaultKey
          );

          if (pref.field_name === "kai_risk_profile") {
            riskProfile = decryptedResult;
          } else if (pref.field_name === "kai_processing_mode") {
            processingMode = decryptedResult;
          }
        }
      } catch (err) {
        console.warn("[Kai] Preference loading fallback", err);
      }

      const analysis = await analyzeTicker({
        user_id: user.uid,
        ticker: targetTicker.toUpperCase(),
        consent_token: consentToken || undefined,
        risk_profile: riskProfile as any,
        processing_mode: processingMode as any,
      });

      setResult(analysis as any);
      toast.success(`Analysis for ${targetTicker.toUpperCase()} complete`);
    } catch (error) {
      console.error("[Kai] Analysis error:", error);
      toast.error("Analysis failed. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Prepare chart data for trends
  const trendData =
    result?.raw_card?.quant_metrics?.revenue_trend_data?.map((rev, i) => ({
      year: rev.year,
      revenue: rev.value,
      netIncome:
        result.raw_card.quant_metrics.net_income_trend_data[i]?.value || 0,
      ocf: result.raw_card.quant_metrics.ocf_trend_data[i]?.value || 0,
      rnd: result.raw_card.quant_metrics.rnd_trend_data?.[i]?.value || 0,
    })) || [];

  return (
    <div
      className="min-h-dvh morphy-app-bg text-foreground selection:bg-primary/30 selection:text-foreground"
      ref={containerRef}
    >
      {/* Background Glow */}
      <div className="fixed inset-0 morphy-app-bg-radial opacity-30 pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-6 py-12 lg:py-20 space-y-12">
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
            {/* Institutional Scorecard */}
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
                          SEC Fact Verified • {result.processing_mode} Analysis
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

              <div className="space-y-6">
                <Card variant="none" effect="glass" className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      Confidence
                    </span>
                    <span className="text-lg font-black text-primary">
                      {(result.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      style={{ width: `${result.confidence * 100}%` }}
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
                      Revenue CAGR
                    </p>
                    <p className="text-lg font-black text-foreground">
                      {(
                        result.raw_card.quant_metrics.revenue_cagr_3y * 100
                      ).toFixed(1)}
                      %
                    </p>
                  </Card>
                  <Card
                    variant="metallic"
                    effect="glass"
                    className="p-4 text-center"
                  >
                    <p className="text-[9px] font-black text-muted-foreground uppercase mb-1">
                      R&D Intensity
                    </p>
                    <p className="text-lg font-black text-foreground">
                      {(
                        result.raw_card.key_metrics.fundamental.rnd_intensity *
                        100
                      ).toFixed(1)}
                      %
                    </p>
                  </Card>
                </div>
              </div>
            </div>

            {/* Multi-Series Trend Visualization (RESTORED) */}
            <div className="grid lg:grid-cols-2 gap-6">
              <Card variant="none" effect="glass" className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xs font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Performance Trend ($B)
                  </h3>
                  <div className="flex gap-4">
                    <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase">
                      <div className="h-2 w-2 rounded-full bg-primary" />{" "}
                      Revenue
                    </span>
                    <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase">
                      <div className="h-2 w-2 rounded-full bg-emerald-500" />{" "}
                      OCF
                    </span>
                  </div>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData}>
                      <defs>
                        <linearGradient
                          id="colorRev"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#0071e3"
                            stopOpacity={0.1}
                          />
                          <stop
                            offset="95%"
                            stopColor="#0071e3"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="rgba(255,255,255,0.05)"
                      />
                      <XAxis
                        dataKey="year"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#888", fontSize: 10, fontWeight: 700 }}
                      />
                      <YAxis hide />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "rgba(0,0,0,0.8)",
                          borderRadius: "12px",
                          border: "1px solid rgba(255,255,255,0.1)",
                        }}
                        itemStyle={{ fontSize: "12px", fontWeight: "bold" }}
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="#0071e3"
                        fillOpacity={1}
                        fill="url(#colorRev)"
                        strokeWidth={3}
                      />
                      <Area
                        type="monotone"
                        dataKey="ocf"
                        stroke="#10b981"
                        fill="transparent"
                        strokeWidth={3}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <div className="space-y-6">
                {/* Moat Audit */}
                <Card
                  variant="none"
                  effect="glass"
                  className="p-8 relative overflow-hidden group h-full"
                >
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-30 transition-opacity">
                    <ShieldCheck className="h-20 w-20 text-primary" />
                  </div>
                  <h3 className="text-xs font-black uppercase tracking-[0.3em] text-primary mb-4">
                    Moat & Competitive Depth
                  </h3>
                  <p className="text-base leading-relaxed text-foreground/90 font-medium">
                    {result.raw_card.fundamental_insight.business_moat}
                  </p>
                </Card>
              </div>
            </div>

            {/* Deep Quant Charts */}
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Chart 1: Growth & Innovation */}
              <Card variant="none" effect="glass" className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xs font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2">
                    <Cpu className="h-4 w-4" />
                    Growth & Innovation ($B)
                  </h3>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={trendData}>
                      <defs>
                        <linearGradient
                          id="colorRev"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#0071e3"
                            stopOpacity={0.15}
                          />
                          <stop
                            offset="95%"
                            stopColor="#0071e3"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="rgba(255,255,255,0.05)"
                      />
                      <XAxis
                        dataKey="year"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#888", fontSize: 10, fontWeight: 700 }}
                      />
                      <YAxis hide />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "rgba(0,0,0,0.8)",
                          borderRadius: "12px",
                          border: "1px solid rgba(255,255,255,0.1)",
                          backdropFilter: "blur(10px)",
                        }}
                        itemStyle={{ fontSize: "12px", fontWeight: "bold" }}
                        labelStyle={{
                          color: "#fff",
                          fontSize: "12px",
                          fontWeight: "900",
                          marginBottom: "8px",
                        }}
                      />
                      <Legend
                        iconType="circle"
                        wrapperStyle={{
                          fontSize: "10px",
                          textTransform: "uppercase",
                          fontWeight: 700,
                          paddingTop: "20px",
                        }}
                      />
                      <Area
                        type="monotone"
                        name="Revenue"
                        dataKey="revenue"
                        stroke="#0071e3"
                        fillOpacity={1}
                        fill="url(#colorRev)"
                        strokeWidth={3}
                      />
                      <Bar
                        name="R&D Spend"
                        dataKey="rnd"
                        barSize={20}
                        fill="#bb62fc"
                        radius={[4, 4, 0, 0]}
                        opacity={0.8}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* Chart 2: Earnings Quality */}
              <Card variant="none" effect="glass" className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xs font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Earnings Quality ($B)
                  </h3>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={trendData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="rgba(255,255,255,0.05)"
                      />
                      <XAxis
                        dataKey="year"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#888", fontSize: 10, fontWeight: 700 }}
                      />
                      <YAxis hide />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "rgba(0,0,0,0.8)",
                          borderRadius: "12px",
                          border: "1px solid rgba(255,255,255,0.1)",
                          backdropFilter: "blur(10px)",
                        }}
                        itemStyle={{ fontSize: "12px", fontWeight: "bold" }}
                        labelStyle={{
                          color: "#fff",
                          fontSize: "12px",
                          fontWeight: "900",
                          marginBottom: "8px",
                        }}
                      />
                      <Legend
                        iconType="circle"
                        wrapperStyle={{
                          fontSize: "10px",
                          textTransform: "uppercase",
                          fontWeight: 700,
                          paddingTop: "20px",
                        }}
                      />
                      <Bar
                        name="Net Income"
                        dataKey="netIncome"
                        barSize={30}
                        fill="#374151"
                        radius={[4, 4, 0, 0]}
                        opacity={0.5}
                      />
                      <Line
                        type="monotone"
                        name="Operating Cash Flow"
                        dataKey="ocf"
                        stroke="#10b981"
                        strokeWidth={3}
                        dot={{ r: 4, strokeWidth: 2 }}
                        activeDot={{ r: 6 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>

            {/* Strategic Analysis & Moat (Adjusted Layout) */}
            <div className="grid lg:grid-cols-2 gap-6">
              <Card variant="none" effect="glass" className="p-8 h-full">
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-muted-foreground mb-4">
                  Capital Allocation Audit
                </h3>
                <p className="text-base leading-relaxed text-foreground/80 italic">
                  "{result.raw_card.fundamental_insight.growth_efficiency}"
                </p>
              </Card>

              <Card variant="none" effect="glass" className="p-8 h-full">
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-muted-foreground mb-4">
                  Earnings Quality Check
                </h3>
                <p className="text-base leading-relaxed text-foreground/80">
                  {result.raw_card.fundamental_insight.financial_resilience}
                </p>
                <div className="mt-6 flex items-center gap-6">
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">
                      OCF / Net Income
                    </p>
                    <p
                      className={`text-xl font-black ${
                        result.raw_card.key_metrics.fundamental
                          .earnings_quality > 1
                          ? "text-emerald-500"
                          : "text-orange-500"
                      }`}
                    >
                      {result.raw_card.key_metrics.fundamental.earnings_quality.toFixed(
                        2
                      )}
                      x
                    </p>
                  </div>
                  <div className="h-10 w-px bg-border/40" />
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">
                      Debt to Equity
                    </p>
                    <p className="text-xl font-black text-foreground">
                      {result.raw_card.key_metrics.fundamental.debt_to_equity.toFixed(
                        2
                      )}
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Bull / Bear (Full Visibility) */}
            <div className="grid md:grid-cols-2 gap-6">
              <Card
                variant="green"
                effect="fade"
                className="p-8 transition-all"
              >
                <h3 className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-2">
                  Institutional Bull Case
                </h3>
                <p className="text-sm font-medium leading-relaxed text-foreground/90">
                  {result.raw_card.fundamental_insight.bull_case}
                </p>
              </Card>
              <Card
                variant="orange"
                effect="fade"
                className="p-8 transition-all"
              >
                <h3 className="text-[10px] font-black uppercase tracking-widest text-orange-500 mb-2">
                  Institutional Bear Case
                </h3>
                <p className="text-sm font-medium leading-relaxed text-foreground/90">
                  {result.raw_card.fundamental_insight.bear_case}
                </p>
              </Card>
            </div>

            {/* Compliance & Receipts (Shadcn Badges) */}
            <footer className="pt-12 border-t border-border/40 flex flex-col md:flex-row items-center justify-between gap-8 opacity-60">
              <div className="flex flex-wrap gap-2">
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground mr-2">
                  References:
                </span>
                {result.raw_card.all_sources.map((s, i) => (
                  <div
                    key={i}
                    className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  >
                    {s}
                  </div>
                ))}
              </div>
              <Button
                variant="link"
                onClick={() => {
                  const cik =
                    result.raw_card?.fundamental_insight?.key_metrics?.cik;
                  window.open(
                    `https://www.sec.gov/edgar/browse/?CIK=${cik || ""}`,
                    "_blank"
                  );
                }}
                className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-primary"
              >
                Open Raw Filings <Lock className="h-3 w-3" />
              </Button>
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
                Initialize analysis on any US equity. The engine will parse
                real-time SEC EDGAR filings, extract 3-year historical trends,
                and audit earnings quality.
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
