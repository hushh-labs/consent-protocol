"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Shield,
  TrendingUp,
  Home,
  MessageSquare,
  User,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuBadge,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { SidebarMenuButton } from "@/lib/morphy-ux/ui";
import { usePendingConsentCount } from "@/components/consent/notification-provider";

const domains = [
  {
    name: "Agent Kai",
    href: "/dashboard/kai",
    icon: TrendingUp,
    status: "active",
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const pendingCount = usePendingConsentCount();

  return (
    <Sidebar>
      <SidebarHeader className="h-16 flex items-center justify-start border-b px-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🤫</span>
          <div>
            <h2 className="font-semibold">Hushh PDA</h2>
            <p className="text-xs text-muted-foreground">Personal Data Agent</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Dashboard Overview */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  href="/dashboard"
                  isActive={pathname === "/dashboard"}
                  size="lg"
                  className="md:h-12 md:text-base font-semibold"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <Home className="h-4 w-4" />
                  </div>
                  <span className="ml-2">Dashboard</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Data Domains */}
        <SidebarGroup>
          <SidebarGroupLabel>Data Domains</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {domains.map((domain) => {
                const isActive =
                  pathname === domain.href ||
                  pathname?.startsWith(domain.href + "/");
                const Icon = domain.icon;

                return (
                  <SidebarMenuItem key={domain.href}>
                    <SidebarMenuButton href={domain.href} isActive={isActive}>
                      <Icon className="h-4 w-4" />
                      <span>{domain.name}</span>
                    </SidebarMenuButton>
                    {domain.status === "soon" && (
                      <SidebarMenuBadge>Soon</SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Security */}
        <SidebarGroup>
          <SidebarGroupLabel>Security</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  href="/dashboard/consents"
                  isActive={pathname === "/dashboard/consents"}
                >
                  <Shield className="h-4 w-4" />
                  <span>Consents</span>
                </SidebarMenuButton>
                {pendingCount > 0 && (
                  <SidebarMenuBadge className="bg-red-500 text-white">
                    {pendingCount}
                  </SidebarMenuBadge>
                )}
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
