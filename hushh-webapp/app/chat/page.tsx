// app/chat/page.tsx

/**
 * Unified Kai Chat Interface
 *
 * Features:
 * - Persistent conversation history
 * - Insertable UI components (analysis, portfolio import, etc.)
 * - Voice input support
 * - Streaming responses
 */

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/auth-context";
import { useVault } from "@/lib/vault/vault-context";
import { KaiChat } from "@/components/kai/kai-chat";

export default function ChatPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { vaultOwnerToken, getVaultKey } = useVault();

  // Auth protection
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/");
    }
  }, [authLoading, isAuthenticated, router]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user || !vaultOwnerToken) {
    return null;
  }

  return (
    <div className="h-screen flex flex-col">
      <KaiChat
        userId={user.uid}
        vaultOwnerToken={vaultOwnerToken}
      />
    </div>
  );
}
