"use client";

/**
 * Kai Landing Page - First page after login
 *
 * Hero and value proposition for the finance-focused AI committee.
 * Primary CTA: Open Kai Dashboard.
 */

import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button, Card, CardContent } from "@/lib/morphy-ux/morphy";
import { TrendingUp, BarChart3, Shield, ArrowRight } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/firebase/auth-context";
import { OnboardingTour } from "@/components/onboarding/onboarding-tour";
import { OnboardingService } from "@/lib/services/onboarding-service";
import { KaiOnboardingFlow } from "@/components/kai/kai-onboarding-flow";
import { getOnboardingStatusCache } from "@/components/vault/vault-lock-guard";
import { toast } from "sonner";

export default function KaiLandingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  // Check onboarding status on mount - use cache first for instant response
  useEffect(() => {
    const checkOnboarding = async () => {
      if (!user || showOnboarding) return;

      // Try cache first (preloaded in VaultLockGuard)
      const cached = getOnboardingStatusCache();
      if (cached && cached.userId === user.uid) {
        if (cached.completed) {
          setOnboardingComplete(true);
        } else {
          setTimeout(() => setShowOnboarding(true), 300);
        }
        return;
      }

      // Fallback to API call if cache miss
      const completed = await OnboardingService.checkOnboardingStatus(user.uid);
      if (!completed) {
        // Small delay to ensure layout (navbar) is ready
        setTimeout(() => setShowOnboarding(true), 200);
      } else {
        // Onboarding already done - trigger flow animation
        setOnboardingComplete(true);
      }
    };

    checkOnboarding();
  }, [user]);


  return (
    <main className="flex-1 flex flex-col items-center justify-center p-6 min-h-0">
      <div className="w-full max-w-md space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
        {/* Hero Section - Restored Original Style */}
        <div className="text-center space-y-8">
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="p-5 rounded-3xl bg-primary/10 ring-1 ring-primary/20 shadow-inner">
              <TrendingUp className="h-12 w-12 text-primary animate-pulse" />
            </div>
            <h1 className="text-6xl font-black tracking-tighter">Kai</h1>
            <span className="inline-flex items-center px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-muted/50 text-muted-foreground border border-border/50">
              Hushh Technologies
            </span>
          </div>
          
          <p className="text-muted-foreground text-lg font-medium leading-relaxed max-w-xs mx-auto">
            Your personal investment committee. Smart, private, and precise.
          </p>
        </div>

        {/* Feature Flow - Git-branch style animation */}
        <KaiOnboardingFlow onboardingComplete={onboardingComplete} />

        {/* CTA */}
        <div className="pt-4">
          <Button
            variant="gradient"
            size="xl"
            className="w-full h-14 text-lg shadow-lg shadow-primary/25 rounded-2xl"
            onClick={() => router.push("/kai/dashboard")}
            showRipple
          >
            Open Hushh Dashboard
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Onboarding Tour */}
      {showOnboarding && (
        <OnboardingTour
          onComplete={async () => {
            if (user) await OnboardingService.completeOnboarding(user.uid);
            setShowOnboarding(false);
            setOnboardingComplete(true);
            toast.success("You're all set! 🚀");
          }}
          onSkip={() => {
            setShowOnboarding(false);
            toast.info("Tour skipped");
          }}
        />
      )}
    </main>
  );
}
