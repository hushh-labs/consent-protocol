// app/api/vault/store-preferences/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { storeUserData } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, preferences } = body;

    if (!userId || !preferences) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Store each preference separately
    await Promise.all([
      storeUserData(
        userId,
        'dietary_restrictions',
        preferences.dietary_restrictions.ciphertext,
        preferences.dietary_restrictions.iv,
        preferences.dietary_restrictions.tag
      ),
      storeUserData(
        userId,
        'cuisine_preferences',
        preferences.cuisine_preferences.ciphertext,
        preferences.cuisine_preferences.iv,
        preferences.cuisine_preferences.tag
      ),
      storeUserData(
        userId,
        'monthly_food_budget',
        preferences.monthly_food_budget.ciphertext,
        preferences.monthly_food_budget.iv,
        preferences.monthly_food_budget.tag
      )
    ]);

    console.log(`✅ Preferences stored for user: ${userId}`);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Store preferences error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
