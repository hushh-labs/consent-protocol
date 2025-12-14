// hooks/use-auth.ts

/**
 * Authentication Hook
 *
 * Provides consistent auth state across all pages.
 * Handles redirect for protected routes.
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase/config";

// Routes that don't require authentication
const PUBLIC_ROUTES = ["/", "/login", "/docs", "/logout", "/privacy"];

interface AuthState {
  user: User | null;
  vaultKey: string | null;
  userId: string | null;
  loading: boolean;
  isAuthenticated: boolean;
}

export function useAuth(): AuthState {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<AuthState>({
    user: null,
    vaultKey: null,
    userId: null,
    loading: true,
    isAuthenticated: false,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const vaultKey =
        localStorage.getItem("vault_key") ||
        sessionStorage.getItem("vault_key");
      const userId =
        localStorage.getItem("user_id") || sessionStorage.getItem("user_id");

      const isAuthenticated = !!user && !!vaultKey;

      setState({
        user,
        vaultKey,
        userId,
        loading: false,
        isAuthenticated,
      });

      // Redirect logic
      const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

      if (!isAuthenticated && !isPublicRoute) {
        // Not authenticated on protected route → go to login
        router.push("/login");
      } else if (isAuthenticated && pathname === "/login") {
        // Authenticated but on login page → go to dashboard
        router.push("/dashboard");
      }
    });

    return () => unsubscribe();
  }, [pathname, router]);

  return state;
}

/**
 * Hook to require authentication on a page
 * Returns loading state while checking auth
 */
export function useRequireAuth() {
  const auth = useAuth();

  // Return loading state for UI to show spinner
  return auth;
}
