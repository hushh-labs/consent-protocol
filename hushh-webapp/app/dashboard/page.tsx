// app/dashboard/page.tsx

'use client';

import { UserProfile } from '@/components/dashboard/user-profile';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/lib/morphy-ux/morphy';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Utensils, ShoppingBag, CreditCard, Plane, MessageCircle, Dumbbell, ArrowRight } from 'lucide-react';

const domainStats = [
  {
    name: 'Food & Dining',
    icon: Utensils,
    status: 'active',
    count: '1 vault',
    color: 'text-orange-500',
    href: '/dashboard/food'
  },
  {
    name: 'Fashion',
    icon: ShoppingBag,
    status: 'soon',
    count: '—',
    color: 'text-pink-500',
    href: '/dashboard/fashion'
  },
  {
    name: 'Transactions',
    icon: CreditCard,
    status: 'soon',
    count: '—',
    color: 'text-green-500',
    href: '/dashboard/transactions'
  },
  {
    name: 'Travel',
    icon: Plane,
    status: 'soon',
    count: '—',
    color: 'text-blue-500',
    href: '/dashboard/travel'
  },
  {
    name: 'Social Media',
    icon: MessageCircle,
    status: 'soon',
    count: '—',
    color: 'text-purple-500',
    href: '/dashboard/social'
  },
  {
    name: 'Fitness',
    icon: Dumbbell,
    status: 'soon',
    count: '—',
    color: 'text-red-500',
    href: '/dashboard/fitness'
  }
];

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <UserProfile />

      {/* Security Badge */}
      <Card variant="none" effect="glass" className="border-accent">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🔐</span>
            <div className="flex-1 text-sm">
              <p className="font-medium mb-1">End-to-End Encrypted</p>
              <p className="text-muted-foreground">
                All your data is encrypted client-side before storage. We cannot read your data.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
