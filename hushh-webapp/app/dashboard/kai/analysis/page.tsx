"use client";

/**
 * Kai Analysis Dashboard - Production Ready
 * Zero-Knowledge Architecture:
 * 1. Request Analysis (Server -> Plaintext)
 * 2. Encrypt locally (Client + Vault Key)
 * 3. Store Decision (Client -> Server)
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/lib/morphy-ux/morphy";
import { Search, Sparkles, AlertCircle, Lock } from "lucide-react";
import { useAuth } from "@/lib/firebase/auth-context";
import { useVault } from "@/lib/vault/vault-context";
import { HushhVault } from "@/lib/capacitor";
import {
  analyzeTicker,
  getPreferences,
  type AnalyzeResponse,
} from "@/lib/services/kai-service";
import { hasValidConsent, getConsentToken } from "../actions";

export default function KaiAnalysis() {
  const router = useRouter();
  const { user } = useAuth();
  const { vaultKey, isVaultUnlocked } = useVault();

  const [ticker, setTicker] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasConsent, setHasConsent] = useState(false);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);

  // Check consent on mount
  useEffect(() => {
    const checkConsent = async () => {
      if (!user) return;
      const hasTokens = await hasValidConsent("agent.kai.analyze");
      setHasConsent(hasTokens);
    };
    checkConsent();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticker.trim() || !user?.uid) return;

    if (!isVaultUnlocked || !vaultKey) {
      toast.error("Please unlock your vault to perform analysis.");
      return;
    }

    const consentToken = await getConsentToken("agent.kai.analyze");
    if (!consentToken) {
      toast.error("Missing consent. Please re-onboard.");
      router.push("/dashboard/kai");
      return;
    }

    setIsAnalyzing(true);
    setResult(null);

    try {
      // 1. Get Preferences (Source of Truth) directly from DB
      // We start with defaults, then override from DB
      let riskProfile = "balanced";
      let processingMode = "hybrid";

      try {
        console.log("[Kai] Fetching fresh preferences from DB...");
        const { preferences } = await getPreferences(user.uid);

        // Decrypt them on the fly
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
            riskProfile = decryptedResult.plaintext;
          } else if (pref.field_name === "kai_processing_mode") {
            processingMode = decryptedResult.plaintext;
          }
        }
        console.log(
          `[Kai] Loaded preferences - Risk: ${riskProfile}, Mode: ${processingMode}`
        );
      } catch (err) {
        console.warn(
          "[Kai] Failed to load fresh prefs, falling back to defaults",
          err
        );
      }

      console.log(
        `[Kai] Analyzing with Profile: ${riskProfile}, Mode: ${processingMode}`
      );

      // 2. Perform Analysis (Returns Plaintext)
      const analysisMs = Date.now();
      const analysis = await analyzeTicker({
        user_id: user.uid,
        ticker: ticker.toUpperCase(),
        consent_token: consentToken,
        risk_profile: riskProfile as any,
        processing_mode: processingMode as any,
      });

      console.log(`[Kai] Analysis received in ${Date.now() - analysisMs}ms`);
      setResult(analysis);

      // Note: Auto-save removed. User can manually save if needed.
    } catch (error) {
      console.error("[Kai] Analysis error:", error);
      toast.error("Analysis failed. Please try again.");
    } finally {
      setIsAnalyzing(false);
      setTicker("");
    }
  };

  return (
    <div className="min-h-dvh morphy-app-bg p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold">Agent Kai</h1>
          <p className="text-muted-foreground">Fundamental Analysis Agent</p>
        </div>

        {/* Locked Vault Warning */}
        {!isVaultUnlocked && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-center gap-3">
            <Lock className="h-5 w-5 text-red-400" />
            <p className="text-red-200">
              Vault is locked. Unlock to encrypt your data.
            </p>
          </div>
        )}

        {/* Consent Warning */}
        {!hasConsent && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-small text-yellow-200 font-medium">
                Consent Required
              </p>
              <Button
                variant="none"
                size="sm"
                className="mt-2 text-yellow-400 hover:text-yellow-300"
                onClick={() => router.push("/dashboard/kai")}
              >
                Complete Onboarding →
              </Button>
            </div>
          </div>
        )}

        {/* Search Form */}
        <form onSubmit={handleSubmit} className="relative">
          <div className="relative bg-white/5 border border-white/10 rounded-2xl p-1.5 focus-within:bg-white/10 transition-colors">
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2">
              <div className="flex items-center gap-3 flex-1 px-3 py-2">
                <Search className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Ask Kai about any stock... (e.g., AAPL)"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value)}
                  className="flex-1 bg-transparent border-0 outline-none text-white placeholder:text-white/40 text-lg min-w-0"
                  disabled={isAnalyzing || !hasConsent || !isVaultUnlocked}
                />
              </div>
              <Button
                variant="gradient"
                size="lg"
                type="submit"
                className="w-full md:w-auto rounded-xl shadow-lg"
                disabled={
                  !ticker.trim() ||
                  isAnalyzing ||
                  !hasConsent ||
                  !isVaultUnlocked
                }
                showRipple
              >
                {isAnalyzing ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    Analyzing...
                  </span>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5 mr-2" />
                    Analyze
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>

        {/* Results Area */}
        {result && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-lg">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-3xl font-bold mb-1">{result.ticker}</h2>
                  <p className="text-muted-foreground">{result.headline}</p>
                </div>
                <div
                  className={`px-4 py-2 rounded-full border ${
                    result.decision === "buy"
                      ? "bg-green-500/20 border-green-500/50 text-green-400"
                      : result.decision === "reduce"
                      ? "bg-red-500/20 border-red-500/50 text-red-400"
                      : "bg-blue-500/20 border-blue-500/50 text-blue-400"
                  }`}
                >
                  <span className="font-bold uppercase tracking-wider">
                    {result.decision}
                  </span>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <p className="text-caption text-muted-foreground mb-1">
                    Confidence
                  </p>
                  <p className="text-xl font-mono font-bold">
                    {(result.confidence * 100).toFixed(0)}%
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <p className="text-caption text-muted-foreground mb-1">
                    Mode
                  </p>
                  <p className="text-xl capitalize">{result.processing_mode}</p>
                </div>
                {result.raw_card?.key_metrics?.revenue_billions && (
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <p className="text-caption text-muted-foreground mb-1">
                      Revenue
                    </p>
                    <p className="text-xl font-mono">
                      ${result.raw_card.key_metrics.revenue_billions.toFixed(1)}
                      B
                    </p>
                  </div>
                )}
                {result.raw_card?.key_metrics?.profit_margin && (
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <p className="text-caption text-muted-foreground mb-1">
                      Profit Margin
                    </p>
                    <p className="text-xl font-mono">
                      {(
                        result.raw_card.key_metrics.profit_margin * 100
                      ).toFixed(1)}
                      %
                    </p>
                  </div>
                )}
              </div>

              {/* Agent Insights */}
              {result.raw_card?.fundamental_insight && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                    Fundamental Analysis
                  </h3>
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                    {result.raw_card.fundamental_insight.summary && (
                      <p className="text-sm text-muted-foreground">
                        {result.raw_card.fundamental_insight.summary}
                      </p>
                    )}
                    {result.raw_card.fundamental_insight.strengths?.length >
                      0 && (
                      <div>
                        <p className="text-xs font-semibold text-green-400 mb-1">
                          Strengths:
                        </p>
                        <ul className="text-sm space-y-1">
                          {result.raw_card.fundamental_insight.strengths.map(
                            (s: string, i: number) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="text-green-400 mt-1">•</span>
                                <span>{s}</span>
                              </li>
                            )
                          )}
                        </ul>
                      </div>
                    )}
                    {result.raw_card.fundamental_insight.weaknesses?.length >
                      0 && (
                      <div>
                        <p className="text-xs font-semibold text-red-400 mb-1">
                          Weaknesses:
                        </p>
                        <ul className="text-sm space-y-1">
                          {result.raw_card.fundamental_insight.weaknesses.map(
                            (w: string, i: number) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="text-red-400 mt-1">•</span>
                                <span>{w}</span>
                              </li>
                            )
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Sentiment & Valuation */}
              <div className="grid md:grid-cols-2 gap-4 mb-6">
                {result.raw_card?.sentiment_insight && (
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                      Sentiment Analysis
                    </h4>
                    <p className="text-sm text-muted-foreground mb-2">
                      {result.raw_card.sentiment_insight.summary}
                    </p>
                    {result.raw_card.sentiment_insight.sentiment_score !==
                      undefined && (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-muted-foreground">
                          Score:
                        </span>
                        <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              result.raw_card.sentiment_insight
                                .sentiment_score > 0
                                ? "bg-green-400"
                                : "bg-red-400"
                            }`}
                            style={{
                              width: `${
                                Math.abs(
                                  result.raw_card.sentiment_insight
                                    .sentiment_score
                                ) * 100
                              }%`,
                            }}
                          ></div>
                        </div>
                        <span className="text-xs font-mono">
                          {result.raw_card.sentiment_insight.sentiment_score.toFixed(
                            2
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                )}
                {result.raw_card?.valuation_insight && (
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                      Valuation Analysis
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {result.raw_card.valuation_insight.summary}
                    </p>
                    {result.raw_card.valuation_insight.valuation_verdict && (
                      <p className="text-xs mt-2 font-semibold text-amber-400">
                        {result.raw_card.valuation_insight.valuation_verdict}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Debate Summary */}
              {result.raw_card?.debate_digest && (
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 mb-6">
                  <h4 className="text-sm font-semibold mb-2">
                    Investment Committee Debate
                  </h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">
                    {result.raw_card.debate_digest}
                  </p>
                </div>
              )}

              {/* Sources */}
              {result.raw_card?.all_sources &&
                result.raw_card.all_sources.length > 0 && (
                  <div className="pt-4 border-t border-white/10">
                    <p className="text-xs text-muted-foreground mb-2">
                      Data Sources:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {result.raw_card.all_sources.map(
                        (source: string, i: number) => (
                          <span
                            key={i}
                            className="px-2 py-1 rounded text-xs bg-white/5 border border-white/10"
                          >
                            {source}
                          </span>
                        )
                      )}
                    </div>
                  </div>
                )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
