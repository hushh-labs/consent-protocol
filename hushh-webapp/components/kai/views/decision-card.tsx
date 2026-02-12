"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/lib/morphy-ux/card";
import {
  Zap,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Shield,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Scale,
  FileText,
  Link2,
} from "lucide-react";
import { cn } from "@/lib/morphy-ux";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

// ============================================================================
// Types
// ============================================================================

export interface DecisionResult {
  ticker: string;
  decision: "buy" | "hold" | "reduce" | string;
  confidence: number;
  consensus_reached: boolean;
  final_statement: string;
  agent_votes?: Record<string, string>;
  dissenting_opinions?: string[];
  // Enriched data
  fundamental_summary?: string;
  sentiment_summary?: string;
  valuation_summary?: string;
  raw_card?: {
    fundamental_insight?: {
      summary?: string;
      business_moat?: string;
      financial_resilience?: string;
      growth_efficiency?: string;
      bull_case?: string;
      bear_case?: string;
    };
    quant_metrics?: Record<string, any>;
    key_metrics?: {
      fundamental?: Record<string, any>;
      sentiment?: {
        sentiment_score?: number;
        catalyst_count?: number;
      };
      valuation?: Record<string, any>;
    };
    all_sources?: string[];
    risk_persona_alignment?: string;
    debate_digest?: string;
    consensus_reached?: boolean;
    dissenting_opinions?: string[];
  };
}

// ============================================================================
// Source URL Helpers
// ============================================================================

const KNOWN_SOURCE_URLS: Record<string, string> = {
  "yahoo finance": "https://finance.yahoo.com",
  "sec edgar": "https://www.sec.gov/cgi-bin/browse-edgar",
  "google finance": "https://www.google.com/finance",
  "bloomberg": "https://www.bloomberg.com",
  "reuters": "https://www.reuters.com",
  "finnhub": "https://finnhub.io",
  "marketwatch": "https://www.marketwatch.com",
  "seeking alpha": "https://seekingalpha.com",
};

function parseSourceUrl(source: string): { text: string; url: string | null } {
  // Try to extract URL from source string
  const urlMatch = source.match(/https?:\/\/[^\s)]+/);
  if (urlMatch) {
    return { text: source.replace(urlMatch[0], "").trim() || urlMatch[0], url: urlMatch[0] };
  }
  // Check known sources
  const lower = source.toLowerCase();
  for (const [key, url] of Object.entries(KNOWN_SOURCE_URLS)) {
    if (lower.includes(key)) {
      return { text: source, url };
    }
  }
  return { text: source, url: null };
}

function SourceLink({ source }: { source: string }) {
  const { text, url } = parseSourceUrl(source);
  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[10px] text-primary/80 hover:text-primary truncate pl-2 border-l-2 border-primary/20 flex items-center gap-1 transition-colors"
      >
        <Link2 className="w-2.5 h-2.5 shrink-0" />
        <span className="truncate">{text || url}</span>
      </a>
    );
  }
  return (
    <p className="text-[10px] text-muted-foreground truncate pl-2 border-l-2 border-primary/20">
      {text}
    </p>
  );
}

// ============================================================================
// Chart Sub-Components
// ============================================================================

const radarChartConfig = {
  value: {
    label: "Confidence",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

function AgentConfidenceRadar({ result }: { result: DecisionResult }) {
  const keyMetrics = result.raw_card?.key_metrics;
  if (!keyMetrics) return null;

  const data = [
    {
      agent: "Fundamental",
      value: (keyMetrics.fundamental?.confidence as number) || result.confidence || 0,
    },
    {
      agent: "Sentiment",
      value: keyMetrics.sentiment?.sentiment_score !== undefined
        ? ((keyMetrics.sentiment.sentiment_score + 1) / 2)
        : result.confidence || 0,
    },
    {
      agent: "Valuation",
      value: (keyMetrics.valuation?.confidence as number) || result.confidence || 0,
    },
  ].map((d) => ({ ...d, value: Math.round(d.value * 100) }));

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">
        Agent Confidence
      </p>
      <ChartContainer config={radarChartConfig} className="h-[180px] w-full">
        <RadarChart accessibilityLayer data={data} cx="50%" cy="50%" outerRadius="70%">
          <PolarGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <PolarAngleAxis dataKey="agent" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
          <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
          <ChartTooltip content={<ChartTooltipContent hideLabel />} />
          <Radar
            dataKey="value"
            stroke="var(--color-value)"
            fill="var(--color-value)"
            fillOpacity={0.2}
            strokeWidth={2}
          />
        </RadarChart>
      </ChartContainer>
    </div>
  );
}

const consensusChartConfig = {
  agree: {
    label: "Agree",
    color: "hsl(152, 69%, 45%)",
  },
  dissent: {
    label: "Dissent",
    color: "hsl(45, 93%, 47%)",
  },
} satisfies ChartConfig;

function ConsensusDonut({ result }: { result: DecisionResult }) {
  const votes = result.agent_votes ? Object.values(result.agent_votes) : [];
  if (votes.length === 0) return null;

  const majority = result.decision.toLowerCase();
  const agreeCount = votes.filter((v) => String(v).toLowerCase() === majority).length;
  const dissentCount = votes.length - agreeCount;

  const data = [
    { name: "Agree", value: agreeCount, fill: "var(--color-agree)" },
    { name: "Dissent", value: dissentCount, fill: "var(--color-dissent)" },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">
        Consensus
      </p>
      <ChartContainer config={consensusChartConfig} className="h-[120px] w-full">
        <PieChart accessibilityLayer>
          <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
          <Pie data={data} cx="50%" cy="50%" innerRadius={30} outerRadius={48} dataKey="value" strokeWidth={0}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.fill} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <div className="flex justify-center gap-3">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: d.name === "Agree" ? consensusChartConfig.agree.color : consensusChartConfig.dissent.color }}
            />
            {d.name} ({d.value})
          </div>
        ))}
      </div>
    </div>
  );
}

