/**
 * Platform-Aware Session Storage
 * 
 * On iOS (Capacitor), sessionStorage doesn't work reliably in WKWebView.
 * This utility uses localStorage with a session prefix on native platforms.
 * 
 * SECURITY NOTE: On native, we use localStorage which persists.
 * This is acceptable because native apps have better app-level isolation.
 */

const isNativePlatform = typeof window !== 'undefined' && 
  (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();

const SESSION_PREFIX = '_session_';

/**
 * Set a session value (uses localStorage on iOS, sessionStorage on web)
 */
export function setSessionItem(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    if (isNativePlatform) {
      // On native, use localStorage with session prefix
      localStorage.setItem(SESSION_PREFIX + key, value);
    } else {
      // On web, use sessionStorage
      sessionStorage.setItem(key, value);
    }
  } catch (e) {
    console.warn('[SessionStorage] Failed to set item:', e);
  }
}

/**
 * Get a session value
 */
export function getSessionItem(key: string): string | null {
  if (typeof window === 'undefined') return null;
  
  try {
    if (isNativePlatform) {
      return localStorage.getItem(SESSION_PREFIX + key);
    } else {
      return sessionStorage.getItem(key);
    }
  } catch (e) {
    console.warn('[SessionStorage] Failed to get item:', e);
    return null;
  }
}

/**
 * Remove a session value
 */
export function removeSessionItem(key: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    if (isNativePlatform) {
      localStorage.removeItem(SESSION_PREFIX + key);
    } else {
      sessionStorage.removeItem(key);
    }
  } catch (e) {
    console.warn('[SessionStorage] Failed to remove item:', e);
  }
}

/**
 * Clear all session values
 */
export function clearSessionStorage(): void {
  if (typeof window === 'undefined') return;
  
  try {
    if (isNativePlatform) {
      // Only clear session-prefixed items
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(SESSION_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } else {
      sessionStorage.clear();
    }
  } catch (e) {
    console.warn('[SessionStorage] Failed to clear:', e);
  }
}

// Re-export check for convenience
export { isNativePlatform };
