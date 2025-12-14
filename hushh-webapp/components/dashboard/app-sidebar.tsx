"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Utensils,
  ShoppingBag,
  CreditCard,
  Plane,
  MessageCircle,
  Dumbbell,
  FileText,
  UserCheck,
  Shield,
  Code,
  Bot,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuBadge,
  SidebarHeader,
} from "@/components/ui/sidebar";

const domains = [
  {
    name: "Professional Profile",
    href: "/dashboard/professional",
    icon: UserCheck,
    status: "active",
  },
  {
    name: "Food & Dining",
    href: "/dashboard/food",
    icon: Utensils,
    status: "active",
  },
  {
    name: "Fashion",
    href: "/dashboard/fashion",
    icon: ShoppingBag,
    status: "soon",
  },
  {
    name: "Transactions",
    href: "/dashboard/transactions",
    icon: CreditCard,
    status: "soon",
  },
  {
    name: "Travel",
    href: "/dashboard/travel",
    icon: Plane,
    status: "soon",
  },
  {
    name: "Social Media",
    href: "/dashboard/social",
    icon: MessageCircle,
    status: "soon",
  },
  {
    name: "Fitness",
    href: "/dashboard/fitness",
    icon: Dumbbell,
    status: "soon",
  },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader className="h-16 flex items-center border-b px-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🤫</span>
          <div>
            <h2 className="font-semibold">Hushh PDA</h2>
            <p className="text-xs text-muted-foreground">Personal Data Agent</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Orchestrator Group */}
        <SidebarGroup>
          <SidebarGroupLabel className="uppercase text-xs font-bold tracking-wider text-muted-foreground/50">
            Hushh Orchestrator
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === "/dashboard"}
                  size="lg"
                  className="md:h-12 md:text-base font-semibold"
                >
                  <Link href="/dashboard">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                      <Bot className="h-4 w-4" />
                    </div>
                    <span className="ml-2">Orchestrator Chat</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Data Domains Group */}
        <SidebarGroup>
          <SidebarGroupLabel>Vault Data Domains</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {domains.map((domain) => {
                const isActive =
                  pathname === domain.href ||
                  pathname.startsWith(domain.href + "/");
                const Icon = domain.icon;

                return (
                  <SidebarMenuItem key={domain.href}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link href={domain.href}>
                        <Icon className="h-4 w-4" />
                        <span>{domain.name}</span>
                      </Link>
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

        {/* Security Group */}
        <SidebarGroup>
          <SidebarGroupLabel>Security</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === "/dashboard/consents"}
                >
                  <Link href="/dashboard/consents">
                    <Shield className="h-4 w-4" />
                    <span>Consents</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Resources Group */}
        <SidebarGroup>
          <SidebarGroupLabel>Resources</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/docs"}>
                  <Link href="/docs">
                    <FileText className="h-4 w-4" />
                    <span>Documentation</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === "/docs/developer-api"}
                >
                  <Link href="/docs/developer-api">
                    <Code className="h-4 w-4" />
                    <span>Developer API</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
