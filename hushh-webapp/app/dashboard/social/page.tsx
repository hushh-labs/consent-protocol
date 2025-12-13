'use client';

// app/dashboard/social/page.tsx

import { ComingSoonCard } from '@/components/dashboard/coming-soon-card';
import { MessageCircle } from 'lucide-react';

export default function SocialPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <ComingSoonCard
        title="Social Media"
        description="Analyze your social media activity, connections, and engagement patterns. Understand how you interact online while keeping your data private."
        icon={MessageCircle}
        color="text-purple-500"
      />
    </div>
  );
}
