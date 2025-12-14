// app/api/vault/setup/route.ts

/**
 * Vault Setup API - Passphrase + Recovery Based
 *
 * Stores:
 * - Passphrase-encrypted vault key
 * - Recovery-encrypted vault key (separate copy)
 */

import { NextRequest, NextResponse } from "next/server";
import { storeVaultKey } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      authMethod,
      // Passphrase encrypted
      encryptedVaultKey,
      salt,
      iv,
      // Recovery encrypted
      recoveryEncryptedVaultKey,
      recoverySalt,
      recoveryIv,
    } = body;

    if (
      !userId ||
      !authMethod ||
      !encryptedVaultKey ||
      !salt ||
      !iv ||
      !recoveryEncryptedVaultKey ||
      !recoverySalt ||
      !recoveryIv
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    await storeVaultKey(
      userId,
      authMethod,
      encryptedVaultKey,
      salt,
      iv,
      recoveryEncryptedVaultKey,
      recoverySalt,
      recoveryIv
    );

    console.log(`✅ Vault setup for user: ${userId} (${authMethod})`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Vault setup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
