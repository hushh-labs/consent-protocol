/**
 * Auth Service - Platform-Aware Authentication
 * 
 * Production-grade authentication service that handles:
 * - iOS: Native Google Sign-In via HushhAuth plugin
 * - Web: Firebase signInWithPopup (unchanged behavior)
 * - Credential sync: Native tokens synced with Firebase for consistent UIDs
 * 
 * IMPORTANT: This is the single source of truth for authentication.
 * Components should use this service instead of direct Firebase calls.
 */

import { Capacitor } from "@capacitor/core";
import { 
  GoogleAuthProvider, 
  signInWithCredential, 
  signOut as firebaseSignOut,
  User,
  onAuthStateChanged,
} from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { HushhAuth, type AuthUser } from "@/lib/capacitor";

export interface AuthResult {
  user: User;
  idToken: string;
  accessToken?: string;
}

/**
 * Platform-aware authentication service
 */
export class AuthService {
  
  /**
   * Sign in with Google using the appropriate method for the current platform.
   * 
   * iOS: Uses native HushhAuth plugin → syncs with Firebase
   * Web: Uses Firebase signInWithPopup directly
   * 
   * @returns Firebase User object (consistent on both platforms)
   */
  static async signInWithGoogle(): Promise<AuthResult> {
    if (Capacitor.isNativePlatform()) {
      return this.nativeGoogleSignIn();
    } else {
      return this.webGoogleSignIn();
    }
  }

  /**
   * Native iOS Google Sign-In flow
   * 1. HushhAuth.signIn() presents native Google UI
   * 2. Returns idToken + accessToken
   * 3. Syncs with Firebase using signInWithCredential
   * 
   * Falls back to web auth if native plugin is not available
   */
  private static async nativeGoogleSignIn(): Promise<AuthResult> {
    console.log("🍎 [AuthService] Starting native Google Sign-In");
    
    try {
      // Step 1: Native sign-in
      const result = await HushhAuth.signIn();
      console.log("✅ [AuthService] Native sign-in complete:", result.user.email);
      
      // Step 2: Create Firebase credential from Google tokens
      const credential = GoogleAuthProvider.credential(
        result.idToken,
        result.accessToken
      );
      
      // Step 3: Sign in to Firebase with credential
      // This ensures we get the same Firebase UID on all platforms
      const firebaseResult = await signInWithCredential(auth, credential);
      console.log("✅ [AuthService] Firebase credential sync complete:", firebaseResult.user.uid);
      
      return {
        user: firebaseResult.user,
        idToken: result.idToken,
        accessToken: result.accessToken,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // If native plugin not implemented, fall back to web auth
      if (errorMessage.includes("not implemented") || errorMessage.includes("not available")) {
        console.warn("⚠️ [AuthService] Native plugin not available, falling back to web auth");
        return this.webGoogleSignIn();
      }
      
      console.error("❌ [AuthService] Native sign-in failed:", error);
      throw error;
    }
  }

  /**
   * Web Google Sign-In flow (unchanged from existing behavior)
   * Uses Firebase signInWithPopup directly
   */
  private static async webGoogleSignIn(): Promise<AuthResult> {
    console.log("🌐 [AuthService] Starting web Google Sign-In");
    
    try {
      // Delegate to the web fallback implementation
      const result = await HushhAuth.signIn();
      
      // Get the current Firebase user (signInWithPopup already sets this)
      const user = auth.currentUser;
      if (!user) {
        throw new Error("Firebase user not set after web sign-in");
      }
      
      return {
        user,
        idToken: result.idToken,
        accessToken: result.accessToken,
      };
    } catch (error) {
      console.error("❌ [AuthService] Web sign-in failed:", error);
      throw error;
    }
  }

  /**
   * Sign out from all platforms
   */
  static async signOut(): Promise<void> {
    console.log("🚪 [AuthService] Signing out...");
    
    try {
      // Sign out from native (if on iOS)
      if (Capacitor.isNativePlatform()) {
        await HushhAuth.signOut();
      }
      
      // Sign out from Firebase
      await firebaseSignOut(auth);
      
      console.log("✅ [AuthService] Sign-out complete");
    } catch (error) {
      console.error("❌ [AuthService] Sign-out error:", error);
      throw error;
    }
  }

  /**
   * Get current signed-in user
   */
  static getCurrentUser(): User | null {
    return auth.currentUser;
  }

  /**
   * Check if user is signed in
   */
  static async isSignedIn(): Promise<boolean> {
    // Check Firebase first
    if (auth.currentUser) {
      return true;
    }
    
    // On native, also check Keychain
    if (Capacitor.isNativePlatform()) {
      const result = await HushhAuth.isSignedIn();
      return result.signedIn;
    }
    
    return false;
  }

  /**
   * Get native user info (platform-aware)
   */
  static async getNativeUser(): Promise<AuthUser | null> {
    if (Capacitor.isNativePlatform()) {
      const result = await HushhAuth.getCurrentUser();
      return result.user;
    }
    
    // Map Firebase user to AuthUser format
    const firebaseUser = auth.currentUser;
    if (firebaseUser) {
      return {
        id: firebaseUser.uid,
        email: firebaseUser.email || "",
        displayName: firebaseUser.displayName || "",
        photoUrl: firebaseUser.photoURL || "",
        emailVerified: firebaseUser.emailVerified,
      };
    }
    
    return null;
  }

  /**
   * Get ID token (for API calls)
   */
  static async getIdToken(): Promise<string | null> {
    // Firebase token takes precedence (it's refreshed automatically)
    const firebaseUser = auth.currentUser;
    if (firebaseUser) {
      try {
        return await firebaseUser.getIdToken();
      } catch {
        console.warn("[AuthService] Failed to get Firebase ID token");
      }
    }
    
    // Fallback to native token on iOS
    if (Capacitor.isNativePlatform()) {
      const result = await HushhAuth.getIdToken();
      return result.idToken;
    }
    
    return null;
  }

  /**
   * Subscribe to auth state changes
   */
  static onAuthStateChanged(callback: (user: User | null) => void): () => void {
    return onAuthStateChanged(auth, callback);
  }
}
