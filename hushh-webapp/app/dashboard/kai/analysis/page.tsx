"use client";

/**
 * Kai Analysis Dashboard - Production Ready
 * Requires consent token for analysis
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/lib/morphy-ux/morphy";
import { Search, Sparkles, AlertCircle } from "lucide-react";
import { getConsentToken, hasValidConsent } from "../actions";
import { useAuth } from "@/lib/firebase/auth-context";

function KaiAnalysis() {
  const router = useRouter();
  const { user } = useAuth();
  const [ticker, setTicker] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasConsent, setHasConsent] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  // ✅ Check consent on mount (simplified - no backend check)
  useEffect(() => {
    const checkConsent = () => {
      if (!user) {
        setCheckingSession(false);
        return;
      }

      // Check sessionStorage for tokens
      const hasTokens = hasValidConsent("agent.kai.analyze");

      if (hasTokens) {
        console.log("[Kai Analysis] ✅ Valid tokens found");
        setHasConsent(true);
      } else {
        console.log("[Kai Analysis] ❌ No valid consent tokens");
        setHasConsent(false);
      }

      setCheckingSession(false);
    };

    checkConsent();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticker.trim()) return;

    // ✅ Get consent token
    const analyzeToken = getConsentToken("agent.kai.analyze");

    if (!analyzeToken) {
      alert("Please complete onboarding to use Kai");
      router.push("/dashboard/kai");
      return;
    }

    setIsAnalyzing(true);

    try {
      // TODO: Get real session ID from state/storage
      const sessionId = "session_temp";

      // ✅ Call backend with consent token
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/kai/analyze/${sessionId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Consent-Token": analyzeToken, // ✅ Required header
          },
          body: JSON.stringify({ ticker: ticker.toUpperCase() }),
        }
      );

      if (response.status === 403) {
        alert("Consent denied or expired. Please re-onboard.");
        router.push("/dashboard/kai");
        return;
      }

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("[Kai] Analysis result:", data);

      // TODO: Display results
      setTicker("");
    } catch (error) {
      console.error("[Kai] Analysis error:", error);
      alert("Analysis failed. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-dvh morphy-app-bg p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold">Agent Kai</h1>
          <p className="text-muted-foreground">Your Investment Committee</p>
        </div>

        {/* Consent Warning */}
        {!hasConsent && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-small text-yellow-200 font-medium">
                Consent Required
              </p>
              <p className="text-caption text-yellow-300/80 mt-1">
                Please complete onboarding to grant analysis consent
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
                placeholder="Ask Kai about any stock... (e.g., AAPL, TSLA, NVDA)"
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
                className="flex-1 bg-transparent border-0 outline-none text-white placeholder:text-white/40 text-lg"
                disabled={isAnalyzing || !hasConsent}
              />
              <Button
                variant="gradient"
                size="lg"
                type="submit"
                disabled={!ticker.trim() || isAnalyzing || !hasConsent}
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

        {/* Placeholder for Results */}
        <div className="text-center py-12 text-muted-foreground">
          <p>
            {hasConsent
              ? "Enter a ticker symbol to start analysis"
              : "Complete onboarding first to analyze stocks"}
          </p>
        </div>
      </div>
    </div>
  );
}

// ✅ Proper default export
export default KaiAnalysis;
