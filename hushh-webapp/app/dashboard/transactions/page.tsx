'use client';

// app/dashboard/transactions/page.tsx

import { ComingSoonCard } from '@/components/dashboard/coming-soon-card';
import { CreditCard } from 'lucide-react';

export default function TransactionsPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <ComingSoonCard
        title="Transactions & Finance"
        description="Analyze your spending patterns, track budgets, and get personalized financial insights. Your transaction data stays encrypted and private."
        icon={CreditCard}
        color="text-green-500"
      />
    </div>
  );
}
