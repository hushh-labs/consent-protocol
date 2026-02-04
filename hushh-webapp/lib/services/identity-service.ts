/**
 * Identity Service - Triflow Platform-Aware Implementation
 *
 * Handles investor identity detection and confirmation with proper
 * platform routing (Web/iOS/Android).
 *
 * Triflow Architecture:
 * - Web: Uses Next.js API routes (identity-web.ts)
 * - iOS/Android: Uses native plugins (HushhIdentityPlugin)
 *
 * Privacy Architecture:
 * - investor_profiles = PUBLIC (SEC filings, read-only)
 * - user_investor_profiles = PRIVATE (E2E encrypted in vault)
 * 
 * Note: All methods return camelCase for React components,
 * transforming from snake_case backend responses.
 */

import { Capacitor } from "@capacitor/core";
import {
  HushhIdentity,
  HushhAuth,
  InvestorMatch,
  InvestorProfile,
} from "@/lib/capacitor";
import { auth } from "@/lib/firebase/config";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";

// Re-export types for consumers
export type { InvestorMatch, InvestorProfile };

// CamelCase types for React components
export interface AutoDetectResponse {
  detected: boolean;
  displayName: string | null;
  matches: InvestorMatch[];
}

export interface IdentityStatusResult {
  hasConfirmedIdentity: boolean;
  confirmedAt: string | null;
  investorName: string | null;
  investorFirm: string | null;
}

export interface EncryptedProfileData {
  profileData: {
    ciphertext: string;
    iv: string;
    tag: string;
  };
}

export class IdentityService {
  /**
   * Auto-detect investor from Firebase displayName.
   *
   * Platform routing:
   * - Web: HushhIdentity → identity-web.ts → Next.js proxy
   * - iOS/Android: HushhIdentity → Native plugin → Backend
   * 
   * Returns camelCase for React components.
   */
  static async autoDetect(): Promise<AutoDetectResponse> {
    const platform = Capacitor.getPlatform();
    const isNative = Capacitor.isNativePlatform();
    
    console.log("[IdentityService] 🔍 autoDetect called");
    console.log("[IdentityService] Platform:", platform, "isNative:", isNative);
    
    const firebaseToken = await this.getFirebaseToken();
    if (!firebaseToken) {
      console.warn("[IdentityService] ❌ No Firebase token available");
      return { detected: false, displayName: null, matches: [] };
    }
    
    console.log("[IdentityService] ✅ Got Firebase token (length:", firebaseToken.length, ")");

    try {
      // HushhIdentity handles platform routing automatically
      // - Web: calls identity-web.ts (Next.js proxy)
      // - Native: calls HushhIdentityPlugin (direct backend)
      console.log("[IdentityService] 📡 Calling HushhIdentity.autoDetect...");
      const result = await HushhIdentity.autoDetect({
        authToken: firebaseToken,
      });

      // Transform snake_case to camelCase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = result as any;
      const transformed: AutoDetectResponse = {
        detected: raw.detected ?? false,
        displayName: raw.display_name ?? raw.displayName ?? null,
        matches: raw.matches || [],
      };

      console.log("[IdentityService] ✅ autoDetect result:", {
        detected: transformed.detected,
        displayName: transformed.displayName,
        matchCount: transformed.matches?.length || 0,
      });
      
      return transformed;
    } catch (error) {
      console.error("[IdentityService] ❌ Auto-detect error:", error);
      return { detected: false, displayName: null, matches: [] };
    }
  }

  /**
   * Search investors by name (public endpoint, no auth required).
   */
  static async searchInvestors(name: string): Promise<InvestorMatch[]> {
    try {
      const result = await HushhIdentity.searchInvestors({ name, limit: 10 });
      return result.investors;
    } catch (error) {
      console.error("[IdentityService] Search error:", error);
      return [];
    }
  }

  /**
   * Get full investor profile by ID (public endpoint).
   */
  static async getInvestorProfile(id: number): Promise<InvestorProfile | null> {
    try {
      return await HushhIdentity.getInvestor({ id });
    } catch (error) {
      console.error("[IdentityService] Get profile error:", error);
      return null;
    }
  }

