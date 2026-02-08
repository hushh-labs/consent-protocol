// hushh-webapp/lib/capacitor/account.ts
import { registerPlugin } from "@capacitor/core";

export interface HushhAccountPlugin {
  deleteAccount(options?: { authToken: string; backendUrl?: string }): Promise<{ success: boolean; message?: string }>;
}

export const HushhAccount = registerPlugin<HushhAccountPlugin>("HushhAccount");
