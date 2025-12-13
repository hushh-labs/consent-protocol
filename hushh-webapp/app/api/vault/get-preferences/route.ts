// app/api/vault/get-preferences/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getAllUserPreferences } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json(
      { error: 'userId required' },
      { status: 400 }
    );
  }

  const preferences = await getAllUserPreferences(userId);

  if (!preferences) {
    return NextResponse.json(
      { error: 'Preferences not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({ preferences });
}
