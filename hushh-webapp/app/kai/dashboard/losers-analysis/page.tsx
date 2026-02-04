"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Backwards-compatibility redirect for the old Losers Analysis route.
 * New canonical page: /kai/dashboard/portfolio-health
 */
export default function LegacyLosersAnalysisRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/kai/dashboard/portfolio-health");
  }, [router]);

  return null;
}

