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
      console.log("🍎 [AuthService] Calling HushhAuth.signIn()...");
      const result = await HushhAuth.signIn();
      
      console.log("✅ [AuthService] Native sign-in complete:", result.user?.email);
      
      console.log("✅ [AuthService] Native sign-in complete:", result.user?.email);
      
      // Step 2: Construct user object from verified native Firebase credentials
      // Note: We still construct a JS User object because we bypassed the JS SDK's signInWithCredential
      // but the data now comes from a real native Firebase sign-in.
      console.log("🍎 [AuthService] Constructing user from native Firebase result...");
      
      // Create a minimal user object that satisfies the User interface
      // We use the native user ID as the Firebase UID for vault key consistency
      const mockUser = {
        uid: result.user.id,
        email: result.user.email,
        displayName: result.user.displayName,
        photoURL: result.user.photoUrl,
        emailVerified: result.user.emailVerified ?? true,
        // Required Firebase User properties
        isAnonymous: false,
        metadata: {
          creationTime: new Date().toISOString(),
          lastSignInTime: new Date().toISOString(),
        },
        providerData: [{
          providerId: 'google.com',
          uid: result.user.id,
          displayName: result.user.displayName,
          email: result.user.email,
          phoneNumber: null,
          photoURL: result.user.photoUrl,
        }],
        refreshToken: '',
        tenantId: null,
        // Stub methods (not used in our flow)
        delete: async () => {},
        getIdToken: async () => result.idToken,
        getIdTokenResult: async () => ({ token: result.idToken, claims: {}, authTime: '', issuedAtTime: '', expirationTime: '', signInProvider: 'google.com', signInSecondFactor: null }),
        reload: async () => {},
        toJSON: () => ({}),
        phoneNumber: null,
        providerId: 'google.com',
      } as unknown as User;
      
      console.log("✅ [AuthService] Mock user created with UID:", mockUser.uid);
      
      return {
        user: mockUser,
        idToken: result.idToken,
        accessToken: result.accessToken,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("❌ [AuthService] nativeGoogleSignIn error:", errorMessage);
      
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
   * Web Google Sign-In flow
   * Uses Firebase signInWithPopup directly (for web browsers)
   * This is ALSO the fallback for native if the native plugin fails
   */
  private static async webGoogleSignIn(): Promise<AuthResult> {
    console.log("🌐 [AuthService] Starting web Google Sign-In (Firebase popup)");
    
    try {
      // Import Firebase auth methods for popup sign-in
      const { signInWithPopup } = await import("firebase/auth");
      
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      
      if (!credential) {
        throw new Error("No credential returned from Google Sign-In");
      }
      
      const idToken = await result.user.getIdToken();
      const accessToken = credential.accessToken || "";
      
      console.log("✅ [AuthService] Web sign-in complete:", result.user.email);
      
      return {
        user: result.user,
        idToken,
        accessToken,
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
  /**
   * Restores the session on Native iOS by exchanging the stored Google ID Token
   * for a Firebase Credential. This ensures we have the correct Firebase UID
   * (which differs from the Google Subject ID) for backend vault checks.
   */
  static async restoreNativeSession(): Promise<User | null> {
    if (!Capacitor.isNativePlatform()) return null;

    // Helper: Internal timeout wrapper
    const withTimeout = <T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> => {
      return Promise.race([
        promise,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error(errorMsg)), ms))
      ]);
    };

    try {
      // 1. Check if we have a native user/token stored in Keychain
      // Use getCurrentUser() which verifies the session is valid
      const { user } = await HushhAuth.getCurrentUser();
      const { idToken } = await HushhAuth.getIdToken();
      
      if (!user || !user.id || !idToken || idToken === "null") {
        console.log("🍎 [AuthService] No native session found");
        return null;
      }

      console.log("🍎 [AuthService] Restoring native session for:", user.email);

      // 2. Construct User object from native data
      // We skip signInWithCredential because it hangs in WebView
      const restoredUser = {
        uid: user.id, // This is the Firebase UID from native plugin
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoUrl,
        emailVerified: user.emailVerified,
        isAnonymous: false,
        metadata: {
          creationTime: new Date().toISOString(),
          lastSignInTime: new Date().toISOString(),
        },
        providerData: [{
          providerId: 'google.com',
          uid: user.id,
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoUrl,
        }],
        getIdToken: async () => idToken,
        getIdTokenResult: async () => ({ token: idToken, claims: {}, authTime: '', issuedAtTime: '', expirationTime: '', signInProvider: 'google.com', signInSecondFactor: null }),
        delete: async () => {},
        reload: async () => {},
        toJSON: () => ({}),
        phoneNumber: null,
        providerId: 'google.com',
        refreshToken: '',
        tenantId: null,
      } as unknown as User;
      
      console.log("🍎 [AuthService] Session restored! UID:", restoredUser.uid);
      return restoredUser;

    } catch (error) {
      console.error("🍎 [AuthService] Failed to restore native session:", error);
      // If restoration fails (e.g. revoked token), clear native state
      await HushhAuth.signOut();
      return null;
    }
  }

  static onAuthStateChanged(callback: (user: User | null) => void): () => void {
    return onAuthStateChanged(auth, callback);
  }
}
