"use client";

/**
 * Dashboard Layout - Minimal Mobile-First
 *
 * No sidebar. Uses bottom navbar with consent notifications.
 * Keeps VaultLockGuard and ConsentSSEProvider for security.
 */

import { ConsentSSEProvider } from "@/lib/consent";
import { ConsentNotificationProvider } from "@/components/consent/notification-provider";
import { VaultLockGuard } from "@/components/vault/vault-lock-guard";

export default function DashboardLayout({
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
