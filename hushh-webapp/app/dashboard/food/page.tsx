/**
 * Food Dashboard Page
 * ===================
 * 
 * Displays user's own food data directly (no consent needed for own data).
 * Consent is only required when SHARING data with third parties.
 * Theme-aware colors for accessibility.
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/firebase";

// Mock data for user's own food profile
// In production, this would come from the user's vault/database
const mockUserData = {
  dietaryProfile: {
    diet_type: "vegetarian",
    allergies: ["peanuts", "shellfish"],
    intolerances: ["lactose"],
    calorie_target: 2000,
    macro_targets: { protein_g: 50, carbs_g: 250, fat_g: 65, fiber_g: 25 },
  },
  foodPreferences: {
    favorite_cuisines: ["italian", "japanese", "mexican"],
    spice_tolerance: "medium",
    cooking_skill: "intermediate",
    portion_preference: "regular",
  },
  diningHistory: [
    {
      id: "1",
      restaurant: "Olive Garden",
      cuisine: "Italian",
      meal_type: "dinner",
      date: "2024-12-10",
      amount: 45.50,
      event_type: "dine_in",
    },
    {
      id: "2",
      restaurant: "Home Cooked",
      cuisine: "American",
      meal_type: "lunch",
      date: "2024-12-09",
      amount: 0,
      event_type: "home_cooked",
    },
    {
      id: "3",
      restaurant: "Sushi Zen",
      cuisine: "Japanese",
      meal_type: "dinner",
      date: "2024-12-08",
      amount: 62.00,
      event_type: "dine_in",
    },
  ],
};

export default function FoodDashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading, phoneNumber } = useAuth();
  const [isLoading, setIsLoading] = useState(true);

  const userId = phoneNumber || user?.phoneNumber || "";

  // Simulate loading user's own data
  useEffect(() => {
    if (user) {
      // In production: fetch from user's vault
      const timer = setTimeout(() => setIsLoading(false), 500);
      return () => clearTimeout(timer);
    }
  }, [user]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  if (authLoading || isLoading) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <div className="animate-pulse text-4xl">🍽️</div>
      </main>
    );
  }

  if (!user) return null;

  const { dietaryProfile, foodPreferences, diningHistory } = mockUserData;

  return (
    <main className="flex-1 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="none" effect="glass" className="px-3">
                ←
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-foreground">🍽️ Food & Dining</h1>
              <p className="text-muted-foreground text-sm">{userId}</p>
            </div>
          </div>
        </header>

        {/* Dietary Profile */}
        <Card variant="none" effect="glass" className="p-6">
          <CardTitle className="mb-4 flex items-center gap-2 text-foreground">
            <span>🥗</span> Dietary Profile
          </CardTitle>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground uppercase">Diet Type</p>
              <p className="text-lg font-medium capitalize text-foreground">{dietaryProfile.diet_type}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">Calorie Target</p>
              <p className="text-lg font-medium text-foreground">{dietaryProfile.calorie_target} kcal</p>
            </div>
            {dietaryProfile.allergies.length > 0 && (
              <div className="md:col-span-2">
                <p className="text-xs text-muted-foreground uppercase mb-2">Allergies</p>
                <div className="flex flex-wrap gap-2">
                  {dietaryProfile.allergies.map((allergy) => (
                    <span key={allergy} className="px-3 py-1 rounded-full bg-red-500/20 text-red-600 dark:text-red-400 text-sm capitalize">
                      {allergy}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {dietaryProfile.intolerances.length > 0 && (
              <div className="md:col-span-2">
                <p className="text-xs text-muted-foreground uppercase mb-2">Intolerances</p>
                <div className="flex flex-wrap gap-2">
                  {dietaryProfile.intolerances.map((item) => (
                    <span key={item} className="px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 text-sm capitalize">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Food Preferences */}
        <Card variant="none" effect="glass" className="p-6">
          <CardTitle className="mb-4 flex items-center gap-2 text-foreground">
            <span>❤️</span> Food Preferences
          </CardTitle>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground uppercase mb-2">Favorite Cuisines</p>
              <div className="flex flex-wrap gap-2">
                {foodPreferences.favorite_cuisines.map((cuisine) => (
                  <span key={cuisine} className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 text-sm capitalize">
                    {cuisine}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">Spice Tolerance</p>
              <p className="text-lg font-medium capitalize text-foreground">{foodPreferences.spice_tolerance}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">Cooking Skill</p>
              <p className="text-lg font-medium capitalize text-foreground">{foodPreferences.cooking_skill}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">Portion Size</p>
              <p className="text-lg font-medium capitalize text-foreground">{foodPreferences.portion_preference}</p>
            </div>
          </div>
        </Card>

        {/* Dining History */}
        <Card variant="none" effect="glass" className="p-6">
          <CardTitle className="mb-4 flex items-center gap-2 text-foreground">
            <span>📍</span> Recent Dining
          </CardTitle>
          <div className="space-y-4">
            {diningHistory.map((event) => (
              <div key={event.id} className="flex items-center justify-between p-4 rounded-xl bg-secondary/50 dark:bg-secondary/30">
                <div className="flex items-center gap-4">
                  <div className="text-2xl">
                    {event.event_type === "dine_in" ? "🍴" : 
                     event.event_type === "delivery" ? "🛵" : 
                     event.event_type === "home_cooked" ? "👨‍🍳" : "🍔"}
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{event.restaurant}</p>
                    <p className="text-sm text-muted-foreground capitalize">{event.cuisine} • {event.meal_type}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-foreground">
                    {event.amount > 0 ? `$${event.amount.toFixed(2)}` : "-"}
                  </p>
                  <p className="text-sm text-muted-foreground">{event.date}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Share Data CTA - This is where consent would be needed */}
        <Card variant="none" effect="glass" className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-2xl">🔗</span>
              <div>
                <h3 className="font-semibold text-foreground">Share Your Food Data</h3>
                <p className="text-sm text-muted-foreground">
                  Grant consent to external apps and agents
                </p>
              </div>
            </div>
            <Button variant="gradient" effect="glass" showRipple disabled>
              Share (Coming Soon)
            </Button>
          </div>
        </Card>
      </div>
    </main>
  );
}
