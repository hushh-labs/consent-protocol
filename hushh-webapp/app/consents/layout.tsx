"use client";

/**
 * Consents Layout - Mobile-First
 *
 * Wraps consents page with required providers.
 */

import { ConsentSSEProvider } from "@/lib/consent";
import { ConsentNotificationProvider } from "@/components/consent/notification-provider";
import { VaultLockGuard } from "@/components/vault/vault-lock-guard";

export default function ConsentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <VaultLockGuard>
      <ConsentSSEProvider>
        <ConsentNotificationProvider>
          <main className="flex-1 overflow-y-auto">{children}</main>
        </ConsentNotificationProvider>
      </ConsentSSEProvider>
    </VaultLockGuard>
  );
}
