// app/food-setup/page.tsx

/**
 * Food Preferences Setup Page
 *
 * Demo page showcasing the Food Agent chat interface
 * for collecting dining preferences.
 */

"use client";

import { FoodAgentChat } from "@/components/chat/food-agent-chat";
import { Card } from "@/lib/morphy-ux/morphy";
import {
  UtensilsCrossed,
  ShieldCheck,
  Sparkles,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function FoodSetupPage() {
  const handleComplete = (data: Record<string, unknown>) => {
    console.log("Preferences saved:", data);
    // Could redirect to recommendations page here
  };

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/70 dark:bg-black/70 border-b border-orange-100 dark:border-orange-900/30">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center">
                <UtensilsCrossed className="h-4 w-4 text-white" />
              </div>
              <span className="font-semibold">Food Preferences</span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            <span>End-to-end encrypted</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          {/* Hero */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-sm mb-4">
              <Sparkles className="h-4 w-4" />
              <span>AI-Powered Preference Collection</span>
            </div>
            <h1 className="text-3xl font-bold mb-2">
              Set Up Your{" "}
              <span className="bg-gradient-to-r from-orange-500 to-amber-600 bg-clip-text text-transparent">
                Dining Preferences
              </span>
            </h1>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Have a quick chat with our Food Agent to personalize your
              restaurant recommendations. Your data stays encrypted in your
              vault.
            </p>
          </div>

          {/* Chat Component */}
          <FoodAgentChat userId="user_demo_001" onComplete={handleComplete} />

          {/* Feature Cards */}
          <div className="grid grid-cols-3 gap-4 mt-8">
            <Card variant="none" effect="glass" className="p-4 text-center">
              <div className="text-2xl mb-2">🥗</div>
              <div className="font-medium text-sm">Dietary Filters</div>
              <p className="text-xs text-muted-foreground">
                Vegan, gluten-free & more
              </p>
            </Card>
            <Card variant="none" effect="glass" className="p-4 text-center">
              <div className="text-2xl mb-2">🍽️</div>
              <div className="font-medium text-sm">Cuisine Matching</div>
              <p className="text-xs text-muted-foreground">
                Your favorite cuisines
              </p>
            </Card>
            <Card variant="none" effect="glass" className="p-4 text-center">
              <div className="text-2xl mb-2">💰</div>
              <div className="font-medium text-sm">Budget Smart</div>
              <p className="text-xs text-muted-foreground">
                Within your budget
              </p>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