  /**
   * Confirm identity and encrypt profile to vault.
   * Requires VAULT_OWNER token.
   */
  static async confirmIdentity(
    investorId: number,
    encryptedProfile: {
      ciphertext: string;
      iv: string;
      tag: string;
    },
    vaultOwnerToken: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      return await HushhIdentity.confirmIdentity({
        investorId,
        profileDataCiphertext: encryptedProfile.ciphertext,
        profileDataIv: encryptedProfile.iv,
        profileDataTag: encryptedProfile.tag,
        vaultOwnerToken,
      });
    } catch (error: any) {
      console.error("[IdentityService] Confirm error:", error);
      // Preserve error message for UI layer
      const errorMessage = error?.message || "Network error";
      return { success: false, message: errorMessage };
    }
  }

  /**
   * Get identity status (has user confirmed an identity?).
   * Requires VAULT_OWNER token.
   * 
   * Returns camelCase for React components.
   */
  static async getIdentityStatus(
    vaultOwnerToken: string
  ): Promise<IdentityStatusResult> {
    try {
      const result = await HushhIdentity.getIdentityStatus({ vaultOwnerToken });
      
      // Transform snake_case to camelCase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = result as any;
      return {
        hasConfirmedIdentity: raw.has_confirmed_identity ?? raw.hasConfirmedIdentity ?? false,
        confirmedAt: raw.confirmed_at ?? raw.confirmedAt ?? null,
        investorName: raw.investor_name ?? raw.investorName ?? null,
        investorFirm: raw.investor_firm ?? raw.investorFirm ?? null,
      };
    } catch (error) {
      console.error("[IdentityService] Status error:", error);
      return {
        hasConfirmedIdentity: false,
        confirmedAt: null,
        investorName: null,
        investorFirm: null,
      };
    }
  }

  /**
   * Reset/delete confirmed identity.
   * Requires VAULT_OWNER token.
   */
  static async resetIdentity(
    vaultOwnerToken: string
  ): Promise<{ success: boolean }> {
    try {
      return await HushhIdentity.resetIdentity({ vaultOwnerToken });
    } catch (error: any) {
      console.error("[IdentityService] Reset error:", error);
      // Preserve error message for UI layer
      throw new Error(error?.message || "Failed to reset identity");
    }
  }

  /**
   * Get Firebase ID token for authentication.
   * Works on both web and native platforms.
   */
  private static async getFirebaseToken(): Promise<string | undefined> {
    const isNative = Capacitor.isNativePlatform();
    const platform = Capacitor.getPlatform();
    
    console.log("[IdentityService] 🔑 getFirebaseToken called");
    console.log("[IdentityService] Platform:", platform, "isNative:", isNative);
    
    try {
      // Native platforms: Use HushhAuth plugin first, then @capacitor-firebase/authentication
      if (isNative) {
        // Try HushhAuth plugin first
        try {
          console.log("[IdentityService] Trying HushhAuth.getIdToken...");
          const hushhResult = await HushhAuth.getIdToken();
          if (hushhResult?.idToken) {
            console.log("[IdentityService] ✅ Got token via HushhAuth (length:", hushhResult.idToken.length, ")");
            return hushhResult.idToken;
          }
          console.log("[IdentityService] HushhAuth returned no token");
        } catch (hushhError) {
          console.warn("[IdentityService] HushhAuth.getIdToken failed:", hushhError);
          // Fall through to next method
        }
        
        // Fallback to @capacitor-firebase/authentication
        try {
          console.log("[IdentityService] Trying FirebaseAuthentication.getIdToken...");
          const fbResult = await FirebaseAuthentication.getIdToken();
          if (fbResult?.token) {
            console.log("[IdentityService] ✅ Got token via FirebaseAuthentication (length:", fbResult.token.length, ")");
            return fbResult.token;
          }
          console.log("[IdentityService] FirebaseAuthentication returned no token");
        } catch (fbError) {
          console.warn("[IdentityService] FirebaseAuthentication.getIdToken failed:", fbError);
          // Fall through to web fallback
        }
      }
      
      // Web or native fallback: Use Firebase Web SDK
      console.log("[IdentityService] Trying Firebase Web SDK...");
      const currentUser = auth.currentUser;
      if (!currentUser) {
        console.warn("[IdentityService] ❌ No current user in Firebase Web SDK (native:", isNative, ")");
        return undefined;
      }
      const token = await currentUser.getIdToken(true);
      console.log("[IdentityService] ✅ Got token via Firebase Web SDK (length:", token.length, ")");
      return token;
    } catch (error) {
      console.error("[IdentityService] ❌ Failed to get Firebase token:", error);
      return undefined;
    }
  }
}
