'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Utensils,
  ShoppingBag,
  CreditCard,
  Plane,
  MessageCircle,
  Dumbbell,
  Home,
  FileText,
  UserCheck,
} from 'lucide-react';
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
} from '@/components/ui/sidebar';

const domains = [

  {
    name: 'Professional Profile',
    href: '/dashboard/professional',
    icon: UserCheck,
    status: 'active',
  },
  {
    name: 'Food & Dining',
    href: '/dashboard/food',
    icon: Utensils,
    status: 'active',
  },
  {
    name: 'Fashion',
    href: '/dashboard/fashion',
    icon: ShoppingBag,
    status: 'soon',
  },
  {
    name: 'Transactions',
    href: '/dashboard/transactions',
    icon: CreditCard,
    status: 'soon',
  },
  {
    name: 'Travel',
    href: '/dashboard/travel',
    icon: Plane,
    status: 'soon',
  },
  {
    name: 'Social Media',
    href: '/dashboard/social',
    icon: MessageCircle,
    status: 'soon',
  },
  {
    name: 'Fitness',
    href: '/dashboard/fitness',
    icon: Dumbbell,
    status: 'soon',
  },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader className="border-b p-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🤫</span>
          <div>
            <h2 className="font-semibold">Hushh PDA</h2>
            <p className="text-xs text-muted-foreground">Personal Data Agent</p>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Data Domains</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {domains.map((domain) => {
                const isActive = pathname === domain.href || pathname.startsWith(domain.href + '/');
                const Icon = domain.icon;
                
                return (
                  <SidebarMenuItem key={domain.href}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link href={domain.href}>
                        <Icon className="h-4 w-4" />
                        <span>{domain.name}</span>
                      </Link>
                    </SidebarMenuButton>
                    {domain.status === 'soon' && (
                      <SidebarMenuBadge>Soon</SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Resources</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/docs">
                    <FileText className="h-4 w-4" />
                    <span>Documentation</span>
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
