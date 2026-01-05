"use client";

/**
 * Kai Layout - Minimal Mobile-First
 *
 * No sidebar. Uses bottom navbar.
 * Keeps VaultLockGuard and ConsentSSEProvider for security.
 */

import { ConsentSSEProvider } from "@/lib/consent";
import { ConsentNotificationProvider } from "@/components/consent/notification-provider";
import { VaultLockGuard } from "@/components/vault/vault-lock-guard";

export default function KaiLayout({ children }: { children: React.ReactNode }) {
  return (
    <VaultLockGuard>
      <ConsentSSEProvider>
        <ConsentNotificationProvider>
          {/* Simple scrollable content - no sidebar */}
          <main className="flex-1 overflow-y-auto">{children}</main>
        </ConsentNotificationProvider>
      </ConsentSSEProvider>
    </VaultLockGuard>
  );
}