const barChartConfig = {
  value: {
    label: "Value",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

function QuantMetricsBarChart({ metrics }: { metrics: Record<string, any> }) {
  const data = useMemo(() => {
    return Object.entries(metrics)
      .filter(([, v]) => typeof v === "number" && v !== 0 && !Number.isNaN(v))
      .slice(0, 6)
      .map(([key, value]) => ({
        name: key.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase()),
        value: Math.abs(value as number) >= 1e9
          ? (value as number) / 1e9
          : Math.abs(value as number) >= 1e6
          ? (value as number) / 1e6
          : (value as number),
        isNegative: (value as number) < 0,
      }));
  }, [metrics]);

  if (data.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
        <BarChart3 className="w-3.5 h-3.5" />
        Key Metrics
      </p>
      <ChartContainer config={barChartConfig} className="w-full" style={{ height: `${Math.max(data.length * 32, 100)}px` }}>
        <BarChart accessibilityLayer data={data} layout="vertical" margin={{ left: 0, right: 10, top: 0, bottom: 0 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
          <ChartTooltip content={<ChartTooltipContent hideLabel />} />
          <Bar dataKey="value" fill="var(--color-value)" radius={[0, 4, 4, 0]} barSize={16} />
        </BarChart>
      </ChartContainer>
    </div>
  );
}

// ============================================================================
// Sub-Components
// ============================================================================

function AgentSummarySection({
  title,
  summary,
  icon,
  color,
}: {
  title: string;
  summary: string;
  icon: React.ReactNode;
  color: string;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!summary) return null;

  return (
    <div className="border border-border/50 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/30 transition-colors duration-200"
      >
        <div className="flex items-center gap-2">
          <span className={cn("shrink-0", color)}>{icon}</span>
          <span className="text-xs font-semibold">{title}</span>
        </div>
        {expanded ? (
          <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        )}
      </button>
      {expanded && (
        <div className="px-3 pb-3 pt-0">
          <p className="text-xs text-muted-foreground leading-relaxed">{summary}</p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function DecisionCard({ result }: { result: DecisionResult }) {
  const [showSources, setShowSources] = useState(false);
  const isBuy = result.decision.toLowerCase() === "buy";
  const isReduce = result.decision.toLowerCase() === "reduce" || result.decision.toLowerCase() === "sell";

  const rawCard = result.raw_card;
  const sources = rawCard?.all_sources || [];
  const hasAgentSummaries = result.fundamental_summary || result.sentiment_summary || result.valuation_summary;
  const hasQuantMetrics = rawCard?.quant_metrics && Object.keys(rawCard.quant_metrics).filter(
    (k) => rawCard.quant_metrics![k] !== null && rawCard.quant_metrics![k] !== undefined && typeof rawCard.quant_metrics![k] !== "object"
  ).length > 0;

  return (
    <Card
      variant="none"
      effect="glass"
      showRipple={false}
      className="border-primary/20 bg-primary/5 animate-in fade-in zoom-in duration-500"
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            <CardTitle className="text-sm font-black uppercase tracking-widest">Final Recommendation</CardTitle>
          </div>
          <Badge
            variant="outline"
            className="text-xs font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
          >
            COMPLETE
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Decision Badge */}
        <div className="flex items-center justify-center">
          <div
            className={cn(
              "px-8 py-4 rounded-2xl border text-3xl font-black uppercase tracking-tighter shadow-xl backdrop-blur-md",
              isBuy
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                : isReduce
                ? "bg-red-500/10 border-red-500/20 text-red-500"
                : "bg-blue-500/10 border-blue-500/20 text-blue-500"
            )}
          >
            {result.decision}
          </div>
        </div>

        {/* Confidence Bar */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Confidence:</span>
            <span className="text-lg font-bold">{Math.round(result.confidence * 100)}%</span>
          </div>
          <Progress value={result.confidence * 100} className="w-48 h-2" />
        </div>

        {/* Charts Row: Radar + Donut */}
        <div className="grid grid-cols-2 gap-3">
          <AgentConfidenceRadar result={result} />
          <ConsensusDonut result={result} />
        </div>

        {/* Risk Persona Alignment */}
        {rawCard?.risk_persona_alignment && (
          <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold text-primary">Risk Profile Alignment</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{rawCard.risk_persona_alignment}</p>
          </div>
        )}

        {/* Final Statement / Debate Digest */}
        <div className="p-4 bg-card/50 rounded-xl border border-border/50">
          <p className="text-sm font-medium leading-relaxed">{rawCard?.debate_digest || result.final_statement}</p>
        </div>

        {/* Agent Votes */}
        {result.agent_votes && (
          <div className="grid grid-cols-3 gap-3">
            {Object.entries(result.agent_votes).map(([agent, vote]) => {
              const voteStr = String(vote).toLowerCase();
              return (
                <div key={agent} className="text-center py-3 bg-card/50 rounded-lg border border-border/50">
                  <p className="text-xs text-muted-foreground capitalize">{agent}</p>
                  <p
                    className={cn(
                      "font-bold uppercase text-sm",
                      voteStr === "buy"
                        ? "text-emerald-500"
                        : voteStr === "reduce" || voteStr === "sell"
                        ? "text-red-500"
                        : "text-blue-500"
                    )}
                  >
                    {vote}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* Dissenting Opinions */}
        {result.dissenting_opinions && result.dissenting_opinions.length > 0 && (
          <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5" />
              Dissenting Opinions
            </p>
            <ul className="space-y-1.5">
              {result.dissenting_opinions.map((opinion, idx) => (
                <li key={idx} className="text-xs text-muted-foreground pl-3 border-l-2 border-amber-500/30">
                  {opinion}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Consensus Status */}
        <div className="flex items-center justify-center gap-2">
          {result.consensus_reached ? (
            <>
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <span className="text-sm font-medium text-emerald-500">Consensus Reached</span>
            </>
          ) : (
            <>
              <AlertCircle className="w-5 h-5 text-amber-500" />
              <span className="text-sm font-medium text-amber-500">Majority Decision (with dissent)</span>
            </>
          )}
        </div>

        {/* Quant Metrics Bar Chart */}
        {hasQuantMetrics && rawCard?.quant_metrics && (
          <>
            <Separator className="opacity-50" />
            <QuantMetricsBarChart metrics={rawCard.quant_metrics} />
          </>
        )}

        {/* Agent Summaries */}
        {hasAgentSummaries && (
          <>
            <Separator className="opacity-50" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              Agent Analysis Summaries
            </p>
            <div className="space-y-2">
              {result.fundamental_summary && (
                <AgentSummarySection
                  title="Fundamental Analysis"
                  summary={result.fundamental_summary}
                  icon={<TrendingUp className="w-3.5 h-3.5" />}
                  color="text-blue-500"
                />
              )}
              {result.sentiment_summary && (
                <AgentSummarySection
                  title="Sentiment Analysis"
                  summary={result.sentiment_summary}
                  icon={<BarChart3 className="w-3.5 h-3.5" />}
                  color="text-purple-500"
                />
              )}
              {result.valuation_summary && (
                <AgentSummarySection
                  title="Valuation Analysis"
                  summary={result.valuation_summary}
                  icon={<TrendingDown className="w-3.5 h-3.5" />}
                  color="text-emerald-500"
                />
              )}
            </div>
          </>
        )}

        {/* Sources - Hyperlinked */}
        {sources.length > 0 && (
          <>
            <Separator className="opacity-50" />
            <div>
              <button
                onClick={() => setShowSources(!showSources)}
                className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors duration-200"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Sources ({sources.length})
                {showSources ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              {showSources && (
                <div className="mt-2 space-y-1.5">
                  {sources.map((src, i) => (
                    <SourceLink key={i} source={src} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Disclaimer */}
        <div className="pt-2">
          <p className="text-[10px] text-muted-foreground/60 text-center leading-relaxed">
            Agent Kai is an educational tool and does not constitute investment advice. Always consult a qualified
            financial advisor before making investment decisions.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
