"use client";

import * as React from "react";
import { ChevronsUpDown, Search, Sparkles, TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useMediaQuery } from "@/lib/morphy-ux/use-media-query";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";

// Top 50 popular stocks for instant suggestion
const TOP_STOCKS = [
  { value: "AAPL", label: "Apple Inc." },
  { value: "MSFT", label: "Microsoft Corp." },
  { value: "GOOGL", label: "Alphabet Inc." },
  { value: "AMZN", label: "Amazon.com Inc." },
  { value: "NVDA", label: "NVIDIA Corp." },
  { value: "TSLA", label: "Tesla Inc." },
  { value: "META", label: "Meta Platforms Inc." },
  { value: "BRK.B", label: "Berkshire Hathaway" },
  { value: "LLY", label: "Eli Lilly & Co." },
  { value: "V", label: "Visa Inc." },
  { value: "TSM", label: "Taiwan Semiconductor" },
  { value: "AVGO", label: "Broadcom Inc." },
  { value: "JPM", label: "JPMorgan Chase" },
  { value: "WMT", label: "Walmart Inc." },
  { value: "XOM", label: "Exxon Mobil Corp." },
  { value: "MA", label: "Mastercard Inc." },
  { value: "UNH", label: "UnitedHealth Group" },
  { value: "PG", label: "Procter & Gamble" },
  { value: "JNJ", label: "Johnson & Johnson" },
  { value: "HD", label: "Home Depot Inc." },
  { value: "MRK", label: "Merck & Co." },
  { value: "COST", label: "Costco Wholesale" },
  { value: "ABBV", label: "AbbVie Inc." },
  { value: "CVX", label: "Chevron Corp." },
  { value: "CRM", label: "Salesforce Inc." },
  { value: "BAC", label: "Bank of America" },
  { value: "AMD", label: "Advanced Micro Devices" },
  { value: "NFLX", label: "Netflix Inc." },
  { value: "PEP", label: "PepsiCo Inc." },
  { value: "KO", label: "Coca-Cola Co." },
  { value: "TMO", label: "Thermo Fisher" },
  { value: "ADBE", label: "Adobe Inc." },
  { value: "DIS", label: "Walt Disney Co." },
  { value: "MCD", label: "McDonald's Corp." },
  { value: "CSCO", label: "Cisco Systems" },
  { value: "ABT", label: "Abbott Labs" },
  { value: "DHR", label: "Danaher Corp." },
  { value: "INTC", label: "Intel Corp." },
  { value: "NKE", label: "Nike Inc." },
  { value: "VZ", label: "Verizon Comm." },
  { value: "CMCSA", label: "Comcast Corp." },
  { value: "INTU", label: "Intuit Inc." },
  { value: "QCOM", label: "Qualcomm Inc." },
  { value: "IBM", label: "IBM Corp." },
  { value: "TXN", label: "Texas Instruments" },
  { value: "AMGN", label: "Amgen Inc." },
  { value: "SPY", label: "S&P 500 ETF" },
  { value: "QQQ", label: "Nasdaq 100 ETF" },
  { value: "IWM", label: "Russell 2000 ETF" },
  { value: "GLD", label: "Gold Trust" },
];

/** Set of known ticker values for fast lookup */
const TOP_STOCKS_SET = new Set(TOP_STOCKS.map((s) => s.value));

/** Returns true when `text` looks like a valid 1-5 letter ticker */
function isTickerLike(text: string): boolean {
  return /^[A-Z]{1,5}$/.test(text);
}

export function StockSearch({
  onSelect,
  className,
}: {
  onSelect: (ticker: string) => void;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const isDesktop = useMediaQuery("(min-width: 768px)");

  // Derive escape-hatch ticker: show when typed value is a valid ticker
  // that doesn't exactly match any entry in TOP_STOCKS
  const escapeTicker = React.useMemo(() => {
    const upper = search.trim().toUpperCase();
    if (!upper || !isTickerLike(upper)) return null;
    if (TOP_STOCKS_SET.has(upper)) return null;
    return upper;
  }, [search]);

  // Handle selection logic
  const handleSelect = (value: string) => {
    setOpen(false);
    setSearch("");
    onSelect(value);
  };

  // Shared content for Popover (Desktop) and Drawer (Mobile)
  const SearchContent = (
    <Command
      className="rounded-lg border shadow-md"
      shouldFilter={true}
    >
      <CommandInput
        placeholder="Search ticker (e.g. AAPL)..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList className="max-h-[300px] overflow-y-auto">
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Escape hatch: type any ticker not in the list */}
        {escapeTicker && (
          <CommandGroup heading="Type any ticker">
            <CommandItem
              value={`custom-${escapeTicker}`}
              onSelect={() => handleSelect(escapeTicker)}
              className="cursor-pointer"
              forceMount
            >
              <Sparkles className="mr-2 h-4 w-4 text-primary" />
              <span className="font-bold">Analyze {escapeTicker}</span>
            </CommandItem>
          </CommandGroup>
        )}

        <CommandGroup heading="Popular Stocks">
          {TOP_STOCKS.map((stock) => (
            <CommandItem
              key={stock.value}
              value={`${stock.value} ${stock.label}`} // Allow searching by name or ticker
              onSelect={() => handleSelect(stock.value)}
              className="cursor-pointer"
            >
              <TrendingUp className="mr-2 h-4 w-4 text-muted-foreground" />
              <span className="font-bold w-12">{stock.value}</span>
              <span className="text-muted-foreground truncate">{stock.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );

  if (isDesktop) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn("w-[250px] justify-between text-muted-foreground", className)}
          >
            <span className="flex items-center">
                <Search className="mr-2 h-4 w-4" />
                Analyze a stock...
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          {SearchContent}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between text-muted-foreground", className)}
        >
          <span className="flex items-center">
            <Search className="mr-2 h-4 w-4" />
            Analyze a stock...
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <div className="mt-4 border-t h-[60vh]">
          {SearchContent}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
