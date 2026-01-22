"use client";

/**
 * DebateStreamView - Real-time Kai Multi-Agent Debate Visualization
 *
 * Consumes SSE endpoint to display streaming agent analysis and debate rounds.
 * Mobile-first design with animated agent cards and typing indicators.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useVault } from "@/lib/vault/vault-context";

// Agent configuration
const AGENTS = {
  fundamental: {
    name: "Fundamental Agent",
    icon: "🔍",
    color: "#3b82f6",
    bgColor: "rgba(59, 130, 246, 0.1)",
  },
  sentiment: {
    name: "Sentiment Agent",
    icon: "📰",
    color: "#8b5cf6",
    bgColor: "rgba(139, 92, 246, 0.1)",
  },
  valuation: {
    name: "Valuation Agent",
    icon: "🧮",
    color: "#10b981",
    bgColor: "rgba(16, 185, 129, 0.1)",
  },
};

type AgentId = keyof typeof AGENTS;
type AgentStatus = "waiting" | "analyzing" | "complete" | "error";

interface AgentState {
  status: AgentStatus;
  summary?: string;
  recommendation?: string;
  confidence?: number;
  error?: string;
}

interface DebateRound {
  round: number;
  statements: Record<string, string>;
}

interface DecisionResult {
  ticker: string;
  decision: string;
  confidence: number;
  consensus_reached: boolean;
  final_statement: string;
  raw_card?: any; // Full KPI data from backend
}

interface DebateStreamViewProps {
  ticker: string;
  userId: string;
  riskProfile?: string;
  vaultOwnerToken: string;  // Required - passed from parent for reliable auth
  onDecision?: (decision: DecisionResult) => void;
  onClose?: () => void;
}

export function DebateStreamView({
  ticker,
  userId,
  riskProfile = "balanced",
  vaultOwnerToken,
  onDecision,
  onClose,
}: DebateStreamViewProps) {
  const { isVaultUnlocked } = useVault();
  const [agents, setAgents] = useState<Record<AgentId, AgentState>>({
    fundamental: { status: "waiting" },
    sentiment: { status: "waiting" },
    valuation: { status: "waiting" },
  });
  const [debateRounds, setDebateRounds] = useState<DebateRound[]>([]);
  const [decision, setDecision] = useState<DecisionResult | null>(null);
  const [isDebating, setIsDebating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [agents, debateRounds, decision]);

  // Start SSE connection
  const startAnalysis = useCallback(async () => {
    if (!vaultOwnerToken) {
      setError("Please unlock your vault first");
      return;
    }

    // Reset state
    setAgents({
      fundamental: { status: "waiting" },
      sentiment: { status: "waiting" },
      valuation: { status: "waiting" },
    });
    setDebateRounds([]);
    setDecision(null);
    setError(null);
    setIsComplete(false);

    // Build SSE URL - use Next.js proxy to forward auth headers
    const url = `/api/kai/analyze/stream?ticker=${ticker}&user_id=${userId}&risk_profile=${riskProfile}`;

    // Note: EventSource doesn't support custom headers natively
    // For auth, we need to use a polyfill or pass token via query param
    // For now, we'll use fetch with ReadableStream fallback
    
    try {
      const response = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${vaultOwnerToken}`,
          "Accept": "text/event-stream",
        },
      });

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("event:")) {
            const eventType = line.slice(6).trim();
            continue;
          }
          if (line.startsWith("data:")) {
            const data = JSON.parse(line.slice(5).trim());
            handleEvent(data);
          }
        }
      }

      setIsComplete(true);
    } catch (err) {
      console.error("SSE Error:", err);
      setError(err instanceof Error ? err.message : "Analysis failed");
    }
  }, [ticker, userId, riskProfile, vaultOwnerToken]);

  // Handle SSE events
  const handleEvent = (data: any) => {
    // Determine event type from data structure
    if (data.agent && data.message) {
      // agent_start
      setAgents((prev) => ({
        ...prev,
        [data.agent as AgentId]: { status: "analyzing" },
      }));
    } else if (data.agent && data.summary) {
      // agent_complete
      setAgents((prev) => ({
        ...prev,
        [data.agent as AgentId]: {
          status: "complete",
          summary: data.summary,
          recommendation: data.recommendation,
          confidence: data.confidence,
        },
      }));
    } else if (data.agent && data.error) {
      // agent_error
      setAgents((prev) => ({
        ...prev,
        [data.agent as AgentId]: {
          status: "error",
          error: data.error,
        },
      }));
    } else if (data.agents && Array.isArray(data.agents)) {
      // debate_start
      setIsDebating(true);
    } else if (data.round !== undefined && data.statements) {
      // debate_round
      setDebateRounds((prev) => [...prev, data]);
    } else if (data.decision && data.final_statement) {
      // decision
      setDecision(data);
      setIsDebating(false);
      onDecision?.(data);
    } else if (data.message && !data.agent) {
      // error
      setError(data.message);
    }
  };

  // Start analysis on mount
  useEffect(() => {
    startAnalysis();
    return () => {
      eventSourceRef.current?.close();
    };
  }, [startAnalysis]);

  return (
    <div className="debate-stream-view">
      {/* Header */}
      <div className="debate-header">
        <h2>🎯 {ticker} Analysis</h2>
        {onClose && (
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        )}
      </div>

      {/* Scrollable Content */}
      <div className="debate-content" ref={scrollRef}>
        {/* Agent Cards */}
        <div className="agent-cards">
          {(Object.keys(AGENTS) as AgentId[]).map((agentId) => (
            <AgentCard
              key={agentId}
              agentId={agentId}
              state={agents[agentId]}
            />
          ))}
        </div>

        {/* Debate Section */}
        {isDebating && (
          <div className="debate-section">
            <div className="debate-header-small">
              <span className="debate-icon">⚡</span>
              Multi-Agent Debate
            </div>
          </div>
        )}

        {/* Debate Rounds */}
        {debateRounds.map((round) => (
          <DebateRoundCard key={round.round} round={round} />
        ))}

        {/* Final Decision */}
        {decision && <DecisionCard decision={decision} />}

        {/* Error */}
        {error && (
          <div className="error-card">
            <span className="error-icon">⚠️</span>
            {error}
          </div>
        )}
      </div>

      <style jsx>{`
        .debate-stream-view {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: var(--background);
          border-radius: 16px;
          overflow: hidden;
        }

        .debate-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid var(--border);
          background: var(--card);
        }

        .debate-header h2 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
        }

        .close-btn {
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
          opacity: 0.6;
        }

        .close-btn:hover {
          opacity: 1;
        }

        .debate-content {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .agent-cards {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .debate-section {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid var(--border);
        }

        .debate-header-small {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .debate-icon {
          font-size: 16px;
        }

        .error-card {
          padding: 16px;
          background: rgba(239, 68, 68, 0.1);
          border-radius: 12px;
          color: #ef4444;
          display: flex;
          align-items: center;
          gap: 8px;
        }
      `}</style>
    </div>
  );
}

