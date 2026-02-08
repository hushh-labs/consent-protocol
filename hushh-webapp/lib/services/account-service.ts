// hushh-webapp/lib/services/account-service.ts
import { Capacitor } from "@capacitor/core";
import { HushhAccount } from "@/lib/capacitor";
import { apiJson } from "./api-client";

export class AccountServiceImpl {
  /**
   * Delete the user's account and all data.
   * Requires VAULT_OWNER token (Unlock to Delete).
   * 
   * SECURITY: Token must be passed explicitly from useVault() hook.
   * Never reads from sessionStorage (XSS protection).
   * 
   * @param vaultOwnerToken - The VAULT_OWNER consent token (REQUIRED)
   */
  async deleteAccount(vaultOwnerToken: string): Promise<{ success: boolean; message?: string }> {
    if (!vaultOwnerToken) {
      throw new Error("VAULT_OWNER token required - vault must be unlocked");
    }
    
    console.log("[AccountService] Deleting account with token:", vaultOwnerToken.substring(0, 30) + "...");

    try {
      if (Capacitor.isNativePlatform()) {
        // Native: Call Capacitor plugin directly to Python backend
        const result = await HushhAccount.deleteAccount({
             authToken: vaultOwnerToken,
             backendUrl: process.env.NEXT_PUBLIC_BACKEND_URL
        });
        return result;
      } else {
        // Web: Call Next.js proxy
        const result = await apiJson<{ success: boolean; message?: string }>(
          "/api/account/delete",
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${vaultOwnerToken}`,
            },
          }
        );
        return result;
      }
    } catch (error) {
      console.error("Account deletion failed:", error);
      throw error;
    }
  }

  /**
   * Export user data.
   */
  async exportData(): Promise<any> {
    // TODO: Implement export
    return {};
  }
}

export const AccountService = new AccountServiceImpl();
