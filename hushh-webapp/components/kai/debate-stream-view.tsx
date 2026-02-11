"use client";

import { InteractiveStreamingView } from "@/components/kai/interactive-streaming-view";

interface DebateStreamViewProps {
  ticker: string;
  userId: string;
  riskProfile?: string;
  vaultOwnerToken: string;
  onClose?: () => void;
}

export function DebateStreamView({
  ticker,
  userId,
  riskProfile = "balanced",
  vaultOwnerToken,
  onClose,
}: DebateStreamViewProps) {
  return (
    <InteractiveStreamingView
      ticker={ticker}
      userId={userId}
      riskProfile={riskProfile}
      vaultOwnerToken={vaultOwnerToken}
      onClose={onClose}
    />
  );
}
