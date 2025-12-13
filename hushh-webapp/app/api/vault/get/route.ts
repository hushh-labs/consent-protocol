// app/api/vault/get/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getVaultKey } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json(
      { error: 'userId required' },
      { status: 400 }
    );
  }

  const vault = await getVaultKey(userId);

  if (!vault) {
    return NextResponse.json(
      { error: 'Vault not found' },
      { status: 404 }
    );
  }

  return NextResponse.json(vault);
}
