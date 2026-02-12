// components/kai/kai-search-bar.tsx

/**
 * Kai Search Bar - Command palette for triggering stock analysis
 *
 * Delegates search UI to StockSearch (Popover on desktop, Drawer on mobile).
 * Wires selection to the onCommand("analyze", { symbol }) callback after
 * verifying the vault is unlocked.
 */

"use client";

import { useVault } from "@/lib/vault/vault-context";
import { StockSearch } from "@/components/kai/views/stock-search";

// =============================================================================
// TYPES
// =============================================================================

interface KaiSearchBarProps {
  onCommand: (command: string, params?: Record<string, unknown>) => void;
  /** @deprecated – no longer used; StockSearch has its own suggestion list */
  holdings?: string[];
  /** @deprecated – no longer used */
  placeholder?: string;
  disabled?: boolean;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function KaiSearchBar({
  onCommand,
  disabled = false,
}: KaiSearchBarProps) {
  const { vaultOwnerToken } = useVault();

  const handleSelect = (ticker: string) => {
    if (!vaultOwnerToken) {
      console.error("Vault must be unlocked for stock analysis");
      return;
    }
    onCommand("analyze", { symbol: ticker });
  };

  return (
    <div className="fixed bottom-[calc(88px+env(safe-area-inset-bottom))] left-0 right-0 z-40 px-6">
      <div className="max-w-lg mx-auto">
        <StockSearch
          onSelect={handleSelect}
          className={disabled ? "pointer-events-none opacity-50" : "w-full"}
        />
      </div>
    </div>
  );
}
