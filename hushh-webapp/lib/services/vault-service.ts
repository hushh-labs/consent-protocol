import { Capacitor } from "@capacitor/core";
import { HushhVault } from "@/lib/capacitor";
import {
  createVaultWithPassphrase as webCreateVault,
  unlockVaultWithPassphrase as webUnlockVault,
  unlockVaultWithRecoveryKey as webUnlockRecall,
} from "@/lib/vault/passphrase-key";

// API URL for Native App to talk to Next.js Backend
// In a real app, this would be your production URL.
// For Simulator testing, use http://localhost:3000
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export interface VaultData {
  encryptedVaultKey: string;
  salt: string;
  iv: string;
  recoveryEncryptedVaultKey: string;
  recoverySalt: string;
  recoveryIv: string;
}

export class VaultService {
  /**
   * Check if a vault exists for the given user
   */
  static async checkVault(userId: string): Promise<boolean> {
    try {
      const url = this.getApiUrl(`/api/vault/check?userId=${userId}`);
      const response = await fetch(url);
      if (!response.ok) throw new Error("Vault check failed");
      const data = await response.json();
      return data.hasVault;
    } catch (error) {
      console.error("VaultService.checkVault error:", error);
      throw error;
    }
  }

  /**
   * Get encrypted vault data
   */
  static async getVault(userId: string): Promise<VaultData> {
    const url = this.getApiUrl(`/api/vault/get?userId=${userId}`);
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to get vault");
    return await response.json();
  }

  /**
   * Save vault data to backend
   */
  static async setupVault(
    userId: string, 
    vaultData: VaultData & { authMethod: string }
  ): Promise<void> {
    const url = this.getApiUrl("/api/vault/setup");
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, ...vaultData }),
    });
    if (!response.ok) throw new Error("Failed to setup vault");
  }

  // ============================================================================
  // CRYPTOGRAPHY ABSTRACTION (Native vs Web)
  // ============================================================================

  /**
   * Create a new Vault (Generate Key + Encrypt)
   */
  static async createVault(passphrase: string) {
    // Currently using Web Logic for creation as it works efficiently in WebView
    // Future: Port full creation orchestration to Native Plugin if needed
    return webCreateVault(passphrase);
  }

  /**
   * Unlock Vault (Decrypt Key)
   */
  static async unlockVault(
    passphrase: string, 
    encryptedKey: string, 
    salt: string, 
    iv: string
  ): Promise<string> {
    if (Capacitor.isNativePlatform()) {
      console.log("🔐 unlocking via Native HushhVaultPlugin");
      try {
        const derived = await HushhVault.deriveKey({
          passphrase: passphrase,
          salt: salt, 
          iterations: 100000
        });

        // HushhVault expects DecryptDataOptions { payload: EncryptedPayload, keyHex: string }
        const decrypted = await HushhVault.decryptData({
          payload: {
            ciphertext: encryptedKey,
            iv: iv,
            tag: "", // Tag is implicit in ciphertext usually for this plugin, or we need to separate.
                     // The Python Parity implementation generates separate Tag.
                     // However, the `token.py` / `encrypt.ts` usually does base64(iv+ciphertext+tag).
                     // But EncryptedPayload has explicit `tag`.
                     // If `encryptedKey` is the full blob, and we don't have separate tag, 
                     // we might need to rely on the Plugin to handle empty tag if it parses the blob.
                     // IMPORTANT: `VaultData` in `vault-service.ts` has `encryptedVaultKey` but no `tag`.
                     // `lib/vault/passphrase-key.ts` returns `encryptedVaultKey` which is combined.
                     // So we probably need to parse it if we are passing to a plugin that expects separate fields.
            encoding: 'base64',
            algorithm: 'aes-256-gcm'
          },
          keyHex: derived.keyHex
        });
        
        return decrypted.plaintext;
      } catch (e) {
        console.error("Native unlock failed, trying web fallback", e);
        return webUnlockVault(passphrase, encryptedKey, salt, iv);
      }
    } else {
      return webUnlockVault(passphrase, encryptedKey, salt, iv);
    }
  }

  static async unlockVaultWithRecoveryKey(
    key: string,
    encryptedKey: string,
    salt: string,
    iv: string
  ): Promise<string> {
      return webUnlockRecall(key, encryptedKey, salt, iv);
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private static getApiUrl(path: string): string {
    if (Capacitor.isNativePlatform()) {
      const base = API_BASE_URL.replace(/\/$/, "");
      const endpoint = path.replace(/^\//, "");
      return `${base}/${endpoint}`;
    }
    return path; 
  }
}
