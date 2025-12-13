// app/api/vault/setup/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { storeVaultKey } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, encryptedVaultKey, salt, iv, authTag } = body;

    if (!userId || !encryptedVaultKey || !salt || !iv || !authTag) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    await storeVaultKey(userId, encryptedVaultKey, salt, iv, authTag);

    console.log(`✅ Vault setup for user: ${userId}`);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Vault setup error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
