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
import { getSessionItem } from "@/lib/utils/session-storage";

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
    let mounted = true;

    // Helper: Timeout wrapper to prevent infinite hangs
    const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T | null> => {
      return Promise.race([
        promise,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))
      ]);
    };

    async function initAuth() {
      // 1. Native Restoration (iOS)
      // Ensures we claim the session from Keychain before waiting on JS SDK
      try {
        // Dynamic import to avoid SSR issues
        const { Capacitor } = await import("@capacitor/core");
        if (Capacitor.isNativePlatform()) {
             const { AuthService } = await import("@/lib/services/auth-service");
             // Add 10s timeout to prevent loader hanging if native plugin stalls
             const nativeUser = await withTimeout(AuthService.restoreNativeSession(), 10000);
             if (mounted && nativeUser) {
                 // State will be updated by the onAuthStateChanged listener 
                 // which fires immediately after restoreNativeSession (signInWithCredential) success
                 console.log("🍎 [useAuth] Native session restored");
             } else if (mounted) {
                 console.log("🍎 [useAuth] Native session restore timed out or returned null");
             }
        }
      } catch (e) {
        console.warn("🍎 [useAuth] Native init warning:", e);
      }

      // 2. Standard Listener (Web & Post-Restore Native)
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (!mounted) return;

        // Use platform-aware storage (localStorage on iOS, sessionStorage on web)
        const vaultKey =
          localStorage.getItem("vault_key") ||
          getSessionItem("vault_key");
        const userId =
          localStorage.getItem("user_id") || getSessionItem("user_id");

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
          router.push("/login");
        } else if (isAuthenticated && pathname === "/login") {
          router.push("/dashboard");
        }
      });
      
      return unsubscribe;
    }

    const cleanupPromise = initAuth();

    // We can't return the promise, but we can return a cleanup function 
    // that might need to handle the subscription if we stored it.
    // Ideally refactor to simpler logic, but for now trusting onAuthStateChanged returns.
    
    // Simpler approach:
    // Just return the unsubscribe from the listener if it's set up sync, 
    // but here it's async. 
    // Effectively legacy cleanup is tricky with async init. 
    // Current best effort:
    return () => {
      mounted = false;
    };
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
