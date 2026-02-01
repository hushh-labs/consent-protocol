// app/dashboard/kai/analysis/page.tsx

/**
 * Kai Analysis Page - Redirects to main Kai page
 *
 * The analysis functionality is now integrated into the main Kai flow.
 */

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { HushhLoader } from "@/components/ui/hushh-loader";

export default function KaiAnalysisPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the main Kai page which now handles all flows
    router.replace("/dashboard/kai");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <HushhLoader variant="inline" label="Loading Kai..." />
    </div>
  );
}
