// app/dashboard/page.tsx

/**
 * Main Dashboard - Orchestrator Entry Point
 *
 * The central hub for all agent interactions.
 * Chat flows through orchestrator which delegates to domain agents.
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AgentChat, PendingUI } from "@/components/chat/agent-chat";
import { CollectedDataCard } from "@/components/chat/collected-data-card";
import { ConsentStatusBar } from "@/components/consent/status-bar";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/lib/morphy-ux/morphy";
import { Shield, Sparkles, Loader2 } from "lucide-react";
import { useVault } from "@/lib/vault/vault-context";

export default function DashboardPage() {
  const router = useRouter();
  const { isVaultUnlocked } = useVault();
  const [collectedData, setCollectedData] = useState<Record<string, unknown>>(
    {}
  );

  // Check vault on mount - redirect to login if not unlocked
  useEffect(() => {
    if (!isVaultUnlocked) {
      // Vault not unlocked, redirect to login
      router.push("/login?redirect=/dashboard");
    }
  }, [isVaultUnlocked, router]);

  // Show loading while checking vault
  if (!isVaultUnlocked) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Checking vault status...
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Consent Status Bar */}
      <ConsentStatusBar className="mb-2" />

      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">
          <span className="bg-linear-to-r from-blue-600 to-emerald-500 bg-clip-text text-transparent">
            Hushh Orchestrator
          </span>
        </h1>
        <p className="text-muted-foreground flex items-center gap-2">
          <Shield className="h-4 w-4 text-emerald-500" />
          Chat with the orchestrator to set up your preferences. All data is
          encrypted in your vault.
        </p>
      </div>

      {/* Main Content: Chat + Sidebar */}
      <div className="flex gap-6">
        {/* Main Chat */}
        <div className="flex-1">
          <AgentChat
            agentId="agent_orchestrator"
            agentName="Hushh Orchestrator"
            hideHeader={true}
            initialMessage={`Hi! I can help you with your personal data preferences.

What would you like to set up?`}
            initialUI={{
              ui_type: "buttons",
              options: ["🍽️ Food & Dining", "💼 Professional Profile"],
              allow_custom: false,
            }}
            onCollectedDataChange={setCollectedData}
          />
        </div>

        {/* Dynamic Sidebar */}
        <div className="hidden lg:block w-80 space-y-4">
          {/* Collected Data Card - Shows preferences as they're collected */}
          <CollectedDataCard data={collectedData} domain="Current Session" />

          {/* Empty state when no data collected yet */}
          {Object.keys(collectedData).length === 0 && (
            <Card variant="none" effect="glass">
              <CardContent className="p-4 text-center">
                <Sparkles className="h-8 w-8 mx-auto mb-2 text-blue-500 opacity-50" />
                <p className="text-sm text-muted-foreground">
                  Start chatting to collect your preferences. They'll appear
                  here in real-time.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Security Info */}
          <Card
            variant="none"
            effect="glass"
            className="border-emerald-200 dark:border-emerald-800"
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <span className="text-xl">🔐</span>
                <div className="text-xs">
                  <p className="font-medium mb-1">End-to-End Encrypted</p>
                  <p className="text-muted-foreground leading-relaxed">
                    Your data is encrypted in your browser. We cannot read it.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
