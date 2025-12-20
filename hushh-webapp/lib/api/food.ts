/**
 * Food API Client
 * ================
 * 
 * Client for interacting with the Food API endpoints.
 */

const API_BASE = process.env.NEXT_PUBLIC_CONSENT_API_URL || "http://localhost:8000";

// ============================================================================
// Types
// ============================================================================

export interface DietaryProfile {
  user_id: string;
  diet_type: string;
  allergies: string[];
  intolerances: string[];
  restrictions: string[];
  medical_conditions: string[];
  calorie_target: number | null;
  macro_targets: {
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g: number;
  } | null;
}

export interface FoodPreferences {
  user_id: string;
  favorite_cuisines: string[];
  disliked_cuisines: string[];
  favorite_ingredients: string[];
  disliked_ingredients: string[];
  spice_tolerance: string;
  portion_preference: string;
  cooking_skill: string;
  meal_timing: {
    breakfast_time: string;
    lunch_time: string;
    dinner_time: string;
    snack_times: string[];
  } | null;
}

export interface DiningEvent {
  event_id: string;
  user_id: string;
  event_type: string;
  date: string;
  meal_type: string;
  restaurant_name: string | null;
  cuisine: string | null;
  items_ordered: Array<{
    name: string;
    category: string;
    price: number;
    rating: number | null;
  }>;
  total_spent: { amount: number; currency: string } | null;
  party_size: number;
  rating: number | null;
  notes: string | null;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get user's dietary profile.
 */
export async function getDietaryProfile(
  userId: string,
  token: string
): Promise<DietaryProfile> {
  const response = await fetch(`${API_BASE}/api/food/profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, token }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to get dietary profile");
  }

  const data = await response.json();
  return data.data;
}

/**
 * Get user's food preferences.
 */
export async function getFoodPreferences(
  userId: string,
  token: string
): Promise<FoodPreferences> {
  const response = await fetch(`${API_BASE}/api/food/preferences`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, token }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to get food preferences");
  }

  const data = await response.json();
  return data.data;
}

/**
 * Get user's dining history.
 */
export async function getDiningHistory(
  userId: string,
  token: string,
  options?: {
    limit?: number;
    meal_type?: string;
    start_date?: string;
  }
): Promise<DiningEvent[]> {
  const response = await fetch(`${API_BASE}/api/food/history`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: userId,
      token,
      ...options,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to get dining history");
  }

  const data = await response.json();
  return data.data;
}
