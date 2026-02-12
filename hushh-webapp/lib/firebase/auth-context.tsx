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
  useRef,
} from "react";
import { useRouter } from "next/navigation";
import {
  User,
  signInWithPhoneNumber,
  ConfirmationResult,
  onAuthStateChanged,
} from "firebase/auth";
import { auth, getRecaptchaVerifier, resetRecaptcha } from "./config";
import { Capacitor } from "@capacitor/core";
import { AuthService } from "@/lib/services/auth-service";

// Pre-compute platform check to avoid dynamic imports in callbacks
const IS_NATIVE = typeof window !== "undefined" && Capacitor.isNativePlatform();

// ============================================================================
// Types
// ============================================================================

interface AuthContextType {
  user: User | null;
  loading: boolean;
  phoneNumber: string | null;
  // Derived state
  isAuthenticated: boolean;
  userId: string | null;
  // Methods
  sendOTP: (phoneNumber: string) => Promise<ConfirmationResult>;
  verifyOTP: (otp: string) => Promise<User>;
  signOut: () => Promise<void>;
  checkAuth: () => Promise<void>; // Manually trigger auth check (e.g. after native login)
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
  const [userId, setUserId] = useState<string | null>(null);

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
   * Handles both Native Restoration and Web Firebase auth
   *
   * IMPORTANT: This function MUST call setLoading(false) in ALL code paths
   * to prevent VaultLockGuard from getting stuck.
   */
  const checkAuth = useCallback(async () => {
    // 1. Native Session Restoration
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
          setUserId(nativeUser.uid);
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

  // Ref to track current user for null-safety check without causing re-renders
  const userRef = useRef<User | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Initialize on Mount - CRITICAL: Do not depend on `user` to avoid render loops
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      // App State Listener (Background clear)
      if (typeof window !== "undefined" && IS_NATIVE) {
        const { App } = await import("@capacitor/app");

        App.addListener("appStateChange", ({ isActive }) => {
          if (!isActive) {
            console.log(
              "🔒 [AuthProvider] App backgrounded - clearing sensitive data"
            );
            // DEFENSIVE CLEANUP: Remove any legacy vault_key from storage
            // Vault key should be managed by VaultContext (memory-only)
            localStorage.removeItem("vault_key");
            sessionStorage.removeItem("vault_key");

            // Reactive state will handle UI updates (e.g. VaultLockGuard will see locked vault)
            // No need to force reload, which causes loops on some Android devices
          }
        });
      }

      await checkAuth();
    };

    init();

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (!mounted) return;

      // Safety: Don't overwrite a valid User with null if on Native
      // The Firebase JS SDK often fires 'null' on startup or network change in Capacitor apps
      // Use ref to check current user without adding `user` to dependencies
      if (IS_NATIVE) {
        if (!firebaseUser && userRef.current) {
          console.log(
            "🍎 [AuthContext] Ignoring Firebase Null State (Native Mode)"
          );
          return;
        }
      }

      setUser(firebaseUser);
      setUserId(firebaseUser?.uid ?? null);
      if (firebaseUser?.phoneNumber) {
        setPhoneNumber(firebaseUser.phoneNumber);
      }
      // Only stop loading if we actually got a user or valid null (web)
      setLoading(false);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [checkAuth]); // FIXED: Removed `user` from dependencies to prevent render loop

  // Sign out
  const signOut = async (): Promise<void> => {
    try {
      // Delete FCM token before signing out (requires auth)
      const currentUid = user?.uid;
      if (currentUid) {
        try {
          const idToken = await user?.getIdToken();
          const { deleteFCMToken } = await import("@/lib/notifications/fcm-service");
          await deleteFCMToken(currentUid, idToken);
        } catch (fcmErr) {
          console.warn("FCM token cleanup on signOut failed (non-critical):", fcmErr);
        }
      }

      const { AuthService } = await import("@/lib/services/auth-service");
      await AuthService.signOut(); // Handles Native + Firebase

      setUser(null);
      setPhoneNumber(null);
      setConfirmationResult(null);
      setUserId(null);

      // DEFENSIVE CLEANUP: Remove any legacy vault_key from storage
      // Vault key should be managed by VaultContext (memory-only)
      localStorage.removeItem("vault_key");
      localStorage.removeItem("user_id");
      sessionStorage.clear();

      router.push("/");
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
    userId,
    // Methods
    sendOTP,
    verifyOTP,
    signOut,
    checkAuth,
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