// Agent Card Component
function AgentCard({
  agentId,
  state,
}: {
  agentId: AgentId;
  state: AgentState;
}) {
  const agent = AGENTS[agentId];

  return (
    <div
      className="agent-card"
      style={{
        borderColor: state.status === "complete" ? agent.color : "var(--border)",
        background: state.status === "complete" ? agent.bgColor : "var(--card)",
      }}
    >
      <div className="agent-header">
        <span className="agent-icon">{agent.icon}</span>
        <span className="agent-name">{agent.name}</span>
        <StatusBadge status={state.status} />
      </div>

      {state.status === "analyzing" && (
        <div className="analyzing-indicator">
          <div className="typing-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <span className="analyzing-text">Analyzing...</span>
        </div>
      )}

      {state.status === "complete" && state.summary && (
        <div className="agent-result">
          <p className="summary">{state.summary}</p>
          <div className="meta">
            <span
              className="recommendation"
              style={{ color: agent.color }}
            >
              {state.recommendation}
            </span>
            <span className="confidence">
              {((state.confidence || 0) * 100).toFixed(0)}% confidence
            </span>
          </div>
        </div>
      )}

      {state.status === "error" && (
        <div className="agent-error">{state.error}</div>
      )}

      <style jsx>{`
        .agent-card {
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 16px;
          transition: all 0.3s ease;
        }

        .agent-header {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .agent-icon {
          font-size: 20px;
        }

        .agent-name {
          flex: 1;
          font-weight: 600;
          font-size: 14px;
        }

        .analyzing-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 12px;
          color: var(--text-secondary);
        }

        .typing-dots {
          display: flex;
          gap: 4px;
        }

        .typing-dots span {
          width: 6px;
          height: 6px;
          background: ${agent.color};
          border-radius: 50%;
          animation: bounce 1.4s infinite ease-in-out both;
        }

        .typing-dots span:nth-child(1) {
          animation-delay: -0.32s;
        }

        .typing-dots span:nth-child(2) {
          animation-delay: -0.16s;
        }

        @keyframes bounce {
          0%,
          80%,
          100% {
            transform: scale(0);
          }
          40% {
            transform: scale(1);
          }
        }

        .analyzing-text {
          font-size: 13px;
        }

        .agent-result {
          margin-top: 12px;
        }

        .summary {
          font-size: 14px;
          line-height: 1.5;
          margin: 0;
        }

        .meta {
          display: flex;
          justify-content: space-between;
          margin-top: 8px;
          font-size: 12px;
        }

        .recommendation {
          font-weight: 600;
          text-transform: uppercase;
        }

        .confidence {
          color: var(--text-secondary);
        }

        .agent-error {
          margin-top: 12px;
          color: #ef4444;
          font-size: 13px;
        }
      `}</style>
    </div>
  );
}

