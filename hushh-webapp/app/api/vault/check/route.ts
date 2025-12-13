// app/api/vault/check/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { hasVault } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json(
      { error: 'userId required' },
      { status: 400 }
    );
  }

  const vaultExists = await hasVault(userId);

  return NextResponse.json({ hasVault: vaultExists });
}
