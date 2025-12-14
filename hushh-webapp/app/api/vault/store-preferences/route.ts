// app/api/vault/store-preferences/route.ts

/**
 * Vault Store Preferences API
 * 
 * CONSENT PROTOCOL COMPLIANT:
 * - Requires valid consent token before vault write
 * - Validates token with Python backend
 * - Rejects requests without proper consent
 */

import { NextRequest, NextResponse } from 'next/server';
import { storeUserData } from '@/lib/db';

// Backend URL for token validation
const BACKEND_URL = process.env.FOOD_AGENT_URL || 'http://127.0.0.1:8000';

/**
 * Validate consent token with Python backend
 */
async function validateConsentToken(token: string): Promise<{
  valid: boolean;
  reason?: string;
  user_id?: string;
  agent_id?: string;
  scope?: string;
}> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/validate-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });

    if (!response.ok) {
      return { valid: false, reason: 'Token validation service unavailable' };
    }

    return await response.json();
  } catch (error) {
    console.error('Token validation error:', error);
    return { valid: false, reason: 'Failed to validate token' };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, preferences, consentToken } = body;

    // =========================================================================
    // CONSENT PROTOCOL: Token is REQUIRED for vault write
    // =========================================================================
    if (!consentToken) {
      console.warn('❌ Vault write rejected: No consent token provided');
      return NextResponse.json(
        { 
          error: 'Consent token required for vault write',
          code: 'CONSENT_REQUIRED'
        },
        { status: 403 }
      );
    }

    // Validate the consent token with Python backend
    console.log('🔍 Validating consent token...');
    const validation = await validateConsentToken(consentToken);

    if (!validation.valid) {
      console.warn(`❌ Vault write rejected: ${validation.reason}`);
      return NextResponse.json(
        { 
          error: `Consent validation failed: ${validation.reason}`,
          code: 'CONSENT_INVALID'
        },
        { status: 403 }
      );
    }

    // Additional check: token user must match request user
    if (validation.user_id && validation.user_id !== userId) {
      console.warn(`❌ Vault write rejected: User mismatch (token: ${validation.user_id}, request: ${userId})`);
      return NextResponse.json(
        { 
          error: 'Consent token user mismatch',
          code: 'CONSENT_USER_MISMATCH'
        },
        { status: 403 }
      );
    }

    console.log(`✅ Consent validated: ${validation.agent_id} → ${validation.scope}`);

    // =========================================================================
    // VAULT WRITE: Now authorized
    // =========================================================================
    if (!userId || !preferences) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log(`📦 Storing preferences for user: ${userId}`);
    console.log(`📋 Fields to store: ${Object.keys(preferences).join(', ')}`);

    // Dynamically store each preference field
    const storePromises = [];
    
    for (const [key, value] of Object.entries(preferences)) {
      // Skip if value is null/undefined
      if (!value) continue;
      
      const encrypted = value as { ciphertext: string; iv: string; tag: string };
      
      // Validate encrypted structure
      if (!encrypted.ciphertext || !encrypted.iv || !encrypted.tag) {
        console.warn(`⚠️ Skipping invalid field: ${key}`, encrypted);
        continue;
      }
      
      storePromises.push(
        storeUserData(
          userId,
          key,
          encrypted.ciphertext,
          encrypted.iv,
          encrypted.tag
        )
      );
    }

    await Promise.all(storePromises);

    console.log(`✅ Stored ${storePromises.length} preferences for user: ${userId}`);

    return NextResponse.json({ 
      success: true, 
      fieldsStored: storePromises.length,
      consentVerified: true,
      agent: validation.agent_id
    });

  } catch (error) {
    console.error('Store preferences error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
