// hooks/use-auth.ts

/**
 * Authentication Hook
 *
 * Provides consistent auth state across all pages.
 * Handles redirect for protected routes.
 * 
 * NATIVE IOS UPDATES:
 * - Manually restores session from HushhAuth plugin
 * - bypasses onAuthStateChanged for native sessions (as JS SDK hangs)
 * - Clears sensitive data (memory, local storage) when app is backgrounded
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

export function useAuth(): AuthState & { signOut: () => Promise<void> } {
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
        const { App } = await import("@capacitor/app");

        // Add App State Listener to clear sensitive data on background
        App.addListener('appStateChange', ({ isActive }) => {
          if (!isActive) {
            console.log("🔒 [useAuth] App backgrounded - clearing sensitive data");
            // Clear Vault Key from memory/storage for security
            localStorage.removeItem("vault_key");
            sessionStorage.removeItem("vault_key");
            
            // Note: We do NOT redirect here, but we force a reload if they return to a sensitive page
            // causing them to hit the auth guard again (which checks for vault_key).
            if (pathname === "/dashboard") {
               window.location.reload(); 
            }
          }
        });

        if (Capacitor.isNativePlatform()) {
             const { AuthService } = await import("@/lib/services/auth-service");
             // Add 10s timeout to prevent loader hanging if native plugin stalls
             const nativeUser = await withTimeout(AuthService.restoreNativeSession(), 10000);
             
             if (mounted && nativeUser) {
                 console.log("🍎 [useAuth] Native session restored:", nativeUser.uid);
                 
                 // CRITICAL: Manually set state because onAuthStateChanged won't fire
                 // since we bypassed the hanging JS signInWithCredential
                 const vaultKey = localStorage.getItem("vault_key");
                 const userId = localStorage.getItem("user_id") || nativeUser.uid;
                 
                 setState({
                   user: nativeUser,
                   vaultKey,
                   userId,
                   loading: false,
                   isAuthenticated: !!nativeUser && !!vaultKey,
                 });
                 
                 // If authenticated, redirect from login to dashboard
                 if ((!!nativeUser && !!vaultKey) && pathname === "/login") {
                    router.push("/dashboard");
                 }
                 // Return early logic? No, we still want to listen to Firebase JS SDK just in case
                 // logic changes later, but we need to prevent it from overwriting our good state with null.
             } else if (mounted) {
                 console.log("🍎 [useAuth] Native session restore timed out or returned null");
             }
        }
      } catch (e) {
        console.warn("🍎 [useAuth] Native init warning:", e);
      }

      // 2. Standard Listener (Web & Post-Restore Native Fallback)
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (!mounted) return;
        
        // Use platform-aware storage (localStorage on iOS, sessionStorage on web)
        const vaultKey =
          localStorage.getItem("vault_key") ||
          getSessionItem("vault_key");
        const userId =
          localStorage.getItem("user_id") || getSessionItem("user_id");

        const isAuthenticated = !!user && !!vaultKey;
        
        // Only update if we didn't already set a Native user
        // Safeguard: If we have a native user in state, but Firebase JS SDK says null, ignore Firebase JS SDK
        // This handles the discrepancy caused by bypassing signInWithCredential
        setState(prev => {
            // Check if we are on native and overwriting a valid user with null
            if (prev.user && !user && typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform()) {
                console.log("🍎 [useAuth] Ignoring JS SDK null state in favor of native session");
                return prev;
            }
            return {
              user,
              vaultKey,
              userId,
              loading: false,
              isAuthenticated,
            };
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

    const initPromise = initAuth();

    return () => {
      mounted = false;
      initPromise.then(unsub => unsub && unsub());
    };
  }, [pathname, router]);

  // Explicit Sign Out method to bypass "Ignore JS SDK null" safeguard
  const signOut = async () => {
     try {
         const { AuthService } = await import("@/lib/services/auth-service");
         await AuthService.signOut(); 
         
         // Force state update to clear user
         setState({
             user: null,
             vaultKey: null,
             userId: null,
             loading: false,
             isAuthenticated: false
         });
         
         // Clear persistence
         localStorage.removeItem("vault_key");
         localStorage.removeItem("user_id");
         sessionStorage.clear();
         
         router.push("/login");
     } catch (e) {
         console.error("Sign out error", e);
     }
  };

  return { ...state, signOut };
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
