"use client";

/**
 * Food Preferences Editor Component
 *
 * Inline editor for food preferences following Kai patterns.
 * Encrypts data client-side before submission.
 */

import { useState } from "react";
import { encryptData } from "@/lib/vault/encrypt";
import { ApiService } from "@/lib/services/api-service";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/lib/morphy-ux/morphy";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const DIETARY_OPTIONS = [
  { value: "vegetarian", label: "🥗 Vegetarian" },
  { value: "vegan", label: "🌱 Vegan" },
  { value: "gluten_free", label: "🌾 Gluten-Free" },
  { value: "dairy_free", label: "🥛 Dairy-Free" },
  { value: "halal", label: "☪️ Halal" },
  { value: "kosher", label: "✡️ Kosher" },
  { value: "keto", label: "🥑 Keto" },
];

const CUISINE_OPTIONS = [
  { value: "italian", label: "🍝 Italian" },
  { value: "japanese", label: "🍣 Japanese" },
  { value: "chinese", label: "🥢 Chinese" },
  { value: "indian", label: "🍛 Indian" },
  { value: "mexican", label: "🌮 Mexican" },
  { value: "thai", label: "🍜 Thai" },
  { value: "american", label: "🍔 American" },
  { value: "mediterranean", label: "🫒 Mediterranean" },
];

interface FoodPreferencesEditorProps {
  initialPreferences?: {
    dietary: string[];
    cuisines: string[];
    budget: number;
  };
  userId: string;
  vaultKey: string;
  vaultOwnerToken: string;
  onSave: () => Promise<void>;
  onCancel: () => void;
}

export function FoodPreferencesEditor({
  initialPreferences,
  userId,
  vaultKey,
  vaultOwnerToken,
  onSave,
  onCancel,
}: FoodPreferencesEditorProps) {
  const [dietary, setDietary] = useState<string[]>(
    initialPreferences?.dietary || []
  );
  const [cuisines, setCuisines] = useState<string[]>(
    initialPreferences?.cuisines || []
  );
  const [budget, setBudget] = useState(
    initialPreferences?.budget?.toString() || "600"
  );
  const [loading, setLoading] = useState(false);

  function toggleDietary(value: string) {
    setDietary((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  }

  function toggleCuisine(value: string) {
    setCuisines((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      if (!userId || !vaultKey || !vaultOwnerToken) {
        throw new Error(
          "Vault locked or session expired. Please unlock vault."
        );
      }

      // Encrypt preferences client-side
      console.log("🔒 Encrypting food preferences...");

      // Prepare encrypted fields (only fields that have data)
      const encryptedFields: Record<string, any> = {};
      
      if (dietary.length > 0) {
        encryptedFields.dietary_restrictions = await encryptData(
          JSON.stringify(dietary),
          vaultKey
        );
      }
      
      if (cuisines.length > 0) {
        encryptedFields.cuisine_preferences = await encryptData(
          JSON.stringify(cuisines),
          vaultKey
        );
      }
      
      if (budget) {
        encryptedFields.monthly_food_budget = await encryptData(
          JSON.stringify(parseFloat(budget)),
          vaultKey
        );
      }

      // Store each field individually (backend expects one field at a time)
      for (const [fieldName, encrypted] of Object.entries(encryptedFields)) {
        const response = await fetch("/api/vault/food", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            fieldName,
            ciphertext: encrypted.ciphertext,
            iv: encrypted.iv,
            tag: encrypted.tag,
            consentToken: vaultOwnerToken,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Failed to save ${fieldName}:`, errorText);
          throw new Error(`Failed to save ${fieldName}`);
        }
      }

      console.log("✅ Food preferences saved to vault");
      toast.success("Food preferences saved securely");

      // Call parent onSave to reload and close editor
      await onSave();
    } catch (error: any) {
      console.error("Error saving food preferences:", error);
      toast.error(error.message || "Failed to save preferences");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card variant="none" effect="glass" className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>🍽️ Edit Food Preferences</CardTitle>
        <CardDescription>
          This data is encrypted locally before storage. Server never sees your
          plaintext preferences.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Dietary Restrictions */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Dietary Restrictions</label>
            <div className="grid grid-cols-2 gap-2">
              {DIETARY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggleDietary(option.value)}
                  disabled={loading}
                  className={`p-3 rounded-lg border text-sm transition-colors disabled:opacity-50 ${
                    dietary.includes(option.value)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card hover:bg-muted border-border"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cuisine Preferences */}
          <div className="space-y-3">
            <label className="text-sm font-medium">
              Favorite Cuisines (select up to 3)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {CUISINE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggleCuisine(option.value)}
                  disabled={
                    loading ||
                    (cuisines.length >= 3 && !cuisines.includes(option.value))
                  }
                  className={`p-3 rounded-lg border text-sm transition-colors disabled:opacity-50 ${
                    cuisines.includes(option.value)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card hover:bg-muted border-border"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Monthly Budget */}
          <div className="space-y-3">
            <label className="text-sm font-medium">
              Monthly Dining Budget ($)
            </label>
            <input
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              min="100"
              max="5000"
              step="50"
              required
              disabled={loading}
              className="w-full p-3 rounded-lg border bg-card disabled:opacity-50"
            />
            <p className="text-xs text-muted-foreground">
              ≈ ${(parseFloat(budget) / 60).toFixed(2)} per meal (assuming 2
              meals/day)
            </p>
          </div>
        </form>
      </CardContent>

      <CardFooter className="flex gap-3 justify-end">
        <Button
          type="button"
          variant="none"
          effect="glass"
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          onClick={handleSubmit}
          disabled={loading}
          variant="gradient"
          effect="glass"
          showRipple
        >
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {loading ? "Saving..." : "Save Preferences 🔒"}
        </Button>
      </CardFooter>
    </Card>
  );
}
