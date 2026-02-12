/**
 * Kai Analysis History Service
 *
 * Manages analysis history within the encrypted world model blob.
 * Uses FIFO strategy: max 3 analyses per ticker, newest first.
 *
 * Domain: "kai_analysis_history"
 *
 * Structure inside encrypted blob:
 * {
 *   "kai_analysis_history": {
 *     "AMZN": [entry3, entry2, entry1],  // newest first, max 3
 *     "AAPL": [entry2, entry1],
 *   }
 * }
 */

import { WorldModelService } from "./world-model-service";
import { CacheService, CACHE_KEYS } from "./cache-service";

const MAX_HISTORY_PER_TICKER = 3;
const DOMAIN = "kai_analysis_history";

// ============================================================================
// Types
// ============================================================================

export interface AnalysisHistoryEntry {
  ticker: string;
  timestamp: string; // ISO date
  decision: "buy" | "hold" | "reduce" | string;
  confidence: number;
  consensus_reached: boolean;
  agent_votes: Record<string, string>;
  final_statement: string;
  raw_card: Record<string, any>; // Full decision card data
}

export type AnalysisHistoryMap = Record<string, AnalysisHistoryEntry[]>;

// ============================================================================
// Service
// ============================================================================

export class KaiHistoryService {
  /**
   * Save a new analysis result to history.
   * Implements FIFO: prepends new entry, pops oldest if > MAX_HISTORY_PER_TICKER.
   *
   * Uses fetch-decrypt-merge-encrypt-save cycle to avoid overwriting other domains.
   */
  static async saveAnalysis(params: {
    userId: string;
    vaultKey: string;
    vaultOwnerToken?: string;
    entry: AnalysisHistoryEntry;
  }): Promise<boolean> {
    const { userId, vaultKey, vaultOwnerToken, entry } = params;

    try {
      const { HushhVault } = await import("@/lib/capacitor");
      const { decryptData } = await import("@/lib/vault/encrypt");

      // 1. Fetch existing encrypted blob
      let fullBlob: Record<string, any> = {};
      try {
        const existing = await WorldModelService.getDomainData(userId, DOMAIN, vaultOwnerToken);
        if (existing) {
          const decrypted = await decryptData(
            {
              ciphertext: existing.ciphertext,
              iv: existing.iv,
              tag: existing.tag,
              encoding: "base64",
              algorithm: (existing.algorithm || "aes-256-gcm") as "aes-256-gcm",
            },
            vaultKey
          );
          fullBlob = JSON.parse(decrypted);
        }
      } catch (e) {
        console.warn("[KaiHistory] Could not fetch/decrypt existing blob, starting fresh:", e);
      }

      // 2. Get or create the history map
      const historyMap: AnalysisHistoryMap = fullBlob[DOMAIN] || {};

      // 3. Get or create the ticker array
      const tickerHistory = historyMap[entry.ticker] || [];

      // 4. Prepend new entry (newest first)
      tickerHistory.unshift(entry);

      // 5. FIFO: remove oldest if exceeds max
      if (tickerHistory.length > MAX_HISTORY_PER_TICKER) {
        tickerHistory.splice(MAX_HISTORY_PER_TICKER);
      }

      // 6. Update the map
      historyMap[entry.ticker] = tickerHistory;
      fullBlob[DOMAIN] = historyMap;

      // 7. Re-encrypt and store
      const encrypted = await HushhVault.encryptData({
        plaintext: JSON.stringify(fullBlob),
        keyHex: vaultKey,
      });

      // 8. Build non-sensitive summary for index
      const tickers = Object.keys(historyMap);
      const totalAnalyses = Object.values(historyMap).reduce((sum, arr) => sum + arr.length, 0);
      const summary = {
        total_analyses: totalAnalyses,
        tickers_analyzed: tickers,
        last_analysis_ticker: entry.ticker,
        last_analysis_date: entry.timestamp,
        last_updated: new Date().toISOString(),
      };

      const result = await WorldModelService.storeDomainData({
        userId,
        domain: DOMAIN,
        encryptedBlob: {
          ciphertext: encrypted.ciphertext,
          iv: encrypted.iv,
          tag: encrypted.tag,
          algorithm: "aes-256-gcm",
        },
        summary,
        vaultOwnerToken,
      });

      // Invalidate caches after successful save
      if (result.success) {
        const cache = CacheService.getInstance();
        cache.invalidate(CACHE_KEYS.DOMAIN_DATA(userId, DOMAIN));
        cache.invalidate(CACHE_KEYS.STOCK_CONTEXT(userId, entry.ticker));
        cache.invalidate(CACHE_KEYS.WORLD_MODEL_METADATA(userId));
      }

      return result.success;
    } catch (error) {
      console.error("[KaiHistory] Failed to save analysis:", error);
      return false;
    }
  }

  /**
   * Get analysis history for a specific ticker.
   *
   * @returns Array of AnalysisHistoryEntry (newest first), or empty array.
   */
  static async getTickerHistory(params: {
    userId: string;
    vaultKey: string;
    vaultOwnerToken?: string;
    ticker: string;
  }): Promise<AnalysisHistoryEntry[]> {
    try {
      const historyMap = await this.getAllHistory(params);
      return historyMap[params.ticker] || [];
    } catch {
      return [];
    }
  }

  /**
   * Get all analysis history across all tickers.
   */
  static async getAllHistory(params: {
    userId: string;
    vaultKey: string;
    vaultOwnerToken?: string;
  }): Promise<AnalysisHistoryMap> {
    const { userId, vaultKey, vaultOwnerToken } = params;

    try {
      const { decryptData } = await import("@/lib/vault/encrypt");

      const existing = await WorldModelService.getDomainData(userId, DOMAIN, vaultOwnerToken);
      if (!existing) return {};

      const decrypted = await decryptData(
        {
          ciphertext: existing.ciphertext,
          iv: existing.iv,
          tag: existing.tag,
          encoding: "base64",
          algorithm: (existing.algorithm || "aes-256-gcm") as "aes-256-gcm",
        },
        vaultKey
      );

      const fullBlob = JSON.parse(decrypted);
      return fullBlob[DOMAIN] || {};
    } catch (error) {
      console.error("[KaiHistory] Failed to get history:", error);
      return {};
    }
  }
}

export default KaiHistoryService;
