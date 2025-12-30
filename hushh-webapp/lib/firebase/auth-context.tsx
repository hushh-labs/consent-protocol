/**
 * Firebase Auth Context
 * =====================
 *
 * React context provider for Firebase authentication state.
 * Provides user state, loading state, and auth methods.
 *
 * UPDATED FOR NATIVE (Capacitor):
 * - Includes 'vaultKey' and 'isAuthenticated' derived state.
 * - Handles Native Session Restoration on mount.
 * - Exposes 'checkAuth' to manually refreshing state (e.g. after Login).
 * - Clears sensitive data when app is backgrounded.
 */

"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  User,
  signInWithPhoneNumber,
  ConfirmationResult,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from "firebase/auth";
import { auth, getRecaptchaVerifier, resetRecaptcha } from "./config";
import { getSessionItem } from "@/lib/utils/session-storage";
import { Capacitor } from "@capacitor/core";
import { AuthService } from "@/lib/services/auth-service";

// ============================================================================
// Types
// ============================================================================

interface AuthContextType {
  user: User | null;
  loading: boolean;
  phoneNumber: string | null;
  // Derived state
  isAuthenticated: boolean;
  vaultKey: string | null;
  userId: string | null;
  // Methods
  sendOTP: (phoneNumber: string) => Promise<ConfirmationResult>;
  verifyOTP: (otp: string) => Promise<User>;
  signOut: () => Promise<void>;
  checkAuth: () => Promise<void>; // Manually trigger auth check (e.g. after native login)
  setVaultKeyLocal: (key: string | null) => void; // Helper to update vault key state
  setNativeUser: (user: User | null) => void; // Helper to manually set user state
}

// ============================================================================
// Context
// ============================================================================

const AuthContext = createContext<AuthContextType | null>(null);

