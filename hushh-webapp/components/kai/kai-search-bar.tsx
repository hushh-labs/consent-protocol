// components/kai/kai-search-bar.tsx

/**
 * Kai Search Bar - Command palette for triggering stock analysis
 *
 * Features:
 * - Positioned above bottom nav with proper spacing (bottom-[88px])
 * - Centered with max-width for symmetric appearance
 * - Matches bottom nav glass styling
 * - Typing triggers stock analysis
 * - Auto-complete suggestions based on portfolio holdings
 * - Confirmation dialog before starting analysis
 * - Only shown on dashboard state
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { Search, BarChart3 } from "lucide-react";
import { cn } from "@/lib/morphy-ux/cn";
import { StockAnalysisDialog } from "./stock-analysis-dialog";
import { getStockContext } from "@/lib/services/kai-service";
import { useVault } from "@/lib/vault/vault-context";

// =============================================================================
// TYPES
// =============================================================================

interface KaiSearchBarProps {
  onCommand: (command: string, params?: Record<string, unknown>) => void;
  holdings?: string[]; // List of ticker symbols for autocomplete
  placeholder?: string;
  disabled?: boolean;
}

interface Suggestion {
  label: string;
  symbol: string;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function KaiSearchBar({
  onCommand,
  holdings = [],
  placeholder = "Hushh Analysis (Coming Soon)",
  disabled = false,
}: KaiSearchBarProps) {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Dialog state
  const [showDialog, setShowDialog] = useState(false);
  const [selectedTicker, setSelectedTicker] = useState("");
  const [analysisContext, setAnalysisContext] = useState<any>(undefined);
  
  const { vaultOwnerToken } = useVault();

  // Generate suggestions based on input
  useEffect(() => {
    if (!input.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const inputUpper = input.toUpperCase();
    const newSuggestions: Suggestion[] = [];

    // Stock ticker suggestions from portfolio
    const matchingHoldings = holdings.filter((h) =>
      h.toUpperCase().includes(inputUpper)
    );

    matchingHoldings.slice(0, 4).forEach((holding) => {
      newSuggestions.push({
        label: `Analyze ${holding}`,
        symbol: holding,
      });
    });

    // Also suggest the typed ticker if it's not in portfolio
    if (!matchingHoldings.includes(inputUpper) && /^[A-Z]{1,5}$/.test(inputUpper)) {
      newSuggestions.push({
        label: `Analyze ${inputUpper}`,
        symbol: inputUpper,
      });
    }

    setSuggestions(newSuggestions.slice(0, 5));
    setShowSuggestions(newSuggestions.length > 0);
    setSelectedIndex(-1);
  }, [input, holdings]);

  // Handle input submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Extract ticker from input
    const ticker = input.toUpperCase().match(/^[A-Z]{1,5}$/)?.[0] || input.toUpperCase();
    onCommand("analyze", { symbol: ticker });

    setInput("");
    setShowSuggestions(false);
  };

  // Handle suggestion click - show confirmation dialog
  const handleSuggestionClick = async (suggestion: Suggestion) => {
    setSelectedTicker(suggestion.symbol);
    
    // Check vault is unlocked before proceeding
    if (!vaultOwnerToken) {
      console.error("Vault must be unlocked for stock analysis");
      return;
    }

    // Get world model context for this stock
    // Token user_id is validated by backend via require_vault_owner_token()
    try {
      setAnalysisContext(
        await getStockContext(suggestion.symbol, vaultOwnerToken)
      );
    } catch (error) {
      console.error("Failed to get context:", error);
    }
    
    setShowDialog(true);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === "Enter" && selectedIndex >= 0) {
      e.preventDefault();
      const selected = suggestions[selectedIndex];
      if (selected) {
        handleSuggestionClick(selected);
      }
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
      setSelectedIndex(-1);
    }
  };

  // Handle dialog confirmation - start analysis
  const handleDialogConfirm = async () => {
    setShowDialog(false);
    
    if (selectedTicker) {
      onCommand("analyze", { symbol: selectedTicker });
      setInput("");
      setShowSuggestions(false);
    }
  };

  // Handle dialog cancel
  const handleDialogCancel = () => {
    setShowDialog(false);
    setSelectedTicker("");
    setAnalysisContext(undefined);
  };

  return (
    <div className="fixed bottom-[calc(88px+env(safe-area-inset-bottom))] left-0 right-0 z-40 px-6">
      {/* Confirmation Dialog */}
      <StockAnalysisDialog
        ticker={selectedTicker}
        context={analysisContext}
        onConfirm={handleDialogConfirm}
        onCancel={handleDialogCancel}
        isOpen={showDialog}
      />
      
      <div className="max-w-lg mx-auto relative z-50">
        {/* Suggestions Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="mb-2 rounded-2xl border overflow-hidden shadow-xl backdrop-blur-xl"
            style={{
              backgroundColor: "var(--glass-fill)",
              borderColor: "var(--glass-border)",
            }}
          >
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleSuggestionClick(suggestion)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
                  index === selectedIndex
                    ? "bg-primary/10"
                    : "hover:bg-muted/50"
                )}
              >
                <BarChart3 className="w-5 h-5 text-primary shrink-0" />
                <span className="text-sm font-medium">{suggestion.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Search Input - Matches bottom nav styling */}
        <div
          className="backdrop-blur-xl border rounded-2xl"
          style={{
            backgroundColor: "var(--glass-fill)",
            borderColor: "var(--glass-border)",
          }}
        >
          <form onSubmit={handleSubmit} className="flex items-center gap-3 px-4 py-3">
            <Search className="w-5 h-5 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled}
              maxLength={5}
              className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground disabled:opacity-50"
            />
            {input && (
              <button
                type="button"
                onClick={() => {
                  setInput("");
                  setShowSuggestions(false);
                }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
