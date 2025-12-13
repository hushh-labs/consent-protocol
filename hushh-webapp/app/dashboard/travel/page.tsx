'use client';

// app/dashboard/travel/page.tsx

import { ComingSoonCard } from '@/components/dashboard/coming-soon-card';
import { Plane } from 'lucide-react';

export default function TravelPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <ComingSoonCard
        title="Travel & Destinations"
        description="Plan your trips, track your travel history, and get personalized destination recommendations based on your preferences and past experiences."
        icon={Plane}
        color="text-blue-500"
      />
    </div>
  );
}
