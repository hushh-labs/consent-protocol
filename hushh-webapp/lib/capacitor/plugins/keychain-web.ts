/**
 * HushhKeychain Web Fallback Implementation
 *
 * This implementation is used when running in a browser (web/cloud mode).
 * Uses sessionStorage/localStorage as a fallback (NOT secure like iOS Keychain).
 *
 * WARNING: This is for development/testing only.
 * In production web mode, consider using IndexedDB with encryption.
 *
 * NOTE: In native iOS mode, the Swift plugin with real Keychain is used.
 */

import type { WebPlugin } from "@capacitor/core";
import type {
  KeychainSetOptions,
  KeychainGetOptions,
  KeychainGetResult,
  KeychainDeleteOptions,
} from "../types";

const KEYCHAIN_PREFIX = "hushh_keychain_";

export class HushhKeychainWeb implements WebPlugin {
  /**
   * Store a value - uses sessionStorage in web mode
   * (sessionStorage is more secure than localStorage as it clears on tab close)
   */
  async set(options: KeychainSetOptions): Promise<void> {
    const key = KEYCHAIN_PREFIX + options.key;

    // In web mode, use sessionStorage for in-memory-like behavior
    // This is NOT as secure as iOS Keychain but works for development
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(key, options.value);
    } else {
      // Fallback to in-memory storage
      (globalThis as unknown as Record<string, string>)[key] = options.value;
    }
  }

  /**
   * Retrieve a value
   */
  async get(options: KeychainGetOptions): Promise<KeychainGetResult> {
    const key = KEYCHAIN_PREFIX + options.key;

    if (typeof sessionStorage !== "undefined") {
      return { value: sessionStorage.getItem(key) };
    } else {
      return {
        value: (globalThis as unknown as Record<string, string>)[key] || null,
      };
    }
  }

  /**
   * Delete a value
   */
  async delete(options: KeychainDeleteOptions): Promise<void> {
    const key = KEYCHAIN_PREFIX + options.key;

    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem(key);
    } else {
      delete (globalThis as unknown as Record<string, string>)[key];
    }
  }

  /**
   * Check biometric availability - not available in web mode
   */
  async isBiometricAvailable(): Promise<{
    available: boolean;
    type: "faceId" | "touchId" | "none";
  }> {
    // Web Authentication API could potentially support this,
    // but for now we just return not available
    return { available: false, type: "none" };
  }

  /**
   * Store with biometric protection - falls back to regular storage in web
   */
  async setBiometric(
    options: KeychainSetOptions & { promptMessage: string }
  ): Promise<void> {
    console.warn(
      "Biometric storage not available in web mode, using regular storage"
    );
    await this.set(options);
  }

  /**
   * Get with biometric protection - falls back to regular storage in web
   */
  async getBiometric(
    options: KeychainGetOptions & { promptMessage: string }
  ): Promise<KeychainGetResult> {
    console.warn(
      "Biometric storage not available in web mode, using regular storage"
    );
    return this.get(options);
  }
}
