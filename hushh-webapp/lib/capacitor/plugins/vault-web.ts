/**
 * HushhVault Web Fallback Implementation
 *
 * This implementation is used when running in a browser (web/cloud mode).
 * It uses the Web Crypto API directly (same as lib/vault/encrypt.ts).
 *
 * NOTE: In native iOS mode, the Swift plugin with SQLCipher is used instead.
 */

import type { WebPlugin } from "@capacitor/core";
import type {
  EncryptDataOptions,
  EncryptedPayload,
  DecryptDataOptions,
  DecryptDataResult,
  StorePreferenceOptions,
  GetPreferencesOptions,
  GetPreferencesResult,
  DeriveKeyOptions,
  DeriveKeyResult,
} from "../types";

export class HushhVaultWeb implements WebPlugin {
  /**
   * Derive key using PBKDF2 - matches consent-protocol key derivation
   *
   * Parameters:
   * - iterations: 100,000 (matches config.py)
   * - hash: SHA-256
   * - keyLength: 256 bits (32 bytes, output as 64-char hex)
   */
  async deriveKey(options: DeriveKeyOptions): Promise<DeriveKeyResult> {
    const iterations = options.iterations || 100000;
    const encoder = new TextEncoder();

    // Generate or use provided salt
    let saltBytes: Uint8Array;
    if (options.salt) {
      saltBytes = new Uint8Array(
        options.salt.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
      );
    } else {
      saltBytes = crypto.getRandomValues(new Uint8Array(16));
    }

    // Import passphrase as key material
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(options.passphrase),
      "PBKDF2",
      false,
      ["deriveBits"]
    );

    // Derive the key
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: saltBytes,
        iterations: iterations,
        hash: "SHA-256",
      },
      keyMaterial,
      256 // 32 bytes
    );

    // Convert to hex string
    const keyHex = Array.from(new Uint8Array(derivedBits))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const saltHex = Array.from(saltBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return {
      keyHex,
      salt: saltHex,
    };
  }

  /**
   * Encrypt data using AES-256-GCM
   *
   * This is equivalent to encryptData() in lib/vault/encrypt.ts
   * Ensures parity between web and native implementations.
   */
  async encryptData(options: EncryptDataOptions): Promise<EncryptedPayload> {
    const keyBytes = new Uint8Array(
      options.keyHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
    );

    const key = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt"]
    );

    // 12-byte IV (96 bits) as per NIST recommendation
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();

    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      encoder.encode(options.plaintext)
    );

    // Web Crypto returns ciphertext + tag concatenated
    // Tag is last 16 bytes (128 bits)
    const ciphertext = new Uint8Array(encrypted.slice(0, -16));
    const tag = new Uint8Array(encrypted.slice(-16));

    return {
      ciphertext: btoa(String.fromCharCode(...ciphertext)),
      iv: btoa(String.fromCharCode(...iv)),
      tag: btoa(String.fromCharCode(...tag)),
      encoding: "base64",
      algorithm: "aes-256-gcm",
    };
  }

  /**
   * Decrypt data using AES-256-GCM
   *
   * This is equivalent to decryptData() in lib/vault/encrypt.ts
   */
  async decryptData(options: DecryptDataOptions): Promise<DecryptDataResult> {
    const keyBytes = new Uint8Array(
      options.keyHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
    );

    const key = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );

    const ciphertext = Uint8Array.from(atob(options.payload.ciphertext), (c) =>
      c.charCodeAt(0)
    );
    const tag = Uint8Array.from(atob(options.payload.tag), (c) =>
      c.charCodeAt(0)
    );
    const iv = Uint8Array.from(atob(options.payload.iv), (c) =>
      c.charCodeAt(0)
    );

    // Concatenate ciphertext + tag for Web Crypto
    const combined = new Uint8Array(ciphertext.length + tag.length);
    combined.set(ciphertext);
    combined.set(tag, ciphertext.length);

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      combined
    );

    const decoder = new TextDecoder();
    return {
      plaintext: decoder.decode(decrypted),
    };
  }

  /**
   * Store preference - in web mode, calls the API route
   */
  async storePreference(options: StorePreferenceOptions): Promise<void> {
    const userId = options.userId;
    const domain = options.domain;

    // Call the appropriate vault API based on domain
    const response = await fetch(`/api/vault/${domain}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        fieldName: options.fieldName,
        ciphertext: options.data.ciphertext,
        iv: options.data.iv,
        tag: options.data.tag,
        consentTokenId: options.consentTokenId,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to store preference: ${error}`);
    }
  }

  /**
   * Get preferences - in web mode, calls the API route
   */
  async getPreferences(
    options: GetPreferencesOptions
  ): Promise<GetPreferencesResult> {
    const response = await fetch(
      `/api/vault/${options.domain}?userId=${options.userId}`
    );

    if (!response.ok) {
      if (response.status === 404) {
        return { preferences: [] };
      }
      throw new Error("Failed to get preferences");
    }

    const data = await response.json();

    // Transform API response to VaultRecord format
    const preferences = (data.preferences || []).map(
      (pref: {
        field_name: string;
        ciphertext: string;
        iv: string;
        tag: string;
        created_at: number;
        updated_at?: number;
        consent_token_id?: string;
      }) => ({
        userId: options.userId,
        domain: options.domain,
        fieldName: pref.field_name,
        data: {
          ciphertext: pref.ciphertext,
          iv: pref.iv,
          tag: pref.tag,
          encoding: "base64" as const,
          algorithm: "aes-256-gcm" as const,
        },
        createdAt: pref.created_at,
        updatedAt: pref.updated_at,
        consentTokenId: pref.consent_token_id,
      })
    );

    return { preferences };
  }

  /**
   * Delete preferences - in web mode, not implemented
   * (cloud mode typically doesn't delete, just revokes consent)
   */
  async deletePreferences(_options: {
    userId: string;
    domain: string;
  }): Promise<void> {
    console.warn("deletePreferences not implemented in web mode");
  }
}
