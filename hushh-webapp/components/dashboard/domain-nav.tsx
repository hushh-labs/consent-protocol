// components/dashboard/domain-nav.tsx

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Utensils,
  ShoppingBag,
  CreditCard,
  Plane,
  MessageCircle,
  Dumbbell
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const domains = [
  {
    name: 'Food & Dining',
    href: '/dashboard/food',
    icon: Utensils,
    status: 'active',
    color: 'text-orange-500'
  },
  {
    name: 'Fashion',
    href: '/dashboard/fashion',
    icon: ShoppingBag,
    status: 'soon',
    color: 'text-pink-500'
  },
  {
    name: 'Transactions',
    href: '/dashboard/transactions',
    icon: CreditCard,
    status: 'soon',
    color: 'text-green-500'
  },
  {
    name: 'Travel',
    href: '/dashboard/travel',
    icon: Plane,
    status: 'soon',
    color: 'text-blue-500'
  },
  {
    name: 'Social Media',
    href: '/dashboard/social',
    icon: MessageCircle,
    status: 'soon',
    color: 'text-purple-500'
  },
  {
    name: 'Fitness',
    href: '/dashboard/fitness',
    icon: Dumbbell,
    status: 'soon',
    color: 'text-red-500'
  }
];

export function DomainNav() {
  const pathname = usePathname();

  return (
    <nav className="space-y-1">
      {domains.map((domain) => {
        const Icon = domain.icon;
        const isActive = pathname?.startsWith(domain.href);
        
        return (
          <Link
            key={domain.name}
            href={domain.href}
            className={cn(
              'flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              isActive
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-accent/50 text-muted-foreground hover:text-foreground'
            )}
          >
            <div className="flex items-center gap-3">
              <Icon className={cn('h-5 w-5', domain.color)} />
              <span>{domain.name}</span>
            </div>
            {domain.status === 'soon' && (
              <Badge variant="secondary" className="text-xs">
                Soon
              </Badge>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
