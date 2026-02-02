"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from "react";

/**
 * Step Progress Context
 *
 * Tracks loading progress based on discrete steps defined by each page.
 * Pages register their total steps on mount and call completeStep() after
 * each async operation completes.
 *
 * Progress = (completedSteps / totalSteps) * 100
 *
 * This provides accurate, predictable progress feedback instead of
 * fake/simulated progress bars.
 */

interface StepProgressContextValue {
  /**
   * Register the total number of steps for the current page.
   * Call this on mount with the number of async operations.
   */
  registerSteps: (total: number) => void;

  /**
   * Mark one step as complete. Call after each async operation finishes.
   */
  completeStep: () => void;

  /**
   * Reset progress to 0. Call on unmount or when starting fresh.
   */
  reset: () => void;

  /**
   * Current progress percentage (0-100).
   */
  progress: number;

  /**
   * True when loading is in progress (progress > 0 and < 100).
   */
  isLoading: boolean;
}

const StepProgressContext = createContext<StepProgressContextValue | undefined>(
  undefined
);

interface StepProgressProviderProps {
  children: ReactNode;
}

export function StepProgressProvider({ children }: StepProgressProviderProps) {
  const [totalSteps, setTotalSteps] = useState(0);
  const [completedSteps, setCompletedSteps] = useState(0);
  const completedRef = useRef(0);

  const registerSteps = useCallback((total: number) => {
    setTotalSteps(total);
    setCompletedSteps(0);
    completedRef.current = 0;
  }, []);

  const completeStep = useCallback(() => {
    // Use ref to avoid stale closure issues
    completedRef.current += 1;
    setCompletedSteps(completedRef.current);
  }, []);

  const reset = useCallback(() => {
    setTotalSteps(0);
    setCompletedSteps(0);
    completedRef.current = 0;
  }, []);

  // Calculate progress percentage
  const progress =
    totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  // Loading is true when we have steps registered and haven't completed all
  const isLoading = totalSteps > 0 && completedSteps < totalSteps;

  return (
    <StepProgressContext.Provider
      value={{
        registerSteps,
        completeStep,
        reset,
        progress,
        isLoading,
      }}
    >
      {children}
    </StepProgressContext.Provider>
  );
}

/**
 * Hook to access step progress context.
 * Returns safe defaults if used outside provider.
 */
export function useStepProgress(): StepProgressContextValue {
  const context = useContext(StepProgressContext);

  if (context === undefined) {
    // Return safe no-op defaults if provider not available
    return {
      registerSteps: () => {},
      completeStep: () => {},
      reset: () => {},
      progress: 0,
      isLoading: false,
    };
  }

  return context;
}
