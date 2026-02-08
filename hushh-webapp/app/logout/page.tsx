/**
 * Logout Page
 * ===========
 *
 * Handles user logout - clears ALL vault data and signs out from Firebase.
 * SECURITY: Must clear localStorage + sessionStorage for vault security.
 */

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { ApiService } from "@/lib/services/api-service";
import { clearSessionStorage } from "@/lib/utils/session-storage";
import { useStepProgress } from "@/lib/progress/step-progress-context";

export default function LogoutPage() {
  const router = useRouter();
  const { registerSteps, completeStep, reset } = useStepProgress();

  // Register 1 step: Logout
  useEffect(() => {
    registerSteps(1);
    return () => reset();
  }, [registerSteps, reset]);

  useEffect(() => {
    const handleLogout = async () => {
      try {
        console.log("🔐 Logging out and clearing all vault data...");

        // CRITICAL: Clear ALL vault-related data from localStorage
        localStorage.removeItem("vault_key");
        localStorage.removeItem("user_id");
        localStorage.removeItem("user_uid");
        localStorage.removeItem("user_email");
        localStorage.removeItem("user_displayName");
        localStorage.removeItem("user_photo");
        localStorage.removeItem("user_emailVerified");
        localStorage.removeItem("user_phoneNumber");
        localStorage.removeItem("user_creationTime");
        localStorage.removeItem("user_lastSignInTime");
        localStorage.removeItem("user_providerData");
        localStorage.removeItem("passkey_credential_id");

        // Clear session cookie via API (httpOnly cookie)
        try {
          await ApiService.deleteSession();
          console.log("🍪 Session cookie cleared");
        } catch (e) {
          console.warn("⚠️ Failed to clear session cookie:", e);
        }

        // Clear session storage (platform-aware)
        await clearSessionStorage();

        // Sign out from Firebase
        await signOut(auth);

        // Step 1: Logout complete
        completeStep();

        console.log("✅ Logged out successfully");
        router.push("/");
      } catch (error) {
        console.error("Logout failed:", error);
        completeStep(); // Complete step on error
        // Still clear storage and redirect even if Firebase logout fails
        localStorage.clear();
        sessionStorage.clear();
        router.push("/");
      }
    };

    handleLogout();
  }, [router, completeStep]);

  // Return null - progress bar shows at top
  return null;
}
