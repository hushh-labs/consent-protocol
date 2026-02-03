"use client";

/**
 * Kai Layout - Minimal Mobile-First
 *
 * Wraps all /kai routes with VaultLockGuard and ConsentSSEProvider.
 * No sidebar. Uses bottom navbar with consent notifications.
 */

import { ConsentSSEProvider } from "@/lib/consent";
import { ConsentNotificationProvider } from "@/components/consent/notification-provider";
import { VaultLockGuard } from "@/components/vault/vault-lock-guard";

export default function KaiLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <VaultLockGuard>
      <ConsentSSEProvider>
        <ConsentNotificationProvider>
          {children}
        </ConsentNotificationProvider>
      </ConsentSSEProvider>
    </VaultLockGuard>
  );
}
