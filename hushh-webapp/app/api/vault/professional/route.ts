// app/api/vault/professional/route.ts

/**
 * Professional Domain Vault API
 *
 * GET: Retrieve all professional profile data for user
 * POST: Store professional data (requires consent token)
 */

import { NextRequest, NextResponse } from "next/server";
import { getAllProfessionalData, storeProfessionalData } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const data = await getAllProfessionalData(userId);

  if (!data) {
    return NextResponse.json(
      { error: "No professional data found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ domain: "professional", preferences: data });
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

    await storeProfessionalData(
      userId,
      fieldName,
      ciphertext,
      iv,
      tag,
      consentTokenId
    );

    return NextResponse.json({
      success: true,
      domain: "professional",
      field: fieldName,
    });
  } catch (error) {
    console.error("Professional vault error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
