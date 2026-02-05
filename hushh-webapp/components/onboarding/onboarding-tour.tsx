"use client";

/**
 * Onboarding Tour Component
 * ==========================
 * 
 * Interactive tour that highlights bottom navigation items with tooltips.
 * Shows after first vault unlock and tracks completion in database.
 * 
 * Features:
 * - Shadcn Popover tooltips with step counter
 * - CSS-based highlighting with overlay
 * - Next/Skip buttons
 * - Responsive positioning
 */

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/lib/morphy-ux/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { X, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface TourStep {
  id: string;
  title: string;
  description: string;
  targetSelector: string; // CSS selector for element to highlight
  popoverSide?: "top" | "bottom" | "left" | "right";
}

const TOUR_STEPS: TourStep[] = [
  {
    id: "nav-kai",
    title: "Kai - Your AI Committee",
    description: "Analyze stocks and manage your portfolio with three specialist AI agents.",
    targetSelector: '[data-tour-id="nav-kai"]',
    popoverSide: "top",
  },
  {
    id: "nav-consents",
    title: "Consent Management",
    description: "Control your data sharing and see what you've consented to.",
    targetSelector: '[data-tour-id="nav-consents"]',
    popoverSide: "top",
  },
  {
    id: "nav-profile",
    title: "Your Profile",
    description: "Manage your personal data stored in your encrypted vault.",
    targetSelector: '[data-tour-id="nav-profile"]',
    popoverSide: "top",
  },
  {
    id: "nav-agent-nav",
    title: "Agent Navigation",
    description: "Access specialized AI agents for different tasks and domains.",
    targetSelector: '[data-tour-id="nav-agent-nav"]',
    popoverSide: "top",
  },
];

interface OnboardingTourProps {
  onComplete: () => void;
  onSkip: () => void;
}

export function OnboardingTour({ onComplete, onSkip }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [highlightedElement, setHighlightedElement] = useState<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Find and highlight the current step's target element
  useEffect(() => {
    const step = TOUR_STEPS[currentStep];
    if (!step) return;

    // Small delay to allow element to render/animate if needed
    const timer = setTimeout(() => {
      const element = document.querySelector(step.targetSelector) as HTMLElement;
      if (element) {
        setHighlightedElement(element);
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        console.warn(`[OnboardingTour] Target not found: ${step.targetSelector}`);
      }
    }, 100);

    return () => {
      clearTimeout(timer);
      setHighlightedElement(null);
    };
  }, [currentStep]);

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handleSkip = () => {
    onComplete(); // Skip counts as completion so it doesn't show again
    onSkip();
  };

  const step = TOUR_STEPS[currentStep];
  const isLastStep = currentStep === TOUR_STEPS.length - 1;

  if (!step || !mounted) return null;

  // Render the highlight via portal to avoid stacking context issues
  const highlightOverlay = highlightedElement && createPortal(
    <div
      className="fixed z-[100000] pointer-events-none transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]"
      style={{
        top: `${highlightedElement.getBoundingClientRect().top - 8}px`,
        left: `${highlightedElement.getBoundingClientRect().left - 8}px`,
        width: `${highlightedElement.getBoundingClientRect().width + 16}px`,
        height: `${highlightedElement.getBoundingClientRect().height + 16}px`,
        borderRadius: "9999px", // Fully rounded for pill shape
        boxShadow: "0 0 0 4px var(--primary), 0 0 0 9999px rgba(0, 0, 0, 0.75)",
      }}
    />,
    document.body
  );

  return (
    <>
      {highlightOverlay}

      {/* Popover Tooltip */}
      {highlightedElement && (
        <Popover open={true}>
          <PopoverTrigger asChild>
            <div
              className="fixed z-[100001]"
              style={{
                top: `${highlightedElement.getBoundingClientRect().top}px`,
                left: `${highlightedElement.getBoundingClientRect().left}px`,
                width: `${highlightedElement.getBoundingClientRect().width}px`,
                height: `${highlightedElement.getBoundingClientRect().height}px`,
                pointerEvents: "none",
              }}
            />
          </PopoverTrigger>

          <PopoverContent
            side={step.popoverSide}
            align="center"
            sideOffset={24}
            className={cn(
              "z-[100002] w-80 p-6 pointer-events-auto",
              "bg-background/95 backdrop-blur-xl",
              "border border-primary/20",
              "shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
              "rounded-3xl"
            )}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-1">{step.title}</h3>
                <p className="text-sm text-muted-foreground">
                  Step {currentStep + 1} of {TOUR_STEPS.length}
                </p>
              </div>
              <Button
                variant="none"
                size="sm"
                className="h-8 w-8 p-0 -mt-1 -mr-1"
                onClick={handleSkip}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Description */}
            <p className="text-sm text-muted-foreground mb-6">
              {step.description}
            </p>

            {/* Actions */}
            <div className="flex items-center justify-between gap-3">
              <Button
                variant="link"
                size="sm"
                onClick={handleSkip}
                className="text-muted-foreground"
              >
                Skip Tour
              </Button>
              <Button
                variant="gradient"
                size="lg"
                onClick={handleNext}
                className="shadow-lg shadow-primary/25"
                showRipple
              >
                {isLastStep ? "Get Started" : "Next"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </>
  );
}
