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

export default function LogoutPage() {
  const router = useRouter();

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
          await fetch("/api/auth/session", { method: "DELETE" });
          console.log("🍪 Session cookie cleared");
        } catch (e) {
          console.warn("⚠️ Failed to clear session cookie:", e);
        }

        // Clear session storage
        sessionStorage.clear();

        // Sign out from Firebase
        await signOut(auth);

        console.log("✅ Logged out successfully");
        router.push("/login");
      } catch (error) {
        console.error("Logout failed:", error);
        // Still clear storage and redirect even if Firebase logout fails
        localStorage.clear();
        sessionStorage.clear();
        router.push("/login");
      }
    };

    handleLogout();
  }, [router]);

  return (
    <main className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-4 animate-pulse">👋</div>
        <p className="text-muted-foreground">Securely logging out...</p>
        <p className="text-xs text-muted-foreground mt-2">
          Clearing vault keys...
        </p>
      </div>
    </main>
  );
}
