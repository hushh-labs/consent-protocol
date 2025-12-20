/**
 * Firebase Auth Context
 * =====================
 * 
 * React context provider for Firebase authentication state.
 * Provides user state, loading state, and auth methods.
 */

"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
  User,
  signInWithPhoneNumber,
  ConfirmationResult,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from "firebase/auth";
import { auth, getRecaptchaVerifier, resetRecaptcha } from "./config";

// ============================================================================
// Types
// ============================================================================

interface AuthContextType {
  user: User | null;
  loading: boolean;
  phoneNumber: string | null;
  sendOTP: (phoneNumber: string) => Promise<ConfirmationResult>;
  verifyOTP: (otp: string) => Promise<User>;
  signOut: () => Promise<void>;
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
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);

  // Subscribe to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (user?.phoneNumber) {
        setPhoneNumber(user.phoneNumber);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Send OTP to phone number
  const sendOTP = async (phone: string): Promise<ConfirmationResult> => {
    try {
      const recaptchaVerifier = getRecaptchaVerifier("recaptcha-container");
      const result = await signInWithPhoneNumber(auth, phone, recaptchaVerifier);
      setConfirmationResult(result);
      setPhoneNumber(phone);
      return result;
    } catch (error) {
      resetRecaptcha();
      throw error;
    }
  };

  // Verify OTP code
  const verifyOTP = async (otp: string): Promise<User> => {
    if (!confirmationResult) {
      throw new Error("No confirmation result. Send OTP first.");
    }
    
    const credential = await confirmationResult.confirm(otp);
    resetRecaptcha();
    return credential.user;
  };

  // Sign out
  const signOut = async (): Promise<void> => {
    await firebaseSignOut(auth);
    setUser(null);
    setPhoneNumber(null);
    setConfirmationResult(null);
  };

  const value: AuthContextType = {
    user,
    loading,
    phoneNumber,
    sendOTP,
    verifyOTP,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
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
