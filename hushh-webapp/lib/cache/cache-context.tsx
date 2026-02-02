"use client";

/**
 * CacheProvider - React context for sharing cached data across components
 *
 * Provides in-memory caching for frequently accessed data:
 * - World Model metadata
 * - Portfolio data
 * - Vault status
 * - Active consents
 *
 * Data is cached on first fetch and shared across page navigations.
 * Invalidation happens on explicit user actions (logout, data clear).
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  useMemo,
} from "react";
import { CacheService, CACHE_KEYS, CACHE_TTL } from "@/lib/services/cache-service";
import type { WorldModelMetadata } from "@/lib/services/world-model-service";

// ==================== Types ====================

export interface VaultStatus {
  totalActive: number;
  total: number;
  domains: Record<string, { fieldCount: number }>;
}

export interface ActiveConsent {
  id: string;
  scope: string;
  developer: string;
  issued_at: number;
  expires_at: number;
  time_remaining_ms: number;
}

export interface PortfolioData {
  account_info?: {
    account_number?: string;
    brokerage_name?: string;
    statement_period?: string;
    account_holder?: string;
  };
  account_summary?: {
    beginning_value?: number;
    ending_value: number;
    change_in_value?: number;
    cash_balance?: number;
    equities_value?: number;
  };
  holdings?: Array<{
    symbol: string;
    name: string;
    quantity: number;
    price: number;
    market_value: number;
    cost_basis?: number;
    unrealized_gain_loss?: number;
    unrealized_gain_loss_pct?: number;
  }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

interface CacheContextType {
  // World Model
  worldModelMetadata: WorldModelMetadata | null;
  setWorldModelMetadata: (userId: string, data: WorldModelMetadata) => void;
  getWorldModelMetadata: (userId: string) => WorldModelMetadata | null;

  // Portfolio
  portfolioData: PortfolioData | null;
  setPortfolioData: (userId: string, data: PortfolioData) => void;
  getPortfolioData: (userId: string) => PortfolioData | null;

  // Vault Status
  vaultStatus: VaultStatus | null;
  setVaultStatus: (userId: string, data: VaultStatus) => void;
  getVaultStatus: (userId: string) => VaultStatus | null;

  // Active Consents
  activeConsents: ActiveConsent[];
  setActiveConsents: (userId: string, data: ActiveConsent[]) => void;
  getActiveConsents: (userId: string) => ActiveConsent[] | null;

  // Invalidation
  invalidateAll: () => void;
  invalidateUser: (userId: string) => void;
  invalidateDomain: (userId: string, domain: string) => void;

  // Prefetch status
  isPrefetching: boolean;
  setPrefetching: (status: boolean) => void;
}

// ==================== Context ====================

const CacheContext = createContext<CacheContextType | null>(null);

// ==================== Provider ====================

interface CacheProviderProps {
  children: ReactNode;
}

export function CacheProvider({ children }: CacheProviderProps) {
  // Local state for React reactivity (mirrors CacheService for UI updates)
  const [worldModelMetadata, setWorldModelMetadataState] =
    useState<WorldModelMetadata | null>(null);
  const [portfolioData, setPortfolioDataState] = useState<PortfolioData | null>(
    null
  );
  const [vaultStatus, setVaultStatusState] = useState<VaultStatus | null>(null);
  const [activeConsents, setActiveConsentsState] = useState<ActiveConsent[]>(
    []
  );
  const [isPrefetching, setPrefetching] = useState(false);

  const cache = CacheService.getInstance();

  // World Model Metadata
  const setWorldModelMetadata = useCallback(
    (userId: string, data: WorldModelMetadata) => {
      cache.set(CACHE_KEYS.WORLD_MODEL_METADATA(userId), data, CACHE_TTL.MEDIUM);
      setWorldModelMetadataState(data);
    },
    [cache]
  );

  const getWorldModelMetadata = useCallback(
    (userId: string): WorldModelMetadata | null => {
      const cached = cache.get<WorldModelMetadata>(
        CACHE_KEYS.WORLD_MODEL_METADATA(userId)
      );
      if (cached && !worldModelMetadata) {
        setWorldModelMetadataState(cached);
      }
      return cached;
    },
    [cache, worldModelMetadata]
  );

  // Portfolio Data
  const setPortfolioData = useCallback(
    (userId: string, data: PortfolioData) => {
      cache.set(CACHE_KEYS.PORTFOLIO_DATA(userId), data, CACHE_TTL.MEDIUM);
      // Also update sessionStorage for persistence across refreshes
      if (typeof window !== "undefined") {
        sessionStorage.setItem("kai_portfolio_data", JSON.stringify(data));
      }
      setPortfolioDataState(data);
    },
    [cache]
  );

  const getPortfolioData = useCallback(
    (userId: string): PortfolioData | null => {
      // Check in-memory cache first
      let cached = cache.get<PortfolioData>(CACHE_KEYS.PORTFOLIO_DATA(userId));

      // Fall back to sessionStorage
      if (!cached && typeof window !== "undefined") {
        const stored = sessionStorage.getItem("kai_portfolio_data");
        if (stored) {
          try {
            cached = JSON.parse(stored);
            // Re-populate in-memory cache
            if (cached) {
              cache.set(
                CACHE_KEYS.PORTFOLIO_DATA(userId),
                cached,
                CACHE_TTL.MEDIUM
              );
            }
          } catch {
            // Invalid JSON, ignore
          }
        }
      }

      if (cached && !portfolioData) {
        setPortfolioDataState(cached);
      }
      return cached;
    },
    [cache, portfolioData]
  );

  // Vault Status
  const setVaultStatus = useCallback(
    (userId: string, data: VaultStatus) => {
      cache.set(CACHE_KEYS.VAULT_STATUS(userId), data, CACHE_TTL.SHORT);
      setVaultStatusState(data);
    },
    [cache]
  );

  const getVaultStatus = useCallback(
    (userId: string): VaultStatus | null => {
      const cached = cache.get<VaultStatus>(CACHE_KEYS.VAULT_STATUS(userId));
      if (cached && !vaultStatus) {
        setVaultStatusState(cached);
      }
      return cached;
    },
    [cache, vaultStatus]
  );

  // Active Consents
  const setActiveConsents = useCallback(
    (userId: string, data: ActiveConsent[]) => {
      cache.set(CACHE_KEYS.ACTIVE_CONSENTS(userId), data, CACHE_TTL.SHORT);
      setActiveConsentsState(data);
    },
    [cache]
  );

  const getActiveConsents = useCallback(
    (userId: string): ActiveConsent[] | null => {
      const cached = cache.get<ActiveConsent[]>(
        CACHE_KEYS.ACTIVE_CONSENTS(userId)
      );
      if (cached && activeConsents.length === 0) {
        setActiveConsentsState(cached);
      }
      return cached;
    },
    [cache, activeConsents.length]
  );

  // Invalidation
  const invalidateAll = useCallback(() => {
    cache.clear();
    setWorldModelMetadataState(null);
    setPortfolioDataState(null);
    setVaultStatusState(null);
    setActiveConsentsState([]);
    // Clear sessionStorage cache too
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("kai_portfolio_data");
    }
  }, [cache]);

  const invalidateUser = useCallback(
    (userId: string) => {
      cache.invalidate(CACHE_KEYS.WORLD_MODEL_METADATA(userId));
      cache.invalidate(CACHE_KEYS.PORTFOLIO_DATA(userId));
      cache.invalidate(CACHE_KEYS.VAULT_STATUS(userId));
      cache.invalidate(CACHE_KEYS.ACTIVE_CONSENTS(userId));
      setWorldModelMetadataState(null);
      setPortfolioDataState(null);
      setVaultStatusState(null);
      setActiveConsentsState([]);
      // Clear sessionStorage cache too
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("kai_portfolio_data");
      }
    },
    [cache]
  );

  const invalidateDomain = useCallback(
    (userId: string, domain: string) => {
      cache.invalidate(CACHE_KEYS.DOMAIN_DATA(userId, domain));
      // Also invalidate metadata since domain counts may have changed
      cache.invalidate(CACHE_KEYS.WORLD_MODEL_METADATA(userId));
      setWorldModelMetadataState(null);
      if (domain === "financial") {
        cache.invalidate(CACHE_KEYS.PORTFOLIO_DATA(userId));
        setPortfolioDataState(null);
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("kai_portfolio_data");
        }
      }
    },
    [cache]
  );

  const value = useMemo(
    () => ({
      worldModelMetadata,
      setWorldModelMetadata,
      getWorldModelMetadata,
      portfolioData,
      setPortfolioData,
      getPortfolioData,
      vaultStatus,
      setVaultStatus,
      getVaultStatus,
      activeConsents,
      setActiveConsents,
      getActiveConsents,
      invalidateAll,
      invalidateUser,
      invalidateDomain,
      isPrefetching,
      setPrefetching,
    }),
    [
      worldModelMetadata,
      setWorldModelMetadata,
      getWorldModelMetadata,
      portfolioData,
      setPortfolioData,
      getPortfolioData,
      vaultStatus,
      setVaultStatus,
      getVaultStatus,
      activeConsents,
      setActiveConsents,
      getActiveConsents,
      invalidateAll,
      invalidateUser,
      invalidateDomain,
      isPrefetching,
    ]
  );

  return (
    <CacheContext.Provider value={value}>{children}</CacheContext.Provider>
  );
}

// ==================== Hook ====================

export function useCache(): CacheContextType {
  const context = useContext(CacheContext);
  if (!context) {
    throw new Error("useCache must be used within CacheProvider");
  }
  return context;
}

// Export for external use
export { CacheContext };
