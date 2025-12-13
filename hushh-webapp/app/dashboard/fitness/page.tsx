'use client';

// app/dashboard/fitness/page.tsx

import { ComingSoonCard } from '@/components/dashboard/coming-soon-card';
import { Dumbbell } from 'lucide-react';

export default function FitnessPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <ComingSoonCard
        title="Fitness & Health"
        description="Track your workouts, monitor health metrics, and get personalized fitness recommendations. Your health data remains encrypted and under your control."
        icon={Dumbbell}
        color="text-red-500"
      />
    </div>
  );
}
