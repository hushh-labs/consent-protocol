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
          {/* Content - scroll handled by root providers */}
          {children}
        </ConsentNotificationProvider>
      </ConsentSSEProvider>
    </VaultLockGuard>
  );
}
