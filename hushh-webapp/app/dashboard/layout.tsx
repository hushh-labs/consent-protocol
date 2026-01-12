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

import { DashboardHeader } from "@/components/layout/dashboard-header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <VaultLockGuard>
      <ConsentSSEProvider>
        <ConsentNotificationProvider>
          {/* Simple scrollable content - no sidebar */}
          <main className="flex-1 overflow-y-auto pt-safe">{children}</main>
        </ConsentNotificationProvider>
      </ConsentSSEProvider>
    </VaultLockGuard>
  );
}
