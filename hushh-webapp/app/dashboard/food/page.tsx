"use client";

/**
 * Food Dashboard
 *
 * Displays user's encrypted food preferences with a clean, modern UI.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { decryptData } from "@/lib/vault/encrypt";
import { useVault } from "@/lib/vault/vault-context";
import { ApiService } from "@/lib/services/api-service";
import { getSessionItem } from "@/lib/utils/session-storage";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/lib/morphy-ux/morphy";
import {
  RefreshCw,
  Utensils,
  Leaf,
  ChefHat,
  Wallet,
  Shield,
  Edit3,
} from "lucide-react";

interface UserPreferences {
  dietary: string[];
  cuisines: string[];
  budget: number;
}

// Map dietary restrictions to icons/colors
const DIETARY_STYLES: Record<string, { icon: string; color: string }> = {
  vegan: {
    icon: "🌱",
    color: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
  },
  vegetarian: {
    icon: "🥬",
    color: "bg-green-500/10 text-green-600 border-green-200",
  },
  gluten_free: {
    icon: "🌾",
    color: "bg-amber-500/10 text-amber-600 border-amber-200",
  },
  dairy_free: {
    icon: "🥛",
    color: "bg-blue-500/10 text-blue-600 border-blue-200",
  },
  nut_free: {
    icon: "🥜",
    color: "bg-orange-500/10 text-orange-600 border-orange-200",
  },
  halal: { icon: "☪️", color: "bg-teal-500/10 text-teal-600 border-teal-200" },
  kosher: {
    icon: "✡️",
    color: "bg-indigo-500/10 text-indigo-600 border-indigo-200",
  },
  none: { icon: "✅", color: "bg-gray-500/10 text-gray-600 border-gray-200" },
};

// Map cuisines to icons
const CUISINE_ICONS: Record<string, string> = {
  italian: "🍝",
  mexican: "🌮",
  japanese: "🍣",
  chinese: "🥢",
  indian: "🍛",
  thai: "🍜",
  american: "🍔",
  mediterranean: "🥙",
  french: "🥐",
  korean: "🍲",
};

export default function FoodDashboardPage() {
  const router = useRouter();
  const { getVaultKey, isVaultUnlocked } = useVault();
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    // Redirect if vault not unlocked
    if (!isVaultUnlocked) {
      router.push("/login?redirect=/dashboard/food");
      return;
    }
    loadDashboard();
  }, [isVaultUnlocked]);

  async function loadDashboard() {
    try {
      // Use platform-aware session storage
      const userId =
        localStorage.getItem("user_id") || getSessionItem("user_id");
      const vaultKey = getVaultKey(); // Use vault context instead of sessionStorage

      if (!userId || !vaultKey) {
        router.push("/login");
        return;
      }

      // Get session token from platform-aware storage
      const sessionToken = getSessionItem("session_token");
      if (process.env.NODE_ENV === "development") {
        console.log(
          `🔍 [FoodDashboard] Loading preferences. UserId: ${userId}, SessionToken: ${
            sessionToken ? "Present" : "Missing"
          }`
        );
      }

      // Use ApiService for platform-aware API calls
      const response = await ApiService.getFoodPreferences(
        userId,
        sessionToken || undefined
      );

      if (!response.ok) {
        if (response.status === 404) {
          setLoading(false);
          return;
        }
        throw new Error("Failed to load preferences");
      }

      const { preferences: encryptedPrefs } = await response.json();

      // Decrypt client-side
      const dietaryDecrypted = await decryptData(
        encryptedPrefs.dietary_restrictions,
        vaultKey
      );
      const cuisineDecrypted = await decryptData(
        encryptedPrefs.cuisine_preferences,
        vaultKey
      );
      const budgetDecrypted = await decryptData(
        encryptedPrefs.monthly_food_budget,
        vaultKey
      );

      const prefs: UserPreferences = {
        dietary: JSON.parse(dietaryDecrypted),
        cuisines: JSON.parse(cuisineDecrypted),
        budget: JSON.parse(budgetDecrypted),
      };

      setPreferences(prefs);

      setLoading(false);
    } catch (error: unknown) {
      console.error("Error loading dashboard:", error);
      setError(error instanceof Error ? error.message : "Unknown error");
      setLoading(false);
    }
  }

  // Loading State
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="space-y-4 text-center">
          <div className="relative">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-orange-400 to-red-500 mx-auto flex items-center justify-center">
              <Utensils className="h-8 w-8 text-white" />
            </div>
            <RefreshCw className="h-5 w-5 animate-spin absolute -bottom-1 -right-1 text-orange-600 bg-white rounded-full p-0.5" />
          </div>
          <p className="text-muted-foreground">Unlocking your preferences...</p>
        </div>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md" variant="none" effect="glass">
          <CardContent className="p-8 text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-red-100 mx-auto flex items-center justify-center">
              <span className="text-3xl">😕</span>
            </div>
            <p className="text-destructive font-medium">{error}</p>
            <Button onClick={() => router.push("/login")} variant="gradient">
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Empty State
  if (!preferences) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-lg" variant="none" effect="glass">
          <CardContent className="p-10 text-center space-y-6">
            <div className="h-24 w-24 rounded-full bg-gradient-to-br from-orange-400 to-red-500 mx-auto flex items-center justify-center shadow-lg">
              <Utensils className="h-12 w-12 text-white" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold">No Food Preferences Yet</h1>
              <p className="text-muted-foreground">
                Set up your dietary preferences, favorite cuisines, and budget
                to get personalized restaurant recommendations.
              </p>
            </div>
            <Button
              onClick={() => router.push("/dashboard")}
              variant="gradient"
              effect="glass"
              size="lg"
              showRipple
              className="bg-gradient-to-r from-orange-500 to-red-500"
            >
              <Utensils className="h-4 w-4 mr-2" />
              Set Up Food Preferences
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calculate budget usage (assuming 60 meals per month)
  const perMealBudget = preferences.budget / 60;
  const budgetPercentage = Math.min((preferences.budget / 1000) * 100, 100);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shadow-lg">
            <Utensils className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Food & Dining</h1>
            <p className="text-sm text-muted-foreground">
              Your personalized preferences
            </p>
          </div>
        </div>
        <Button
          onClick={() => router.push("/dashboard/food/setup")}
          variant="none"
          size="sm"
          className="text-muted-foreground hover:text-foreground"
        >
          <Edit3 className="h-4 w-4 mr-2" />
          Edit Preferences
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Dietary Card */}
        <Card variant="none" effect="glass" className="overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Leaf className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Dietary
                </p>
                <p className="text-lg font-semibold">
                  {preferences.dietary.length || 0} Restrictions
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {preferences.dietary.length > 0 ? (
                preferences.dietary.map((diet) => {
                  const dietKey = diet.toLowerCase();
                  const defaultStyle = {
                    icon: "✅",
                    color: "bg-gray-500/10 text-gray-600 border-gray-200",
                  };
                  const style = DIETARY_STYLES[dietKey] ?? defaultStyle;
                  return (
                    <span
                      key={diet}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${style.color}`}
                    >
                      <span>{style.icon}</span>
                      {diet.replace(/_/g, " ")}
                    </span>
                  );
                })
              ) : (
                <span className="text-sm text-muted-foreground">
                  No restrictions set
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Cuisines Card */}
        <Card variant="none" effect="glass" className="overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <ChefHat className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Cuisines
                </p>
                <p className="text-lg font-semibold">
                  {preferences.cuisines.length} Favorites
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {preferences.cuisines.map((cuisine) => {
                const icon = CUISINE_ICONS[cuisine.toLowerCase()] || "🍽️";
                return (
                  <span
                    key={cuisine}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-purple-500/10 text-purple-600 border border-purple-200"
                  >
                    <span>{icon}</span>
                    {cuisine}
                  </span>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Budget Card */}
        <Card variant="none" effect="glass" className="overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Wallet className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Monthly Budget
                </p>
                <p className="text-lg font-semibold">
                  ${preferences.budget.toFixed(0)}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>~${perMealBudget.toFixed(2)}/meal</span>
                <span>{budgetPercentage.toFixed(0)}% of $1000</span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-500"
                  style={{ width: `${budgetPercentage}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recommendations Section */}

      {/* Security Footer */}
      <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
        <Shield className="h-4 w-4" />
        <span>End-to-end encrypted · Decrypted only in your browser</span>
      </div>
    </div>
  );
}
