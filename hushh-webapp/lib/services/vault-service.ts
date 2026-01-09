import { Capacitor } from "@capacitor/core";
import { HushhVault, HushhAuth, HushhConsent } from "@/lib/capacitor";
import {
  createVaultWithPassphrase as webCreateVault,
  unlockVaultWithPassphrase as webUnlockVault,
  unlockVaultWithRecoveryKey as webUnlockRecall,
} from "@/lib/vault/passphrase-key";
import { auth } from "@/lib/firebase/config";

// API URL for Web to talk to Next.js Backend
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
   * Issue VAULT_OWNER consent token for authenticated user.
   *
   * Called after successful vault unlock (passphrase verification).
   *
   * Platform routing:
   * - Web: → /api/consent/vault-owner-token → backend
   * - iOS/Android: → HushhConsent plugin → backend
   */
  static async issueVaultOwnerToken(
    userId: string,
    firebaseIdToken: string
  ): Promise<{
    token: string;
    expiresAt: number;
    scope: string;
  }> {
    if (Capacitor.isNativePlatform()) {
      // iOS/Android: Use native plugin
      console.log("[VaultService] Using native plugin for VAULT_OWNER token");
      return HushhConsent.issueVaultOwnerToken({
        userId,
        authToken: firebaseIdToken,
      });
    } else {
      // Web: Call Next.js API route
      console.log("[VaultService] Using web API for VAULT_OWNER token");
      const response = await fetch("/api/consent/vault-owner-token", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${firebaseIdToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to issue VAULT_OWNER token");
      }

      return response.json();
    }
  }

  /**
   * Check if a vault exists for the given user
   * iOS: Uses HushhVault native plugin
   * Web: Calls /api/vault/check
   */
  static async checkVault(userId: string): Promise<boolean> {
    console.log("🔐 [VaultService] checkVault called for:", userId);

    if (Capacitor.isNativePlatform()) {
      console.log("🔐 [VaultService] Using native plugin for checkVault");
      try {
        const authToken = await this.getFirebaseToken();
        console.log(
          "🔐 [VaultService] Got auth token:",
          authToken ? "yes" : "no"
        );
        const result = await HushhVault.hasVault({ userId, authToken });
        console.log("🔐 [VaultService] hasVault result:", result);
        return result.exists;
      } catch (error) {
        console.error("❌ [VaultService] Native hasVault error:", error);
        throw error;
      }
    }

    // Web: use API route with Firebase auth
    console.log("🌐 [VaultService] Using API for checkVault");
    const url = this.getApiUrl(`/api/vault/check?userId=${userId}`);

    // Get Firebase token for authentication (required in production)
    const authToken = await this.getFirebaseToken();
    const headers: HeadersInit = {};
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const response = await fetch(url, { headers });
    if (!response.ok) {
      console.error("❌ [VaultService] checkVault failed:", response.status);
      throw new Error("Vault check failed");
    }
    const data = await response.json();
    return data.hasVault;
  }

  /**
   * Get encrypted vault data
   * iOS: Uses HushhVault native plugin
   * Web: Calls /api/vault/get
   */
  static async getVault(userId: string): Promise<VaultData> {
    console.log("🔐 [VaultService] getVault called for:", userId);

    if (Capacitor.isNativePlatform()) {
      console.log("🔐 [VaultService] Using native plugin for getVault");
      try {
        console.log("🔐 [VaultService] Requesting Firebase ID Token...");
        const authToken = await this.getFirebaseToken();
        console.log(
          "🔐 [VaultService] Firebase ID Token received. Calling HushhVault.getVault..."
        );
        const result = await HushhVault.getVault({ userId, authToken });
        console.log("🔐 [VaultService] HushhVault.getVault returned success.");
        return {
          encryptedVaultKey: result.encryptedVaultKey,
          salt: result.salt,
          iv: result.iv,
          recoveryEncryptedVaultKey: result.recoveryEncryptedVaultKey,
          recoverySalt: result.recoverySalt,
          recoveryIv: result.recoveryIv,
        };
      } catch (error) {
        console.error("❌ [VaultService] Native getVault error:", error);
        throw error;
      }
    }

    // Web: use API route with Firebase auth
    console.log("🌐 [VaultService] Using API for getVault");
    const url = this.getApiUrl(`/api/vault/get?userId=${userId}`);

    // Get Firebase token for authentication (required in production)
    const authToken = await this.getFirebaseToken();
    const headers: HeadersInit = {};
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const response = await fetch(url, { headers });
    if (!response.ok) {
      console.error("❌ [VaultService] getVault failed:", response.status);
      throw new Error("Failed to get vault");
    }
    return await response.json();
  }

  /**
   * Save vault data to backend
   * iOS: Uses HushhVault native plugin
   * Web: Calls /api/vault/setup
   */
  static async setupVault(
    userId: string,
    vaultData: VaultData & { authMethod: string }
  ): Promise<void> {
    console.log("🔐 [VaultService] setupVault called for:", userId);

    if (Capacitor.isNativePlatform()) {
      console.log("🔐 [VaultService] Using native plugin for setupVault");
      try {
        const authToken = await this.getFirebaseToken();
        await HushhVault.setupVault({
          userId,
          authMethod: vaultData.authMethod,
          encryptedVaultKey: vaultData.encryptedVaultKey,
          salt: vaultData.salt,
          iv: vaultData.iv,
          recoveryEncryptedVaultKey: vaultData.recoveryEncryptedVaultKey,
          recoverySalt: vaultData.recoverySalt,
          recoveryIv: vaultData.recoveryIv,
          authToken,
        });
        console.log("🔐 [VaultService] setupVault completed");
        return;
      } catch (error) {
        console.error("❌ [VaultService] Native setupVault error:", error);
        throw error;
      }
    }

    // Web: use API route
    console.log("🌐 [VaultService] Using API for setupVault");
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
      console.log("🔐 Unlocking via Native HushhVaultPlugin");
      try {
        const derived = await HushhVault.deriveKey({
          passphrase: passphrase,
          salt: salt,
          iterations: 100000,
        });

        const decrypted = await HushhVault.decryptData({
          payload: {
            ciphertext: encryptedKey,
            iv: iv,
            tag: "",
            encoding: "base64",
            algorithm: "aes-256-gcm",
          },
          keyHex: derived.keyHex,
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

  /**
   * Get Firebase ID token for authentication
   */
  private static async getFirebaseToken(): Promise<string | undefined> {
    try {
      if (Capacitor.isNativePlatform()) {
        const result = await HushhAuth.getIdToken();
        return result.idToken || undefined;
      }

      const user = auth.currentUser;
      if (user) {
        return await user.getIdToken();
      }
    } catch (e) {
      console.warn("[VaultService] Failed to get Firebase token:", e);
    }
    return undefined;
  }

  private static getApiUrl(path: string): string {
    if (Capacitor.isNativePlatform()) {
      const base = API_BASE_URL.replace(/\/$/, "");
      const endpoint = path.replace(/^\//, "");
      return `${base}/${endpoint}`;
    }
    return path;
  }
}
