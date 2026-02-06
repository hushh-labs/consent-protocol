"use client";

/**
 * KaiOnboardingFlow - Git-branch style flow visualization
 * 
 * A creative, animated flow component showing the journey through Kai:
 * 1. Import Portfolio (PDF or Plaid)
 * 2. Confirm & Encrypt (Privacy-first)
 * 3. Analyze & Optimize (AI-powered)
 * 
 * Features:
 * - Vertical progress bar from top to bottom through circle centers
 * - Git-branch style with node circles containing step icons
 * - Staggered animations when onboarding completes
 */

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Upload, Shield, ChartArea } from "lucide-react";

interface FlowStepData {
  number: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const STEPS: FlowStepData[] = [
  {
    number: 1,
    title: "Import Portfolio",
    description: "Upload PDF or connect via Plaid",
    icon: <Upload className="h-5 w-5" />,
    color: "emerald",
  },
  {
    number: 2,
    title: "Confirm & Encrypt",
    description: "Your data stays private",
    icon: <Shield className="h-5 w-5" />,
    color: "blue",
  },
  {
    number: 3,
    title: "Analyze & Optimize",
    description: "AI-powered insights",
    icon: <ChartArea className="h-5 w-5" />,
    color: "purple",
  },
];

export interface KaiOnboardingFlowProps {
  /** Whether onboarding is complete (triggers animation) */
  onboardingComplete: boolean;
  /** Optional class name */
  className?: string;
}

export function KaiOnboardingFlow({ onboardingComplete, className }: KaiOnboardingFlowProps) {
  const [activeStep, setActiveStep] = useState(-1);
  const [progressHeight, setProgressHeight] = useState(0);

  // Animate steps sequentially when onboarding completes
  useEffect(() => {
    if (!onboardingComplete) {
      setActiveStep(-1);
      setProgressHeight(0);
      return undefined;
    }

    // Animate progress bar and steps
    const timers: NodeJS.Timeout[] = [];
    
    // Start progress bar animation - sync with step activations
    timers.push(setTimeout(() => {
      setProgressHeight(10);
      setActiveStep(0);
    }, 100));
    
    timers.push(setTimeout(() => {
      setProgressHeight(55);
      setActiveStep(1);
    }, 400));
    
    timers.push(setTimeout(() => {
      setProgressHeight(100);
      setActiveStep(2);
    }, 700));

    return () => timers.forEach(t => clearTimeout(t));
  }, [onboardingComplete]);

  return (
    <div className={cn("relative py-4 flex justify-center w-full", className)}>
      {/* Inner container that holds both the line and the steps, centered as a group */}
      <div className="relative">
        {/* Background track - centered on 48px circles (exactly 24px from left) */}
        <div 
          className="absolute left-6 top-8 bottom-8 w-px bg-muted/20 rounded-full" 
          style={{ transform: 'translateX(-0.5px)' }}
        />
        
        {/* Animated progress fill - centered on 48px circles (exactly 24px from left) */}
        <div 
          className="absolute left-6 top-8 w-0.5 rounded-full transition-all duration-500 ease-out"
          style={{ 
            height: `calc((100% - 64px) * ${progressHeight / 100})`,
            transform: 'translateX(-1px)',
            background: 'linear-gradient(to bottom, #10b981, #3b82f6, #a855f7)',
            boxShadow: '0 0 15px rgba(59, 130, 246, 0.4)'
          }}
        />

        {/* Steps */}
        <div className="relative space-y-10">
          {STEPS.map((step, idx) => {
            const isActive = idx <= activeStep;
            const isCurrentlyAnimating = idx === activeStep;

            return (
              <div
                key={step.number}
                className={cn(
                  "flex items-center gap-8 transition-all duration-700",
                  isActive ? "opacity-100" : "opacity-30"
                )}
              >
                {/* Node circle - Standardized high-impact style for all */}
                <div
                  className={cn(
                    "relative z-10 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-700 shrink-0",
                    "ring-6 ring-white/5 shadow-xl scale-105", // All icons get the premium halo and scale
                    step.color === "emerald" ? "bg-emerald-500 text-white shadow-emerald-500/50" :
                    step.color === "blue" ? "bg-blue-500 text-white shadow-blue-500/50" :
                    "bg-purple-500 text-white shadow-purple-500/50",
                    !isActive && "opacity-40 grayscale-[0.2]" // Dim but keep style for inactive
                  )}
                >
                  {step.icon}
                </div>

                {/* Content */}
                <div
                  className={cn(
                    "transition-all duration-700 space-y-1 min-w-[200px]",
                    isActive ? "translate-x-0" : "translate-x-4"
                  )}
                >
                  <h3 className="font-black text-xl tracking-tighter text-foreground/90 leading-none">
                    {step.title}
                  </h3>
                  <p className="text-xs font-semibold text-muted-foreground/80 leading-relaxed max-w-[180px]">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

