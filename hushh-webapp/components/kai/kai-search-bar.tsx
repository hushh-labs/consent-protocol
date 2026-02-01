// components/kai/kai-search-bar.tsx

/**
 * Kai Search Bar - Command palette for triggering component rendering
 *
 * Features:
 * - Persistent at bottom of screen (like command palette)
 * - Typing triggers component rendering (not chat)
 * - Commands like "analyze AAPL", "show losers", "import portfolio"
 * - Auto-complete suggestions based on portfolio holdings
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { Search, TrendingUp, Upload, BarChart3, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/lib/morphy-ux/card";

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
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  command: string;
  params?: Record<string, unknown>;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function KaiSearchBar({
  onCommand,
  holdings = [],
  placeholder = "Ask Kai anything... (e.g., 'analyze AAPL', 'show losers')",
  disabled = false,
}: KaiSearchBarProps) {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  // Generate suggestions based on input
  useEffect(() => {
    if (!input.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const inputLower = input.toLowerCase();
    const newSuggestions: Suggestion[] = [];

    // Command suggestions
    if ("analyze".includes(inputLower)) {
      newSuggestions.push({
        icon: BarChart3,
        label: "Analyze a stock",
        command: "analyze",
      });
    }

    if ("losers".includes(inputLower) || "review".includes(inputLower)) {
      newSuggestions.push({
        icon: TrendingUp,
        label: "Review portfolio losers",
        command: "show_losers",
      });
    }

    if ("import".includes(inputLower) || "upload".includes(inputLower)) {
      newSuggestions.push({
        icon: Upload,
        label: "Import portfolio statement",
        command: "import_portfolio",
      });
    }

    if ("settings".includes(inputLower) || "preferences".includes(inputLower)) {
      newSuggestions.push({
        icon: Settings,
        label: "Open settings",
        command: "open_settings",
      });
    }

    // Stock ticker suggestions
    const tickerPattern = /\b([A-Z]{1,5})\b/g;
    const matches = input.toUpperCase().match(tickerPattern);
    
    if (matches) {
      const ticker = matches[0];
      // Check if ticker exists in portfolio
      const matchingHoldings = holdings.filter((h) =>
        h.toUpperCase().includes(ticker)
      );

      matchingHoldings.slice(0, 3).forEach((holding) => {
        newSuggestions.push({
          icon: BarChart3,
          label: `Analyze ${holding}`,
          command: "analyze",
          params: { symbol: holding },
        });
      });

      // Also suggest the typed ticker if it's not in portfolio
      if (!matchingHoldings.includes(ticker) && ticker.length >= 1) {
        newSuggestions.push({
          icon: BarChart3,
          label: `Analyze ${ticker}`,
          command: "analyze",
          params: { symbol: ticker },
        });
      }
    }

    setSuggestions(newSuggestions.slice(0, 5));
    setShowSuggestions(newSuggestions.length > 0);
    setSelectedIndex(-1);
  }, [input, holdings]);

  // Handle input submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Check for stock ticker patterns
    const tickerPattern = /\b([A-Z]{1,5})\b/g;
    const matches = input.toUpperCase().match(tickerPattern);

    if (matches && matches.length > 0) {
      onCommand("analyze", { symbol: matches[0] });
    } else if (input.toLowerCase().includes("loser")) {
      onCommand("show_losers");
    } else if (input.toLowerCase().includes("import")) {
      onCommand("import_portfolio");
    } else {
      // Generic command
      onCommand(input);
    }

    setInput("");
    setShowSuggestions(false);
  };

  // Handle suggestion selection
  const handleSuggestionClick = (suggestion: Suggestion) => {
    onCommand(suggestion.command, suggestion.params);
    setInput("");
    setShowSuggestions(false);
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
      handleSuggestionClick(suggestions[selectedIndex]);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
      setSelectedIndex(-1);
    }
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-50">
      <Card variant="none" effect="glass" showRipple={false} className="relative">
        {/* Suggestions Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute bottom-full left-0 right-0 mb-2 rounded-lg border border-border bg-background/95 backdrop-blur-sm shadow-xl overflow-hidden">
            {suggestions.map((suggestion, index) => {
              const Icon = suggestion.icon;
              return (
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
                  <Icon className="w-5 h-5 text-primary shrink-0" />
                  <span className="text-sm font-medium">{suggestion.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Search Input */}
        <form onSubmit={handleSubmit} className="flex items-center gap-3 p-3">
          <Search className="w-5 h-5 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
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
      </Card>

      {/* Keyboard Hints */}
      <div className="flex justify-center gap-4 mt-2 text-xs text-muted-foreground">
        <span>↑↓ Navigate</span>
        <span>↵ Select</span>
        <span>Esc Close</span>
      </div>
    </div>
  );
}
