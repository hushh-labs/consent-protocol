// app/dashboard/page.tsx

/**
 * Main Dashboard - Orchestrator Entry Point
 *
 * The central hub for all agent interactions.
 * Chat flows through orchestrator which delegates to domain agents.
 */

"use client";

import { useState, useEffect } from "react";
// import { useRouter } from "next/navigation"; // Removed unused
import { AgentChat } from "@/components/chat/agent-chat";
import { CollectedDataCard } from "@/components/chat/collected-data-card";
import { ConsentStatusBar } from "@/components/consent/status-bar";
import { Card, CardContent } from "@/lib/morphy-ux/morphy";
import { Shield, Sparkles } from "lucide-react";
// import { useVault } from "@/lib/vault/vault-context"; // Removed unused
import { ApiService } from "@/lib/services/api-service";
import { useAuth } from "@/lib/firebase/auth-context";
import { decryptData } from "@/lib/vault/encrypt";
import { useVault } from "@/lib/vault/vault-context";

export default function DashboardPage() {
  // const router = useRouter(); // Removed unused
  const { user } = useAuth();
  const { getVaultKey } = useVault();

  const [collectedData, setCollectedData] = useState<Record<string, unknown>>(
    {}
  );
  const [loadingData, setLoadingData] = useState(false);

  // Fetch existing data on mount
  useEffect(() => {
    async function loadExistingData() {
      if (!user) return;
      const vaultKey = getVaultKey();
      if (!vaultKey) return; // Data is encrypted, need key to show it

      try {
        setLoadingData(true);
        const [foodRes, profRes] = await Promise.all([
          ApiService.getFoodPreferences(user.uid),
          ApiService.getProfessionalProfile(user.uid),
        ]);

        const baseData: Record<string, unknown> = {};

        // Process Food Data
        if (foodRes.ok) {
          const foodJson = await foodRes.json();
          const prefs = foodJson.preferences || {};

          if (prefs.dietary_restrictions) {
            const decrypted = await decryptData(
              prefs.dietary_restrictions,
              vaultKey
            );
            if (decrypted)
              baseData.dietary_restrictions = JSON.parse(decrypted);
          }
          if (prefs.cuisine_preferences) {
            const decrypted = await decryptData(
              prefs.cuisine_preferences,
              vaultKey
            );
            if (decrypted) baseData.cuisine_preferences = JSON.parse(decrypted);
          }
          if (prefs.monthly_food_budget) {
            const decrypted = await decryptData(
              prefs.monthly_food_budget,
              vaultKey
            );
            if (decrypted) baseData.monthly_budget = JSON.parse(decrypted);
          }
        }

        // Process Professional Data
        if (profRes.ok) {
          const profJson = await profRes.json();
          const prefs = profJson.preferences || {};

          if (prefs.professional_title) {
            const decrypted = await decryptData(
              prefs.professional_title,
              vaultKey
            );
            if (decrypted) baseData.professional_title = JSON.parse(decrypted);
          }
          if (prefs.skills) {
            const decrypted = await decryptData(prefs.skills, vaultKey);
            if (decrypted) baseData.skills = JSON.parse(decrypted);
          }
        }

        setCollectedData((prev) => ({ ...prev, ...baseData }));
      } catch (error) {
        console.error("Failed to load existing data:", error);
      } finally {
        setLoadingData(false);
      }
    }

    loadExistingData();
  }, [user, getVaultKey]);

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
          {Object.keys(collectedData).length === 0 && !loadingData && (
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
