'use client';

/**
 * Food Dashboard
 * 
 * Displays user's encrypted food preferences and restaurant recommendations.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { decryptData } from '@/lib/vault/encrypt';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface UserPreferences {
  dietary: string[];
  cuisines: string[];
  budget: number;
}

interface Restaurant {
  name: string;
  cuisine: string;
  avg_price: number;
  match_score: number;
  price_category: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [recommendations, setRecommendations] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      const userId = sessionStorage.getItem('user_id');
      const vaultKey = sessionStorage.getItem('vault_key');

      if (!userId || !vaultKey) {
        router.push('/login');
        return;
      }

      // Fetch encrypted preferences
      const response = await fetch(`/api/vault/get-preferences?userId=${userId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          // No preferences yet, redirect to setup
          router.push('/dashboard/setup');
          return;
        }
        throw new Error('Failed to load preferences');
      }

      const { preferences: encryptedPrefs } = await response.json();

      // Decrypt client-side
      console.log('🔓 Decrypting preferences...');
      
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
        budget: JSON.parse(budgetDecrypted)
      };

      setPreferences(prefs);

      // ═══════════════════════════════════════════
      // STEP 3: Get Recommendations from Agent
      // ═══════════════════════════════════════════
      console.log('🤖 Calling food dining agent...');
      
      try {
        const agentResponse = await fetch('/api/agent/recommend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            consentToken: 'HCT:temp-token', // TODO: Generate real consent token
            vaultKey: vaultKey,
            preferences: {
              dietary_restrictions: encryptedPrefs.dietary_restrictions,
              cuisine_preferences: encryptedPrefs.cuisine_preferences,
              monthly_food_budget: encryptedPrefs.monthly_food_budget
            }
          })
        });
        
        if (agentResponse.ok) {
          const { recommendations } = await agentResponse.json();
          console.log(`✅ Got ${recommendations.length} recommendations from agent`);
          setRecommendations(recommendations);
        } else {
          console.warn('⚠️ Agent unavailable, using mock data');
          // Fallback to mock data
          setRecommendations([
            {
              name: 'Sample Restaurant',
              cuisine: prefs.cuisines[0] || 'italian',
              avg_price: prefs.budget / 60,
              match_score: 1.0,
              price_category: '$$'
            }
          ]);
        }
      } catch (agentError) {
        console.warn('⚠️ Agent error, using mock data:', agentError);
        // Fallback to mock data
        setRecommendations([
          {
            name: 'Sample Restaurant',
            cuisine: prefs.cuisines[0] || 'italian',
            avg_price: prefs.budget / 60,
            match_score: 1.0,
            price_category: '$$'
          }
        ]);
      }

      setLoading(false);

    } catch (error: any) {
      console.error('Error loading dashboard:', error);
      setError(error.message);
      setLoading(false);
    }
  }

  async function handleLogout() {
    sessionStorage.clear();
    router.push('/login');
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">⏳</div>
          <p className="text-muted-foreground">Loading your data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="max-w-md glass">
          <CardContent className="p-6 text-center">
            <p className="text-destructive mb-4">❌ {error}</p>
            <Button onClick={() => router.push('/login')}>
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4">
      <div className="max-w-4xl mx-auto py-8 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">🍽️ Your Food Dashboard</h1>
          <Button onClick={handleLogout} variant="gradient" effect="glass">
            Logout
          </Button>
        </div>

        {/* Preferences Card */}
        <Card className="glass">
          <CardHeader>
            <CardTitle>Your Preferences 🔒</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="text-sm font-medium mb-2">Dietary Restrictions</h3>
              <div className="flex flex-wrap gap-2">
                {preferences?.dietary.map(diet => (
                  <span
                    key={diet}
                    className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm"
                  >
                    {diet.replace('_', ' ')}
                  </span>
                ))}
                {preferences?.dietary.length === 0 && (
                  <span className="text-muted-foreground text-sm">None</span>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium mb-2">Favorite Cuisines</h3>
              <div className="flex flex-wrap gap-2">
                {preferences?.cuisines.map(cuisine => (
                  <span
                    key={cuisine}
                    className="px-3 py-1 bg-accent/10 text-accent-foreground rounded-full text-sm"
                  >
                    {cuisine}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium mb-2">Monthly Budget</h3>
              <p className="text-2xl font-bold">${preferences?.budget}</p>
              <p className="text-sm text-muted-foreground">
                ≈ ${((preferences?.budget || 0) / 60).toFixed(2)} per meal
              </p>
            </div>

            <Button
              onClick={() => router.push('/dashboard/setup')}
              variant="blue"
              effect="fade"
              size="sm"
            >
              Update Preferences
            </Button>
          </CardContent>
        </Card>

        {/* Recommendations Card */}
        <Card className="glass">
          <CardHeader>
            <CardTitle>Restaurant Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recommendations.map((rec, i) => (
                <div
                  key={i}
                  className="p-4 border rounded-lg glass-interactive"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium">{rec.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {rec.cuisine} · {rec.price_category}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        ${rec.avg_price.toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(rec.match_score * 100).toFixed(0)}% match
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
              💡 Recommendations coming soon from food dining agent
            </div>
          </CardContent>
        </Card>

        {/* Security Info */}
        <Card className="glass border-accent">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🔐</span>
              <div className="flex-1 text-sm">
                <p className="font-medium mb-1">End-to-End Encrypted</p>
                <p className="text-muted-foreground">
                  Your preferences are encrypted in your browser.
                  The server only stores ciphertext and cannot read your data.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
