import { Capacitor } from "@capacitor/core";
import { HushhVault, HushhAuth, HushhConsent } from "@/lib/capacitor";
import { AuthService } from "@/lib/services/auth-service";
import { CacheService, CACHE_KEYS, CACHE_TTL } from "@/lib/services/cache-service";
import {
  createVaultWithPassphrase as webCreateVault,
  unlockVaultWithPassphrase as webUnlockVault,
  unlockVaultWithRecoveryKey as webUnlockRecall,
} from "@/lib/vault/passphrase-key";
import { auth } from "@/lib/firebase/config";
import { apiJson } from "@/lib/services/api-client";

// Web must call same-origin Next.js API routes (/api/*) to avoid CORS issues when
// accessed via different Cloud Run hostnames. (Native uses plugins / backend URL.)

export interface VaultData {
  encryptedVaultKey: string;
  salt: string;
  iv: string;
  recoveryEncryptedVaultKey: string;
  recoverySalt: string;
  recoveryIv: string;
}

export class VaultService {
  private static shouldDebugVaultOwner(): boolean {
    // Keep this very cheap and safe in production: only logs when explicitly enabled.
    try {
      if (typeof window !== "undefined") {
        return (
          window.localStorage.getItem("debug_vault_owner") === "true" ||
          window.sessionStorage.getItem("debug_vault_owner") === "true"
        );
      }
    } catch {
      // ignore
    }
    return false;
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private static async debugAuthSnapshot(): Promise<Record<string, unknown>> {
    if (!Capacitor.isNativePlatform()) {
      return {
        platform: "web",
        firebaseJsCurrentUser: !!auth.currentUser,
        firebaseJsUid: auth.currentUser?.uid || null,
      };
    }

    try {
      const [{ signedIn }, { user }, { idToken }] = await Promise.all([
        HushhAuth.isSignedIn().catch(() => ({ signedIn: false })),
        HushhAuth.getCurrentUser().catch(() => ({ user: null })),
        HushhAuth.getIdToken().catch(() => ({ idToken: null })),
      ]);

      return {
        platform: "native",
        hushhAuthSignedIn: signedIn,
        hushhAuthUserId: user?.id || null,
        hushhAuthUserEmail: user?.email || null,
        hushhAuthIdTokenLen: idToken ? idToken.length : 0,
        firebaseJsCurrentUser: !!auth.currentUser,
        firebaseJsUid: auth.currentUser?.uid || null,
        envBackendUrl: process.env.NEXT_PUBLIC_BACKEND_URL || null,
      };
    } catch (e: any) {
      return {
        platform: "native",
        debugError: e?.message || String(e),
        envBackendUrl: process.env.NEXT_PUBLIC_BACKEND_URL || null,
      };
    }
  }

  /**
   * Get or issue VAULT_OWNER consent token (unified path for all native features).
   *
   * This is the single canonical function used by all native features (Kai, Identity, Food, etc.).
   * It checks for a valid cached token first, then issues a new one if needed.
   *
   * @param userId - Firebase user ID
   * @param currentToken - Current token from VaultContext (if available)
   * @param currentExpiresAt - Current token expiry timestamp (if available)
   * @returns Token + expiry + scope
   */
  static async getOrIssueVaultOwnerToken(
    userId: string,
    currentToken: string | null = null,
    currentExpiresAt: number | null = null
  ): Promise<{
    token: string;
    expiresAt: number;
    scope: string;
  }> {
    // Check if we have a valid cached token
    if (currentToken && currentExpiresAt) {
      const now = Date.now();
      const bufferMs = 5 * 60 * 1000; // 5 minute buffer before expiry
      if (now < currentExpiresAt - bufferMs) {
        console.log(
          "[VaultService] Reusing valid VAULT_OWNER token (expires in",
          Math.round((currentExpiresAt - now) / 1000 / 60),
          "minutes)"
        );
        return {
          token: currentToken,
          expiresAt: currentExpiresAt,
          scope: "VAULT_OWNER",
        };
      }
      console.log(
        "[VaultService] Cached token expired or expiring soon, issuing new one"
      );
    }

    // Issue new token
    console.log("[VaultService] Issuing new VAULT_OWNER token");

    // Phase A instrumentation: capture auth snapshot for debugging.
    if (this.shouldDebugVaultOwner()) {
      console.log(
        "[VaultService] VAULT_OWNER debug snapshot (before token acquisition):",
        await this.debugAuthSnapshot()
      );
    }

    // Phase B: deterministic token acquisition (native-first + fallback + single retry)
    const tryGetFirebaseIdToken = async (): Promise<string | undefined> => {
      // 1) Native-first: HushhAuth plugin
      const hushh = await HushhAuth.getIdToken().catch(() => ({ idToken: null }));
      if (hushh?.idToken) return hushh.idToken;

      // 2) Fallback: AuthService (may use @capacitor-firebase/authentication)
      const fallback = await AuthService.getIdToken().catch(() => null);
      if (fallback) return fallback;

      // 3) Web fallback (should not happen on native, but safe)
      return await this.getFirebaseToken();
    };

    let firebaseIdToken = await tryGetFirebaseIdToken();
    if (!firebaseIdToken) {
      // Small delay to mitigate race right after sign-in / app resume.
      await this.sleep(400);
      firebaseIdToken = await tryGetFirebaseIdToken();
    }

    if (!firebaseIdToken) {
      const snapshot = this.shouldDebugVaultOwner()
        ? await this.debugAuthSnapshot()
        : undefined;
      const hint = snapshot
        ? ` Debug: ${JSON.stringify(snapshot)}`
        : " Enable debug by setting localStorage.debug_vault_owner=true";
      throw new Error(
        `No Firebase ID token available (native).${hint}`
      );
    }

    return this.issueVaultOwnerToken(userId, firebaseIdToken);
  }

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
      return apiJson("/api/consent/vault-owner-token", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${firebaseIdToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId }),
      });
    }
  }

  /**
   * Check if a vault exists for the given user
   * Cached per session to avoid repeated API calls across page navigations.
   * iOS: Uses HushhVault native plugin
   * Web: Calls /api/vault/check
   */
  static async checkVault(userId: string): Promise<boolean> {
    const cache = CacheService.getInstance();
    const cacheKey = CACHE_KEYS.VAULT_CHECK(userId);
    const cached = cache.get<boolean>(cacheKey);
    if (cached !== null && cached !== undefined) {
      return cached;
    }

    console.log("🔐 [VaultService] checkVault called for:", userId);

    let hasVault: boolean;

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
        hasVault = result.exists;
      } catch (error) {
        console.error("❌ [VaultService] Native hasVault error:", error);
        throw error;
      }
    } else {
      // Web: use API route with Firebase auth
      console.log("🌐 [VaultService] Using API for checkVault");
      const url = this.getApiUrl(`/api/vault/check?userId=${userId}`);

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
      hasVault = data.hasVault;
    }

    cache.set(cacheKey, hasVault, CACHE_TTL.SESSION);
    return hasVault;
  }

  /**
   * Set vault check cache to true (call after create or unlock so subsequent checks skip API).
   */
  static setVaultCheckCache(userId: string, exists: boolean): void {
    CacheService.getInstance().set(
      CACHE_KEYS.VAULT_CHECK(userId),
      exists,
      CACHE_TTL.SESSION
    );
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
    // Always same-origin for web; native branches return early via plugins.
    return path;
  }
}
