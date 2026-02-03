// app/chat/page.tsx

/**
 * Chat Page - Redirects to Kai Dashboard
 *
 * The chat interface has been replaced with a component-based flow.
 * This page redirects users to the new Kai experience.
 */

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStepProgress } from "@/lib/progress/step-progress-context";

export default function ChatPage() {
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
    // Redirect to the new Kai dashboard
    router.replace("/kai/dashboard");
  }, [router, completeStep]);

  // Return null - progress bar shows at top
  return null;
}
