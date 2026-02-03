"use client";

/**
 * Legacy dashboard route - redirects to Kai.
 * Kept so /dashboard path exists; next.config redirects send users to /kai.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DashboardRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/kai");
  }, [router]);
  return null;
}