// ============================================================================
// Provider
// ============================================================================

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmationResult, setConfirmationResult] =
    useState<ConfirmationResult | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);

  // Hushh State
  const [vaultKey, setVaultKey] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const pathname = usePathname();
  const router = useRouter();

  // Helper: Timeout wrapper
  const withTimeout = <T,>(
    promise: Promise<T>,
    ms: number
  ): Promise<T | null> => {
    return Promise.race([
      promise,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
    ]);
  };

  /**
   * Core Auth Check Logic
   * Handles both Native Restoration and Web LocalStorage checks
   *
   * IMPORTANT: This function MUST call setLoading(false) in ALL code paths
   * to prevent VaultLockGuard from getting stuck.
   */
  const checkAuth = useCallback(async () => {
    // 1. Sync State from Storage (Web/Native persistence)
    const storedVaultKey =
      typeof window !== "undefined"
        ? localStorage.getItem("vault_key") ||
        sessionStorage.getItem("vault_key")
        : null;
    const storedUserId =
      typeof window !== "undefined"
        ? localStorage.getItem("user_id") || sessionStorage.getItem("user_id")
        : null;

    setVaultKey(storedVaultKey);
    setUserId(storedUserId);

    // 2. Native Session Restoration
    if (Capacitor.isNativePlatform()) {
      try {
        // Use timeout to avoid hanging
        const nativeUser = await withTimeout(
          AuthService.restoreNativeSession(),
          5000
        );

        if (nativeUser) {
          console.log(
            "🍎 [AuthProvider] Native session restored:",
            nativeUser.uid
          );
          setUser(nativeUser);
        } else {
          console.log("🍎 [AuthProvider] No native session found");
        }
      } catch (e) {
        console.warn("🍎 [AuthProvider] Native restore error/timeout:", e);
        // User will need to log in again
      } finally {
        // ✅ CRITICAL: Always set loading to false after native check
        // This ensures VaultLockGuard can proceed (to login or vault unlock)
        setLoading(false);
      }
      return; // Exit early for native - don't wait for onAuthStateChanged
    }

    // 3. Web Platform: Let onAuthStateChanged handle loading state
    // (It will call setLoading(false) when it fires)
    // But add a safety timeout in case Firebase is slow
    setTimeout(() => {
      setLoading((current) => {
        if (current) {
          console.warn(
            "⚠️ [AuthProvider] Auth check timeout - forcing loading=false"
          );
          return false;
        }
        return current;
      });
    }, 10000); // 10s safety timeout for web
  }, []);

  // Initialize on Mount
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      // App State Listener (Background clear)
      if (typeof window !== "undefined") {
        const { App } = await import("@capacitor/app");

        if (Capacitor.isNativePlatform()) {
          App.addListener("appStateChange", ({ isActive }) => {
            if (!isActive) {
              console.log(
                "🔒 [AuthProvider] App backgrounded - clearing sensitive data"
              );
              setVaultKey(null);
              localStorage.removeItem("vault_key");
              sessionStorage.removeItem("vault_key");

              // Force reload if on dashboard to re-trigger auth guards
              if (window.location.pathname.includes("/dashboard")) {
                window.location.reload();
              }
            }
          });
        }
      }

      await checkAuth();
    };

    init();

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (!mounted) return;

      // Safety: Don't overwrite a valid User with null if on Native
      // The Firebase JS SDK often fires 'null' on startup or network change in Capacitor apps
      if (typeof window !== "undefined") {
        import("@capacitor/core").then(({ Capacitor }) => {
          if (Capacitor.isNativePlatform()) {
            // If we already have a user in state (set by setNativeUser or restoreNativeSession)
            // and Firebase says "null", we must IGNORE it.
            // We only allow overwriting if we explicitly "Signed Out".
            if (!firebaseUser && user) {
              console.log(
                "🍎 [AuthContext] Ignoring Firebase Null State (Native Mode)"
              );
              return;
            }
          }

          setUser(firebaseUser);
          if (firebaseUser?.phoneNumber) {
            setPhoneNumber(firebaseUser.phoneNumber);
          }
          // Only stop loading if we actually got a user or valid null (web)
          setLoading(false);
        });
      } else {
        setUser(firebaseUser);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [checkAuth, user]); // Depend on user to allow safety check

  // Manual Vault Key Setter (for login page)
  const setVaultKeyLocal = (key: string | null) => {
    setVaultKey(key);
    if (key) {
      // Decide persistence based on platform? For now assuming previous logic
      // LoginPage handles actual storage calls. This just updates Context state.
    }
  };

  // Sign out
  const signOut = async (): Promise<void> => {
    try {
      const { AuthService } = await import("@/lib/services/auth-service");
      await AuthService.signOut(); // Handles Native + Firebase

      setUser(null);
      setPhoneNumber(null);
      setConfirmationResult(null);
      setVaultKey(null);
      setUserId(null);

      localStorage.removeItem("vault_key");
      localStorage.removeItem("user_id");
      sessionStorage.clear();

      router.push("/login");
    } catch (e) {
      console.error("Sign out error", e);
    }
  };

  // OTP Stubs (unchanged)
  const sendOTP = async (phone: string): Promise<ConfirmationResult> => {
    // ... same as before
    const recaptchaVerifier = getRecaptchaVerifier("recaptcha-container");
    const result = await signInWithPhoneNumber(auth, phone, recaptchaVerifier);
    setConfirmationResult(result);
    setPhoneNumber(phone);
    return result;
  };

  const verifyOTP = async (otp: string): Promise<User> => {
    if (!confirmationResult) throw new Error("No confirmation result.");
    const credential = await confirmationResult.confirm(otp);
    resetRecaptcha();
    return credential.user;
  };

  const value: AuthContextType = {
    user,
    loading,
    phoneNumber,
    // Derived
    // Unified Auth State: Authenticated = Identity Verified.
    isAuthenticated: !!user,
    vaultKey,
    userId,
    // Methods
    sendOTP,
    verifyOTP,
    signOut,
    checkAuth,
    setVaultKeyLocal,
    setNativeUser: (user: User | null) => {
      console.log("🍎 [AuthContext] Manually setting Native User:", user?.uid);
      setUser(user);
      if (user) {
        setUserId(user.uid);
        setLoading(false);
      }
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ============================================================================
// Hook
// ============================================================================

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
