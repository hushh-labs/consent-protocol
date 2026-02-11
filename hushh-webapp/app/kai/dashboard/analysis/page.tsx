// app/kai/dashboard/analysis/page.tsx

/**
 * Kai Analysis Page - Real-time stock analysis with streaming debate view
 *
 * Reads sessionStorage for analysis params and displays DebateStreamView.
 * Uses VaultOwner token from useVault() hook for authentication.
 */

"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useVault } from "@/lib/vault/vault-context";
import { HushhLoader } from "@/components/ui/hushh-loader";
import { DebateStreamView } from "@/components/kai/debate-stream-view";

interface AnalysisParams {
  ticker: string;
  userId: string;
  riskProfile?: string;
  userContext?: any;
  vaultOwnerToken?: string;
}

export default function KaiAnalysisPage() {
  const router = useRouter();
  const { vaultOwnerToken } = useVault();
  const [params, setParams] = useState<AnalysisParams | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    
    // Get params from sessionStorage
    const stored = sessionStorage.getItem("kai_analysis_params");
    
    if (stored) {
      try {
        const parsed: AnalysisParams = JSON.parse(stored);
        
        // Validate required fields
        if (!parsed.ticker || !parsed.userId) {
          throw new Error("Invalid analysis parameters");
        }
        
        if (mountedRef.current) {
          setParams(parsed);
        }
      } catch (err) {
        console.error("[KaiAnalysisPage] Failed to parse sessionStorage:", err);
        setError("Failed to load analysis parameters");
      }
    } else if (!params && !error) {
      // No params found - show loader but don't redirect immediately
      // User will be redirected when they click back or timeout
      console.log("[KaiAnalysisPage] Waiting for params from sessionStorage...");
    }

    return () => {
      mountedRef.current = false;
    };
  }, [router]);

  // Handle closing analysis (back to dashboard)
  const handleClose = () => {
    sessionStorage.removeItem("kai_analysis_params");
    router.push("/kai/dashboard");
  };

  if (!params) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        {error ? (
          <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-lg text-red-600 dark:text-red-400 max-w-md mx-auto">
            <div className="flex items-center gap-3 mb-2">
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>{error}</span>
            </div>
            <button
              onClick={() => {
                sessionStorage.removeItem("kai_analysis_params");
                router.push("/kai/dashboard");
              }}
              className="text-sm underline hover:no-underline mt-2"
            >
              Return to Dashboard
            </button>
          </div>
        ) : (
          <HushhLoader variant="inline" label="Loading analysis..." />
        )}
      </div>
    );
  }

  // Get vaultOwnerToken from params or use hook (prefer params if provided)
  const tokenToUse = params.vaultOwnerToken || vaultOwnerToken || "";

  return (
    <DebateStreamView
      ticker={params.ticker}
      userId={params.userId}
      riskProfile={params.riskProfile}
      vaultOwnerToken={tokenToUse}
      onClose={handleClose}
    />
  );
}
