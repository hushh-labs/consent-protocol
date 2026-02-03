// app/kai/dashboard/analysis/page.tsx

/**
 * Kai Analysis Page - Redirects to main Kai page
 *
 * The analysis functionality is now integrated into the main Kai flow.
 */

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStepProgress } from "@/lib/progress/step-progress-context";

export default function KaiAnalysisPage() {
  const router = useRouter();
  const { registerSteps, completeStep, reset } = useStepProgress();

  // Register 1 step: Redirect
  useEffect(() => {
    registerSteps(1);
    return () => reset();
  }, [registerSteps, reset]);

  useEffect(() => {
    // Step 1: Redirect complete
    completeStep();
    // Redirect to the main Kai page which now handles all flows
    router.replace("/kai/dashboard");
  }, [router, completeStep]);

  // Return null - progress bar shows at top
  return null;
}
