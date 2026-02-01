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
import { HushhLoader } from "@/components/ui/hushh-loader";

export default function ChatPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the new Kai dashboard
    router.replace("/dashboard/kai");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <HushhLoader variant="inline" label="Redirecting to Kai..." />
    </div>
  );
}
