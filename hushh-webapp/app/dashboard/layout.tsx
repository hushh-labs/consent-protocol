"use client";

import { DashboardBreadcrumb } from "@/components/dashboard/dashboard-breadcrumb";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { ConsentNotificationProvider } from "@/components/consent/notification-provider";
import { VaultLockGuard } from "@/components/vault/vault-lock-guard";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <VaultLockGuard>
      <ConsentNotificationProvider>
        <SidebarProvider>
          {/* Sidebar - already fixed via sidebar.tsx */}
          <AppSidebar />

          {/* Main content area - single scrollable container */}
          <SidebarInset className="flex flex-col min-h-0 bg-transparent">
            {/* Fixed header with breadcrumb - glass effect */}
            <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b bg-background/80 backdrop-blur-sm supports-[backdrop-filter]:bg-background/60 px-4">
              <SidebarTrigger className="-ml-1 cursor-pointer" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <DashboardBreadcrumb />
            </header>

            {/* Scrollable content area - only scrollbar here */}
            <main className="flex-1 overflow-y-auto">
              <div className="flex flex-col gap-4 p-4">{children}</div>
            </main>
          </SidebarInset>
        </SidebarProvider>
      </ConsentNotificationProvider>
    </VaultLockGuard>
  );
}
