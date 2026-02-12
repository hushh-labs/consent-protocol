"use client";

import { ImportProgressView, ImportStage } from "./views/import-progress-view";

export interface AgentAnalysisViewProps {
  agent: "fundamental" | "sentiment" | "valuation";
  agentName: string;
  agentIcon: React.ReactNode;
  agentColor: string;
  ticker: string;
  userId: string;
  riskProfile?: string;
  vaultOwnerToken: string;
  onCancel?: () => void;
}

export function AgentAnalysisView({
  agent,
  agentName: _agentName,
  agentIcon: _agentIcon,
  agentColor: _agentColor,
  ticker: _ticker,
  userId: _userId,
  riskProfile: _riskProfile = "balanced",
  vaultOwnerToken: _vaultOwnerToken,
  onCancel,
}: AgentAnalysisViewProps) {
  // Map agent to appropriate stage for ImportProgressView
  const getInitialStage = (): ImportStage => {
    switch (agent) {
      case "fundamental":
        return "analyzing";
      case "sentiment":
        return "analyzing";
      case "valuation":
        return "analyzing";
      default:
        return "idle";
    }
  };

  return (
    <ImportProgressView
      stage={getInitialStage()}
      streamedText=""
      isStreaming={true}
      totalChars={0}
      chunkCount={0}
      thoughts={[]}
      thoughtCount={0}
      errorMessage={undefined}
      onCancel={onCancel}
      className="border-l-4"
    />
  );
}