"use client";

import { useEffect, useRef, useState } from "react";
import { useStepProgress } from "@/lib/progress/step-progress-context";

/**
 * Step Progress Bar
 *
 * A thin progress bar at the top of the viewport that shows real progress
 * based on completed loading steps.
 *
 * Features:
 * - Shows actual percentage based on steps (not fake progress)
 * - Smooth CSS transitions
 * - Auto-hides when progress reaches 100%
 * - Fixed position at top of viewport
 */
export function StepProgressBar() {
  const { progress, isLoading } = useStepProgress();
  const [visible, setVisible] = useState(false);
  const [displayProgress, setDisplayProgress] = useState(0);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clear any pending hide timeout
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }

    if (isLoading) {
      // Show bar and update progress
      setVisible(true);
      setDisplayProgress(progress);
    } else if (progress >= 100) {
      // Complete: show 100% then hide after animation
      setDisplayProgress(100);
      hideTimeoutRef.current = setTimeout(() => {
        setVisible(false);
        setDisplayProgress(0);
      }, 300); // Wait for transition to complete
    } else if (progress === 0) {
      // Reset state
      setVisible(false);
      setDisplayProgress(0);
    }

    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [progress, isLoading]);

  // Don't render if not visible
  if (!visible && displayProgress === 0) {
    return null;
  }

  return (
    <div
      className="fixed top-0 left-0 right-0 z-9999 h-[5px] pointer-events-none"
      style={{
        opacity: visible ? 1 : 0,
        transition: "opacity 200ms ease-out",
      }}
    >
      <div
        className="h-full bg-primary"
        style={{
          width: `${displayProgress}%`,
          transition: "width 200ms ease-out",
        }}
      />
    </div>
  );
}
