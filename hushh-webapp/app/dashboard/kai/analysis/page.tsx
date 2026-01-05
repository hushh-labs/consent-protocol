"use client";

/**
 * Kai Analysis Dashboard — Post-Onboarding Experience
 *
 * This is what users see after completing onboarding.
 * Features:
 * - Stock analysis input
 * - Recent decisions
 * - Settings access
 * - Analysis status
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/lib/morphy-ux/morphy";
import {
  Search,
  Sparkles,
  History,
  Settings,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Shield,
  RefreshCw,
} from "lucide-react";
import { getUserKaiSession, type KaiSession } from "@/lib/services/kai-service";
import { useAuth } from "@/lib/firebase/auth-context";

// ============================================================================
// TYPES
// ============================================================================

interface AnalysisResult {
  ticker: string;
  decision: "buy" | "hold" | "reduce";
  confidence: number;
  summary: string;
  timestamp: string;
}

// Mock recent analyses (will be replaced with API)
const MOCK_RECENT: AnalysisResult[] = [
  {
    ticker: "AAPL",
    decision: "hold",
    confidence: 0.78,
    summary: "Strong fundamentals, but valuation stretched",
    timestamp: "2026-01-04T18:30:00Z",
  },
  {
    ticker: "NVDA",
    decision: "buy",
    confidence: 0.85,
    summary: "AI momentum continues, solid growth trajectory",
    timestamp: "2026-01-03T14:15:00Z",
  },
];

// ============================================================================
// COMPONENTS
// ============================================================================

function AnalysisInput({ onAnalyze }: { onAnalyze: (ticker: string) => void }) {
  const [ticker, setTicker] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticker.trim()) return;

    setIsAnalyzing(true);
    // Simulate analysis delay
    setTimeout(() => {
      onAnalyze(ticker.toUpperCase());
      setIsAnalyzing(false);
      setTicker("");
    }, 2000);
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={handleSubmit}
      className="relative"
    >
      <div className="relative bg-white/5 border border-white/10 rounded-2xl p-1">
        <div className="flex items-center gap-3 px-4 py-2">
          <Search className="h-5 w-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Ask Kai about any stock... (e.g., AAPL, TSLA, NVDA)"
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            className="flex-1 bg-transparent border-0 outline-none text-white placeholder:text-white/40 text-lg"
            disabled={isAnalyzing}
          />
          <Button
            type="submit"
            variant="gradient"
            size="lg"
            disabled={!ticker.trim() || isAnalyzing}
            className="px-6"
          >
            {isAnalyzing ? (
              <>
                <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                Analyze
                <Sparkles className="h-5 w-5 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>
    </motion.form>
  );
}

function DecisionBadge({ decision }: { decision: "buy" | "hold" | "reduce" }) {
  const config = {
    buy: {
      icon: TrendingUp,
      color: "text-emerald-400",
      bg: "bg-emerald-500/20",
    },
    hold: { icon: Minus, color: "text-amber-400", bg: "bg-amber-500/20" },
    reduce: { icon: TrendingDown, color: "text-red-400", bg: "bg-red-500/20" },
  };

  const { icon: Icon, color, bg } = config[decision];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${bg} ${color} text-sm font-medium capitalize`}
    >
      <Icon className="h-4 w-4" />
      {decision}
    </span>
  );
}

function RecentAnalyses({ analyses }: { analyses: AnalysisResult[] }) {
  if (analyses.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center py-12 text-muted-foreground"
      >
        <History className="h-12 w-12 mx-auto mb-4 opacity-30" />
        <p>No recent analyses yet.</p>
        <p className="text-sm mt-1">Ask Kai about a stock to get started!</p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-3">
      {analyses.map((analysis, idx) => (
        <motion.div
          key={`${analysis.ticker}-${analysis.timestamp}`}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: idx * 0.1 }}
          className="flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
        >
          <div className="h-12 w-12 rounded-lg bg-linear-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center font-bold text-lg">
            {analysis.ticker.slice(0, 2)}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <span className="font-semibold">{analysis.ticker}</span>
              <DecisionBadge decision={analysis.decision} />
              <span className="text-xs text-muted-foreground">
                {Math.round(analysis.confidence * 100)}% confident
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {analysis.summary}
            </p>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground" />
        </motion.div>
      ))}
    </div>
  );
}

function SessionStatus({ session }: { session: KaiSession }) {
  return (
    <div className="flex items-center gap-4 text-sm text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <div className="h-2 w-2 rounded-full bg-emerald-500" />
        {session.processing_mode === "on_device" ? "On-Device" : "Hybrid"} Mode
      </span>
      <span className="capitalize">{session.risk_profile} Profile</span>
      <span className="flex items-center gap-1">
        <Shield className="h-3.5 w-3.5" />
        MCP Protected
      </span>
    </div>
  );
}

// ============================================================================
// MAIN DASHBOARD
// ============================================================================

export default function KaiDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [session, setSession] = useState<KaiSession | null>(null);
  const [recentAnalyses, setRecentAnalyses] =
    useState<AnalysisResult[]>(MOCK_RECENT);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSession() {
      if (!user?.uid) {
        router.push("/dashboard/kai");
        return;
      }

      try {
        const existingSession = await getUserKaiSession(user.uid);

        if (!existingSession || !existingSession.onboarding_complete) {
          // Redirect to onboarding
          router.push("/dashboard/kai");
          return;
        }

        setSession(existingSession);
      } catch (error) {
        console.error("Failed to load session:", error);
        // For now, use mock to show UI
        setSession({
          session_id: "mock",
          user_id: user.uid,
          processing_mode: "hybrid",
          risk_profile: "balanced",
          legal_acknowledged: true,
          onboarding_complete: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      } finally {
        setLoading(false);
      }
    }

    loadSession();
  }, [user, router]);

  const handleAnalyze = (ticker: string) => {
    // Add mock result
    const newResult: AnalysisResult = {
      ticker,
      decision: ["buy", "hold", "reduce"][Math.floor(Math.random() * 3)] as
        | "buy"
        | "hold"
        | "reduce",
      confidence: 0.7 + Math.random() * 0.25,
      summary: `Kai's three specialist agents have analyzed ${ticker}.`,
      timestamp: new Date().toISOString(),
    };
    setRecentAnalyses([newResult, ...recentAnalyses.slice(0, 4)]);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <span className="text-3xl">🤫</span>
              <span className="bg-linear-to-r from-white to-white/80 bg-clip-text">
                Kai
              </span>
            </h1>
            {session && <SessionStatus session={session} />}
          </div>
          <Button
            variant="none"
            size="sm"
            className="border border-white/20 hover:bg-white/5"
            onClick={() => router.push("/dashboard/kai/settings")}
          >
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </motion.div>

        {/* Analysis Input */}
        <AnalysisInput onAnalyze={handleAnalyze} />

        {/* Recent Analyses */}
        <Card className="bg-transparent border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Recent Analyses
            </CardTitle>
            <CardDescription>
              Your investment committee's latest decisions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RecentAnalyses analyses={recentAnalyses} />
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-3 gap-4"
        >
          {[
            { label: "Portfolio Review", icon: TrendingUp, href: "#" },
            { label: "Risk Assessment", icon: Shield, href: "#" },
            { label: "Export Decisions", icon: History, href: "#" },
          ].map((action) => (
            <button
              key={action.label}
              className="p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors text-center"
            >
              <action.icon className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
              <span className="text-sm">{action.label}</span>
            </button>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
