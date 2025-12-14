// app/api/vault/food/route.ts

/**
 * Food Domain Vault API
 *
 * GET: Retrieve all food preferences for user
 * POST: Store food preferences (requires consent token)
 */

import { NextRequest, NextResponse } from "next/server";
import { getAllFoodData, storeFoodData } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const data = await getAllFoodData(userId);

  if (!data) {
    return NextResponse.json(
      { error: "No food preferences found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ domain: "food", preferences: data });
}

export async function POST(request: NextRequest) {
  try {
    const { userId, fieldName, ciphertext, iv, tag, consentTokenId } =
      await request.json();

    if (!userId || !fieldName || !ciphertext || !iv || !tag) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    await storeFoodData(userId, fieldName, ciphertext, iv, tag, consentTokenId);

    return NextResponse.json({
      success: true,
      domain: "food",
      field: fieldName,
    });
  } catch (error) {
    console.error("Food vault error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
