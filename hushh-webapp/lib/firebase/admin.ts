/**
 * Firebase Admin SDK Configuration
 * =================================
 *
 * Server-side Firebase Admin for:
 * - Verifying ID tokens
 * - Creating session cookies
 * - Managing server-side auth
 *
 * SECURITY: Never import this in client-side code
 */

import * as admin from "firebase-admin";

// Initialize Firebase Admin (only once)
function initializeFirebaseAdmin() {
  if (admin.apps.length > 0) {
    return admin.apps[0]!;
  }

  // Check for service account JSON in environment
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (serviceAccount) {
    // Parse the JSON string from environment variable
    const parsedServiceAccount = JSON.parse(serviceAccount);
    return admin.initializeApp({
      credential: admin.credential.cert(parsedServiceAccount),
    });
  }

  // Fallback: Use application default credentials (for Cloud Run, etc.)
  return admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

// Get or initialize the app
const app = initializeFirebaseAdmin();
const auth = admin.auth(app);

export { admin, auth };

/**
 * Verify a Firebase ID token
 */
export async function verifyIdToken(idToken: string) {
  try {
    const decodedToken = await auth.verifyIdToken(idToken);
    return { valid: true, uid: decodedToken.uid, decodedToken };
  } catch (error) {
    console.error("Token verification failed:", error);
    return { valid: false, uid: null, decodedToken: null };
  }
}

/**
 * Create a session cookie from an ID token
 * @param idToken - Firebase ID token from client
 * @param expiresIn - Cookie expiration in milliseconds (default: 5 days)
 */
export async function createSessionCookie(
  idToken: string,
  expiresIn: number = 5 * 24 * 60 * 60 * 1000 // 5 days
) {
  try {
    const sessionCookie = await auth.createSessionCookie(idToken, {
      expiresIn,
    });
    return { success: true, sessionCookie };
  } catch (error) {
    console.error("Session cookie creation failed:", error);
    return { success: false, sessionCookie: null };
  }
}

/**
 * Verify a session cookie
 */
export async function verifySessionCookie(
  sessionCookie: string,
  checkRevoked = true
) {
  try {
    const decodedClaims = await auth.verifySessionCookie(
      sessionCookie,
      checkRevoked
    );
    return { valid: true, uid: decodedClaims.uid, decodedClaims };
  } catch (error) {
    console.error("Session cookie verification failed:", error);
    return { valid: false, uid: null, decodedClaims: null };
  }
}
