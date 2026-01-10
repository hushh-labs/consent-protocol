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
 */

import { Capacitor } from "@capacitor/core";
import {
  HushhIdentity,
  InvestorMatch,
  InvestorProfile,
  IdentityStatusResult,
} from "@/lib/capacitor";
import { auth } from "@/lib/firebase/config";

// Re-export types for consumers
export type { InvestorMatch, InvestorProfile, IdentityStatusResult };

export interface AutoDetectResponse {
  detected: boolean;
  display_name: string | null;
  matches: InvestorMatch[];
}

export class IdentityService {
  /**
   * Auto-detect investor from Firebase displayName.
   *
   * Platform routing:
   * - Web: HushhIdentity → identity-web.ts → Next.js proxy
   * - iOS/Android: HushhIdentity → Native plugin → Backend
   */
  static async autoDetect(): Promise<AutoDetectResponse> {
    const firebaseToken = await this.getFirebaseToken();
    if (!firebaseToken) {
      return { detected: false, display_name: null, matches: [] };
    }

    try {
      // HushhIdentity handles platform routing automatically
      // - Web: calls identity-web.ts (Next.js proxy)
      // - Native: calls HushhIdentityPlugin (direct backend)
      const result = await HushhIdentity.autoDetect({
        authToken: firebaseToken,
      });

      return result;
    } catch (error) {
      console.error("[IdentityService] Auto-detect error:", error);
      return { detected: false, display_name: null, matches: [] };
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
    } catch (error) {
      console.error("[IdentityService] Confirm error:", error);
      return { success: false, message: "Network error" };
    }
  }

  /**
   * Get identity status (has user confirmed an identity?).
   * Requires VAULT_OWNER token.
   */
  static async getIdentityStatus(
    vaultOwnerToken: string
  ): Promise<IdentityStatusResult> {
    try {
      return await HushhIdentity.getIdentityStatus({ vaultOwnerToken });
    } catch (error) {
      console.error("[IdentityService] Status error:", error);
      return {
        has_confirmed_identity: false,
        confirmed_at: null,
        investor_name: null,
        investor_firm: null,
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
    } catch (error) {
      console.error("[IdentityService] Reset error:", error);
      return { success: false };
    }
  }

  /**
   * Get Firebase ID token for authentication.
   */
  private static async getFirebaseToken(): Promise<string | undefined> {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        console.warn("[IdentityService] No current user");
        return undefined;
      }
      return await currentUser.getIdToken(true);
    } catch (error) {
      console.error("[IdentityService] Failed to get Firebase token:", error);
      return undefined;
    }
  }
}
