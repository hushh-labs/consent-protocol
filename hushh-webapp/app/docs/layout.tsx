"use client";

/**
 * Docs Layout using Dashboard Sidebar
 */

import { DashboardBreadcrumb } from "@/components/dashboard/dashboard-breadcrumb";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { Separator } from "@/components/ui/separator";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      {/* Sidebar - same as dashboard */}
      <AppSidebar />

      {/* Main content area */}
      <SidebarInset className="flex flex-col h-screen overflow-hidden">
        {/* Fixed header with breadcrumb */}
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <DashboardBreadcrumb />
        </header>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col gap-4 p-4">{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
