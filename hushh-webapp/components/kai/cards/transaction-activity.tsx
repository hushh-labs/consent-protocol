// components/kai/cards/transaction-activity.tsx

/**
 * Transaction Activity Card - Recent trades and activity
 * 
 * Features:
 * - Shows recent BUY, SELL, DIVIDEND, REINVEST transactions
 * - Color-coded by transaction type
 * - Shows realized gain/loss for sells
 * - Responsive and mobile-friendly
 */

"use client";

import { 
  ArrowDownLeft, 
  ArrowUpRight, 
  Coins, 
  RefreshCw,
  ArrowRightLeft,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/lib/morphy-ux/card";

// =============================================================================
// TYPES
// =============================================================================

export interface Transaction {
  trade_date?: string;
  date?: string;
  settle_date?: string;
  type: string;
  symbol: string;
  description?: string;
  quantity?: number;
  price?: number;
  amount: number;
  cost_basis?: number;
  realized_gain_loss?: number;
  fees?: number;
}

interface TransactionActivityProps {
  transactions?: Transaction[];
  maxItems?: number;
  className?: string;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "";
  // Handle various date formats
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      // If parsing fails, return as-is (might be "29 Mar 2021" format)
      return dateStr;
    }
    return date.toLocaleDateString("en-US", { 
      month: "short", 
      day: "numeric",
      year: "numeric"
    });
  } catch {
    return dateStr;
  }
}

// =============================================================================
// TRANSACTION ICON
// =============================================================================

interface TransactionIconProps {
  type: string;
}

function TransactionIcon({ type }: TransactionIconProps) {
  const normalizedType = type.toUpperCase();
  
  const iconConfig: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
    BUY: { icon: ArrowDownLeft, color: "text-blue-500", bg: "bg-blue-500/10" },
    SELL: { icon: ArrowUpRight, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    DIVIDEND: { icon: Coins, color: "text-amber-500", bg: "bg-amber-500/10" },
    REINVEST: { icon: RefreshCw, color: "text-purple-500", bg: "bg-purple-500/10" },
    TRANSFER: { icon: ArrowRightLeft, color: "text-gray-500", bg: "bg-gray-500/10" },
  };
  
  const config = iconConfig[normalizedType] || iconConfig.TRANSFER;
  const Icon = config.icon;
  
  return (
    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", config.bg)}>
      <Icon className={cn("w-4 h-4", config.color)} />
    </div>
  );
}

// =============================================================================
// TRANSACTION ROW
// =============================================================================

interface TransactionRowProps {
  transaction: Transaction;
}

function TransactionRow({ transaction }: TransactionRowProps) {
  const date = transaction.trade_date || transaction.date;
  const normalizedType = transaction.type.toUpperCase();
  const isSell = normalizedType === "SELL";
  const isDividend = normalizedType === "DIVIDEND";
  const hasGainLoss = transaction.realized_gain_loss !== undefined && transaction.realized_gain_loss !== null;
  const isGain = hasGainLoss && transaction.realized_gain_loss! >= 0;
  
  return (
    <div className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-3">
        <TransactionIcon type={transaction.type} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{transaction.symbol}</span>
            <span className="text-xs text-muted-foreground uppercase">
              {transaction.type}
            </span>
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {date && formatDate(date)}
            {transaction.quantity && transaction.price && (
              <span className="ml-1">
                • {transaction.quantity.toLocaleString()} @ {formatCurrency(transaction.price)}
              </span>
            )}
          </p>
        </div>
      </div>
      
      <div className="text-right shrink-0">
        <p className={cn(
          "font-medium text-sm",
          isSell || isDividend ? "text-emerald-500" : ""
        )}>
          {isSell || isDividend ? "+" : "-"}{formatCurrency(Math.abs(transaction.amount))}
        </p>
        {hasGainLoss && (
          <p className={cn(
            "text-xs",
            isGain ? "text-emerald-500" : "text-red-500"
          )}>
            {isGain ? "+" : ""}{formatCurrency(transaction.realized_gain_loss!)}
          </p>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function TransactionActivity({ 
  transactions, 
  maxItems = 5,
  className 
}: TransactionActivityProps) {
  // Filter out invalid transactions and limit to maxItems
  const validTransactions = (transactions || [])
    .filter(tx => tx.symbol && tx.amount !== undefined)
    .slice(0, maxItems);
  
  if (validTransactions.length === 0) {
    return null;
  }

  return (
    <Card variant="none" effect="glass" showRipple={false} className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Activity className="w-4 h-4" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 divide-y divide-border">
        {validTransactions.map((tx, index) => (
          <TransactionRow 
            key={`${tx.symbol}-${tx.trade_date || tx.date}-${index}`} 
            transaction={tx} 
          />
        ))}
      </CardContent>
    </Card>
  );
}

export default TransactionActivity;
