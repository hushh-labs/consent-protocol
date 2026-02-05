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
import { toast } from "sonner";

export default function KaiLandingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Check onboarding status on mount
  useEffect(() => {
    const checkOnboarding = async () => {
      if (!user || showOnboarding) return;

      const completed = await OnboardingService.checkOnboardingStatus(user.uid);
      if (!completed) {
        // Small delay to ensure layout (navbar) is ready
        setTimeout(() => setShowOnboarding(true), 800);
      }
    };

    checkOnboarding();
  }, [user]);

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-6 min-h-0">
      <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Hero */}
        <div className="text-center space-y-4">
          {/* Hushh Logo - using same pattern as welcome page for dark mode support */}
          <div className="flex justify-center">
            <Image
              src="/hushh-logo-new.svg"
              alt="Hushh"
              width={250}
              height={250}
              className="object-contain dark:brightness-0 dark:invert"
              priority
            />
          </div>
          
          {/* Kai Title with Icon */}
          <div className="flex items-center justify-center">
            <div className="px-6 py-4 rounded-2xl bg-primary/10 flex items-center justify-center gap-6">
              <TrendingUp className="h-8 w-8 text-primary" />
              <h1 className="text-5xl font-bold tracking-tight">Kai</h1>
            </div>
          </div>
          
          {/* Hushh Technologies Badge */}
          <div className="flex justify-center">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-muted/50 text-muted-foreground border border-border/50">
              Hushh Technologies
            </span>
          </div>
          
          {/* Tagline */}
          <p className="text-muted-foreground text-balance pt-2 max-w-md mx-auto">
            Your AI investment committee. Three specialist agents analyze, debate, and deliver decisions with receipts.
          </p>
        </div>

        {/* Value bullets */}
        <div className="space-y-4">
          <Card variant="none" effect="glass" className="p-5">
            <CardContent className="p-0 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
                <BarChart3 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold text-base">Investment Analysis</h3>
                <p className="text-sm text-muted-foreground">
                  Get Buy/Hold/Reduce decisions from three specialist agents.
                </p>
              </div>
            </CardContent>
          </Card>
          <Card variant="none" effect="glass" className="p-5">
            <CardContent className="p-0 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-green-500/10 text-green-600 dark:text-green-400 shrink-0">
                <Shield className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold text-base">On-Device Privacy</h3>
                <p className="text-sm text-muted-foreground">
                  Your financial data stays encrypted in your personal vault.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* CTA */}
        <div className="pt-4">
          <Button
            variant="gradient"
            size="xl"
            className="w-full h-14 text-lg shadow-lg shadow-primary/25 rounded-2xl"
            onClick={() => router.push("/kai/dashboard")}
            showRipple
          >
            Open Kai Dashboard
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
