/**
 * CacheService - Global in-memory cache with TTL support
 *
 * Singleton pattern for caching API responses and computed data.
 * Reduces redundant API calls across page navigations.
 *
 * Usage:
 *   const cache = CacheService.getInstance();
 *   cache.set("key", data, 5 * 60 * 1000); // 5 min TTL
 *   const data = cache.get<MyType>("key");
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

// Default TTL: 5 minutes
const DEFAULT_TTL = 5 * 60 * 1000;

class CacheService {
  private cache = new Map<string, CacheEntry<unknown>>();
  private static instance: CacheService | null = null;

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  /**
   * Get cached data if not expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      return null;
    }

    // Check if expired
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set cached data with optional TTL
   */
  set<T>(key: string, data: T, ttlMs: number = DEFAULT_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs,
    });
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Invalidate a specific key
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalidate all keys matching a pattern (prefix match)
   */
  invalidatePattern(pattern: string): void {
    const keysToDelete: string[] = [];

    this.cache.forEach((_, key) => {
      if (key.startsWith(pattern)) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => this.cache.delete(key));
  }

  /**
   * Clear all cached data
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics (for debugging)
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Cache key constants for consistency
export const CACHE_KEYS = {
  WORLD_MODEL_METADATA: (userId: string) => `world_model_metadata_${userId}`,
  VAULT_STATUS: (userId: string) => `vault_status_${userId}`,
  VAULT_CHECK: (userId: string) => `vault_check_${userId}`,
  ACTIVE_CONSENTS: (userId: string) => `active_consents_${userId}`,
  PORTFOLIO_DATA: (userId: string) => `portfolio_data_${userId}`,
  DOMAIN_DATA: (userId: string, domain: string) => `domain_data_${userId}_${domain}`,
  PENDING_CONSENTS: (userId: string) => `pending_consents_${userId}`,
  CONSENT_AUDIT_LOG: (userId: string) => `consent_audit_log_${userId}`,
  STOCK_CONTEXT: (userId: string, ticker: string) => `stock_context_${userId}_${ticker}`,
} as const;

// TTL constants
export const CACHE_TTL = {
  SHORT: 1 * 60 * 1000, // 1 minute
  MEDIUM: 5 * 60 * 1000, // 5 minutes
  LONG: 15 * 60 * 1000, // 15 minutes
  SESSION: 30 * 60 * 1000, // 30 minutes
} as const;

export { CacheService };
