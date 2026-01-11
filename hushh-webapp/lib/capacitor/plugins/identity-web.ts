/**
 * HushhIdentityWeb - Web fallback for HushhIdentity plugin
 *
 * Uses Next.js API routes for identity operations on web platform.
 * Native platforms (iOS/Android) use native plugins directly.
 */

import type {
  HushhIdentityPlugin,
  InvestorMatch,
  InvestorProfile,
  IdentityStatusResult,
} from "../index";
import { WebPlugin } from "@capacitor/core";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export class HushhIdentityWeb extends WebPlugin implements HushhIdentityPlugin {
  /**
   * Auto-detect investor from Firebase displayName.
   * Uses Next.js API route proxy.
   */
  async autoDetect(options: { authToken: string }): Promise<{
    detected: boolean;
    display_name: string | null;
    matches: InvestorMatch[];
  }> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/identity/auto-detect`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${options.authToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        console.error(
          "[HushhIdentityWeb] Auto-detect failed:",
          response.status
        );
        return { detected: false, display_name: null, matches: [] };
      }

      return await response.json();
    } catch (error) {
      console.error("[HushhIdentityWeb] Auto-detect error:", error);
      return { detected: false, display_name: null, matches: [] };
    }
  }

  /**
   * Search investor profiles by name.
   * Uses Next.js API route proxy.
   */
  async searchInvestors(options: {
    name: string;
    limit?: number;
  }): Promise<{ investors: InvestorMatch[] }> {
    try {
      const limit = options.limit || 10;
      const response = await fetch(
        `${API_BASE_URL}/api/investors/search?name=${encodeURIComponent(
          options.name
        )}&limit=${limit}`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        }
      );

      if (!response.ok) {
        return { investors: [] };
      }

      const data = await response.json();
      return { investors: data };
    } catch (error) {
      console.error("[HushhIdentityWeb] Search error:", error);
      return { investors: [] };
    }
  }

  /**
   * Get full investor profile by ID.
   * Uses Next.js API route proxy.
   */
  async getInvestor(options: { id: number }): Promise<InvestorProfile> {
    const response = await fetch(
      `${API_BASE_URL}/api/investors/${options.id}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!response.ok) {
      throw new Error(`Investor not found: ${options.id}`);
    }

    return await response.json();
  }

  /**
   * Confirm identity and save encrypted profile to vault.
   * Uses Next.js API route proxy.
   */
  async confirmIdentity(options: {
    investorId: number;
    profileDataCiphertext: string;
    profileDataIv: string;
    profileDataTag: string;
    vaultOwnerToken: string;
  }): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/identity/confirm`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.vaultOwnerToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          investor_id: options.investorId,
          profile_data_ciphertext: options.profileDataCiphertext,
          profile_data_iv: options.profileDataIv,
          profile_data_tag: options.profileDataTag,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, message: data.detail || "Failed to confirm" };
      }

      return data;
    } catch (error) {
      console.error("[HushhIdentityWeb] Confirm error:", error);
      return { success: false, message: "Network error" };
    }
  }

  /**
   * Get identity status (has user confirmed identity?).
   * Uses Next.js API route proxy.
   */
  async getIdentityStatus(options: {
    vaultOwnerToken: string;
  }): Promise<IdentityStatusResult> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/identity/status`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${options.vaultOwnerToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        return {
          has_confirmed_identity: false,
          confirmed_at: null,
          investor_name: null,
          investor_firm: null,
        };
      }

      return await response.json();
    } catch (error) {
      console.error("[HushhIdentityWeb] Status error:", error);
      return {
        has_confirmed_identity: false,
        confirmed_at: null,
        investor_name: null,
        investor_firm: null,
      };
    }
  }

  /**
   * Get encrypted investor profile (ciphertext).
   * Uses Next.js API route proxy.
   */
  async getEncryptedProfile(options: {
    vaultOwnerToken: string;
  }): Promise<{ profile_data: { ciphertext: string; iv: string; tag: string } }> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/identity/profile`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.vaultOwnerToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ consent_token: options.vaultOwnerToken }),
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Profile not found");
        }
        throw new Error(`Failed to get profile: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("[HushhIdentityWeb] Get encrypted profile error:", error);
      throw error;
    }
  }

  /**
   * Reset/delete confirmed identity.
   * Uses Next.js API route proxy.
   */
  async resetIdentity(options: {
    vaultOwnerToken: string;
  }): Promise<{ success: boolean }> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/identity/status`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${options.vaultOwnerToken}`,
          "Content-Type": "application/json",
        },
      });

      return { success: response.ok };
    } catch (error) {
      console.error("[HushhIdentityWeb] Reset error:", error);
      return { success: false };
    }
  }
}
