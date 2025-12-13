// components/dashboard/dashboard-breadcrumb.tsx

'use client';

import { usePathname } from 'next/navigation';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Home } from 'lucide-react';

const pathNameMap: Record<string, string> = {
  dashboard: 'Dashboard',
  food: 'Food & Dining',
  fashion: 'Fashion',
  transactions: 'Transactions',
  travel: 'Travel',
  social: 'Social Media',
  fitness: 'Fitness',
  setup: 'Setup',
  agent: 'AI Agent',
};

export function DashboardBreadcrumb() {
  const pathname = usePathname();
  
  if (!pathname) return null;

  const segments = pathname.split('/').filter(Boolean);
  
  // Don't show breadcrumb on root dashboard
  if (segments.length <= 1) return null;

  return (
    <Breadcrumb className="mb-6">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="/dashboard" className="flex items-center gap-1">
            <Home className="h-4 w-4" />
            Dashboard
          </BreadcrumbLink>
        </BreadcrumbItem>
        
        {segments.slice(1).map((segment, index) => {
          const isLast = index === segments.length - 2;
          const href = `/${segments.slice(0, index + 2).join('/')}`;
          const label = pathNameMap[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);
          
          return (
            <div key={segment} className="flex items-center gap-2">
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink href={href}>{label}</BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </div>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
