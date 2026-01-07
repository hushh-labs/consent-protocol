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
  storeDecision,
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
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  // Check consent on mount
  useEffect(() => {
    if (!user) return;
    const hasTokens = hasValidConsent("agent.kai.analyze");
    setHasConsent(hasTokens);
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticker.trim() || !user?.uid) return;

    if (!isVaultUnlocked || !vaultKey) {
      toast.error("Please unlock your vault to perform analysis.");
      return;
    }

    const consentToken = getConsentToken("agent.kai.analyze");
    if (!consentToken) {
      toast.error("Missing consent. Please re-onboard.");
      router.push("/dashboard/kai");
      return;
    }

    setIsAnalyzing(true);
    setResult(null);
    setSaveStatus("idle");

    try {
      // 1. Get Preferences (Stateless Session OR Persistent DB)
      let riskProfile = sessionStorage.getItem("kai_risk_profile") as any;
      let processingMode = sessionStorage.getItem("kai_processing_mode") as any;

      // If missing from session (fresh load), fetch from DB and decrypt
      if (!riskProfile || !processingMode) {
        console.log(
          "[Kai] Preferences missing from session, fetching from DB..."
        );
        try {
          const { preferences } = await getPreferences(user.uid);

          for (const pref of preferences) {
            const decryptedRes = await HushhVault.decryptData({
              keyHex: vaultKey,
              payload: {
                ciphertext: pref.ciphertext,
                iv: pref.iv,
                tag: pref.tag,
                encoding: "base64", // Default from encryptData
                algorithm: "aes-256-gcm",
              },
            });

            const decrypted = decryptedRes.plaintext; // decryptData returns { plaintext }

            if (pref.field_name === "kai_risk_profile") riskProfile = decrypted;
            if (pref.field_name === "kai_processing_mode")
              processingMode = decrypted;
          }

          // Cache restored prefs
          if (riskProfile)
            sessionStorage.setItem("kai_risk_profile", riskProfile);
          if (processingMode)
            sessionStorage.setItem("kai_processing_mode", processingMode);
        } catch (prefError) {
          console.error("[Kai] Failed to restore preferences:", prefError);
        }
      }

      // Default to balanced/hybrid if still missing
      riskProfile = riskProfile || "balanced";
      processingMode = processingMode || "hybrid";

      console.log(
        `[Kai] Analyzing with Profile: ${riskProfile}, Mode: ${processingMode}`
      );

      // 2. Perform Analysis (Returns Plaintext)
      const analysisMs = Date.now();
      const analysis = await analyzeTicker({
        user_id: user.uid,
        ticker: ticker.toUpperCase(),
        consent_token: consentToken,
        risk_profile: riskProfile,
        processing_mode: processingMode,
      });

      console.log(`[Kai] Analysis received in ${Date.now() - analysisMs}ms`);
      setResult(analysis);

      // 3. Encrypt & Store (Auto-Save)
      setSaveStatus("saving");
      try {
        const encrypted = await HushhVault.encryptData({
          keyHex: vaultKey,
          plaintext: JSON.stringify(analysis.raw_card),
        });

        await storeDecision({
          user_id: user.uid,
          ticker: analysis.ticker,
          decision_type: analysis.decision,
          confidence_score: analysis.confidence,
          decision_ciphertext: encrypted.ciphertext,
          iv: encrypted.iv,
          tag: encrypted.tag,
        });

        console.log("[Kai] Decision encrypted and stored securely.");
        setSaveStatus("saved");
      } catch (saveError) {
        console.error("Failed to encrypt/save:", saveError);
        setSaveStatus("error");
      }
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
          <div className="relative bg-white/5 border border-white/10 rounded-2xl p-1">
            <div className="flex items-center gap-3 px-4 py-2">
              <Search className="h-5 w-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Ask Kai about any stock... (e.g., AAPL, TSLA)"
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
                className="flex-1 bg-transparent border-0 outline-none text-white placeholder:text-white/40 text-lg"
                disabled={isAnalyzing || !hasConsent || !isVaultUnlocked}
              />
              <Button
                variant="gradient"
                size="lg"
                type="submit"
                disabled={
                  !ticker.trim() ||
                  isAnalyzing ||
                  !hasConsent ||
                  !isVaultUnlocked
                }
                showRipple
              >
                {isAnalyzing ? (
                  <span className="flex items-center gap-2">
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

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="p-4 rounded-xl bg-white/5">
                  <p className="text-caption text-muted-foreground">
                    Confidence
                  </p>
                  <p className="text-xl font-mono">
                    {result.confidence.toFixed(2)}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/5">
                  <p className="text-caption text-muted-foreground">Mode</p>
                  <p className="text-xl capitalize">{result.processing_mode}</p>
                </div>
              </div>

              {/* Encryption Status */}
              <div className="flex items-center gap-2 text-small text-muted-foreground border-t border-white/10 pt-4">
                {saveStatus === "saving" && (
                  <>
                    <div className="w-3 h-3 border border-white/20 border-t-white rounded-full animate-spin" />
                    Encrypting & Saving to Vault...
                  </>
                )}
                {saveStatus === "saved" && (
                  <div className="flex items-center gap-2 text-green-400">
                    <Lock className="w-3 h-3" />
                    <span>Encrypted & Stored in Vault</span>
                  </div>
                )}
                {saveStatus === "error" && (
                  <div className="flex items-center gap-2 text-red-400">
                    <AlertCircle className="w-3 h-3" />
                    <span>Failed to Save</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
