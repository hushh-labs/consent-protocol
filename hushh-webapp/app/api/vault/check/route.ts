// app/api/vault/check/route.ts

import { NextRequest, NextResponse } from "next/server";
import { hasVault } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const vaultExists = await hasVault(userId);

    return NextResponse.json({ hasVault: vaultExists });
  } catch (error) {
    console.error("[API] Vault check error:", error);
    return NextResponse.json(
      { error: "Failed to check vault status", hasVault: false },
      { status: 500 }
    );
  }
}
