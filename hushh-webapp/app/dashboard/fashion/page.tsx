"use client"
// app/dashboard/fashion/page.tsx

import { ComingSoonCard } from '@/components/dashboard/coming-soon-card';
import { ShoppingBag } from 'lucide-react';

export default function FashionPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <ComingSoonCard
        title="Fashion & Style"
        description="Track your wardrobe, get outfit recommendations, and discover your personal style preferences. Our AI will help you build a sustainable and stylish wardrobe."
        icon={ShoppingBag}
        color="text-pink-500"
      />
    </div>
  );
}