// Status Badge Component
function StatusBadge({ status }: { status: AgentStatus }) {
  const config = {
    waiting: { label: "⏳", color: "var(--text-secondary)" },
    analyzing: { label: "⏳", color: "#f59e0b" },
    complete: { label: "✓", color: "#10b981" },
    error: { label: "✕", color: "#ef4444" },
  };

  const { label, color } = config[status];

  return (
    <span className="status-badge" style={{ color }}>
      {label}
      <style jsx>{`
        .status-badge {
          font-size: 14px;
        }
      `}</style>
    </span>
  );
}

// Debate Round Card
function DebateRoundCard({ round }: { round: DebateRound }) {
  return (
    <div className="debate-round">
      <div className="round-header">Round {round.round}</div>
      {Object.entries(round.statements).map(([agentId, statement]) => (
        <div key={agentId} className="statement">
          <span className="agent">{AGENTS[agentId as AgentId]?.icon}</span>
          <p>{statement}</p>
        </div>
      ))}
      <style jsx>{`
        .debate-round {
          padding: 12px;
          background: var(--card);
          border-radius: 10px;
          border: 1px solid var(--border);
        }

        .round-header {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary);
          margin-bottom: 8px;
        }

        .statement {
          display: flex;
          gap: 8px;
          margin-bottom: 8px;
        }

        .statement:last-child {
          margin-bottom: 0;
        }

        .agent {
          font-size: 16px;
        }

        .statement p {
          margin: 0;
          font-size: 13px;
          line-height: 1.4;
        }
      `}</style>
    </div>
  );
}

// Decision Card
function DecisionCard({ decision }: { decision: DecisionResult }) {
  const decisionConfig = {
    buy: { color: "#10b981", icon: "📈", label: "BUY" },
    hold: { color: "#f59e0b", icon: "⏸️", label: "HOLD" },
    reduce: { color: "#ef4444", icon: "📉", label: "REDUCE" },
  };

  const config = decisionConfig[decision.decision as keyof typeof decisionConfig] || decisionConfig.hold;

  return (
    <div className="decision-card" style={{ borderColor: config.color }}>
      <div className="decision-badge" style={{ background: config.color }}>
        {config.icon} {config.label}
      </div>
      <p className="final-statement">{decision.final_statement}</p>
      <div className="decision-meta">
        <span>
          {decision.consensus_reached ? "✓ Consensus" : "⚠️ Split"}
        </span>
        <span>{(decision.confidence * 100).toFixed(0)}% confident</span>
      </div>
      <style jsx>{`
        .decision-card {
          padding: 20px;
          background: var(--card);
          border-radius: 16px;
          border: 2px solid;
          margin-top: 16px;
        }

        .decision-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: 20px;
          color: white;
          font-weight: 700;
          font-size: 14px;
        }

        .final-statement {
          margin: 16px 0;
          font-size: 15px;
          line-height: 1.6;
        }

        .decision-meta {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          color: var(--text-secondary);
        }
      `}</style>
    </div>
  );
}
