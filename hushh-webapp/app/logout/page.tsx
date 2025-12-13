/**
 * Logout Page
 * ===========
 * 
 * Handles user logout - signs out from Firebase and redirects to login.
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
        await signOut(auth);
        router.push("/login");
      } catch (error) {
        console.error("Logout failed:", error);
        router.push("/login");
      }
    };

    handleLogout();
  }, [router]);

  return (
    <main className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-4 animate-pulse">👋</div>
        <p className="text-muted-foreground">Logging out...</p>
      </div>
    </main>
  );
}
