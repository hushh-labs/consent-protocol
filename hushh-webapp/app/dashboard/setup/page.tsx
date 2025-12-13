'use client';

/**
 * Initial Food Preferences Setup
 * 
 * Collects and encrypts user's food preferences on first login.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { encryptData } from '@/lib/vault/encrypt';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

const DIETARY_OPTIONS = [
  { value: 'vegetarian', label: '🥗 Vegetarian' },
  { value: 'vegan', label: '🌱 Vegan' },
  { value: 'gluten_free', label: '🌾 Gluten-Free' },
  { value: 'dairy_free', label: '🥛 Dairy-Free' },
  { value: 'halal', label: '☪️ Halal' },
  { value: 'kosher', label: '✡️ Kosher' },
  { value: 'keto', label: '🥑 Keto' },
];

const CUISINE_OPTIONS = [
  { value: 'italian', label: '🍝 Italian' },
  { value: 'japanese', label: '🍣 Japanese' },
  { value: 'chinese', label: '🥢 Chinese' },
  { value: 'indian', label: '🍛 Indian' },
  { value: 'mexican', label: '🌮 Mexican' },
  { value: 'thai', label: '🍜 Thai' },
  { value: 'american', label: '🍔 American' },
  { value: 'mediterranean', label: '🫒 Mediterranean' },
];

export default function SetupPage() {
  const router = useRouter();
  const [dietary, setDietary] = useState<string[]>([]);
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [budget, setBudget] = useState('600');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const userId = sessionStorage.getItem('user_id');
      const vaultKey = sessionStorage.getItem('vault_key');

      if (!userId || !vaultKey) {
        throw new Error('Session expired. Please log in again.');
      }

      // Encrypt preferences client-side
      console.log('🔒 Encrypting preferences...');
      
      const dietaryEncrypted = await encryptData(
        JSON.stringify(dietary),
        vaultKey
      );

      const cuisineEncrypted = await encryptData(
        JSON.stringify(cuisines),
        vaultKey
      );

      const budgetEncrypted = await encryptData(
        JSON.stringify(parseFloat(budget)),
        vaultKey
      );

      // Store encrypted data
      const response = await fetch('/api/vault/store-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          preferences: {
            dietary_restrictions: dietaryEncrypted,
            cuisine_preferences: cuisineEncrypted,
            monthly_food_budget: budgetEncrypted
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save preferences');
      }

      console.log('✅ Preferences saved');
      
      // Redirect to dashboard
      router.push('/dashboard');

    } catch (error: any) {
      console.error('Error saving preferences:', error);
      alert(error.message);
      setLoading(false);
    }
  }

  function toggleDietary(value: string) {
    setDietary(prev =>
      prev.includes(value)
        ? prev.filter(v => v !== value)
        : [...prev, value]
    );
  }

  function toggleCuisine(value: string) {
    setCuisines(prev =>
      prev.includes(value)
        ? prev.filter(v => v !== value)
        : [...prev, value]
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4">
      <div className="max-w-2xl mx-auto py-8">
        <Card className="glass">
          <CardHeader>
            <CardTitle>🍽️ Your Food Preferences</CardTitle>
            <CardDescription>
              This data is encrypted locally before storage.
              Server never sees your plaintext preferences.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Dietary Restrictions */}
              <div className="space-y-3">
                <label className="text-sm font-medium">
                  Dietary Restrictions
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {DIETARY_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggleDietary(option.value)}
                      className={`p-3 rounded-lg border text-sm transition-colors ${
                        dietary.includes(option.value)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card hover:bg-muted border-border'
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
                  {CUISINE_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggleCuisine(option.value)}
                      disabled={cuisines.length >= 3 && !cuisines.includes(option.value)}
                      className={`p-3 rounded-lg border text-sm transition-colors disabled:opacity-50 ${
                        cuisines.includes(option.value)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card hover:bg-muted border-border'
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
                  className="w-full p-3 rounded-lg border bg-card"
                />
                <p className="text-xs text-muted-foreground">
                  ≈ ${(parseFloat(budget) / 60).toFixed(2)} per meal
                  (assuming 2 meals/day)
                </p>
              </div>

              <Button
                type="submit"
                disabled={loading || cuisines.length === 0}
                className="w-full"
                variant="gradient"
                effect="glass"
                size="lg"
              >
                {loading ? 'Saving...' : 'Save Preferences 🔒'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
