"use client";

/**
 * App-Level Audit Log Column Definitions
 * Shows grouped apps with active token indicator
 */

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";

export interface AppSummary {
  agent_id: string;
  lastActivity: number;
  totalEvents: number;
  hasActiveToken: boolean;
  events: AuditLogEntry[];
}

export interface AuditLogEntry {
  id: string;
  agent_id: string;
  scope: string;
  action: string;
  issued_at: number;
  request_id: string | null;
  is_timed_out?: boolean;
}

// Format relative time
const formatLastActivity = (timestamp: number) => {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
};

export const appColumns: ColumnDef<AppSummary>[] = [
  {
    accessorKey: "agent_id",
    header: "App",
    cell: ({ row }) => {
      const hasActive = row.original.hasActiveToken;
      const totalEvents = row.original.totalEvents;
      return (
        <div className="flex items-center gap-2">
          <span className="font-medium">{row.getValue("agent_id")}</span>
          {hasActive && (
            <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-xs">
              Active
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">
            ({totalEvents} {totalEvents === 1 ? "event" : "events"})
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: "lastActivity",
    header: "Last Activity",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {formatLastActivity(row.getValue("lastActivity"))}
      </span>
    ),
  },
];

// Scope formatting for drawer
export const formatScope = (scope: string) => {
  const scopeMap: Record<string, { emoji: string; label: string }> = {
    vault_read_food: { emoji: "🍽️", label: "Food Preferences" },
    vault_read_professional: { emoji: "💼", label: "Professional Profile" },
    vault_read_finance: { emoji: "💰", label: "Finance" },
    "vault.read.food": { emoji: "🍽️", label: "Food Preferences" },
    "vault.read.professional": { emoji: "💼", label: "Professional Profile" },
  };
  return scopeMap[scope] || { emoji: "🔐", label: scope.replace(/[_.]/g, " ") };
};

// Action formatting for drawer
export const getActionInfo = (action: string, isTimedOut?: boolean) => {
  if (isTimedOut && action === "REQUESTED") {
    return {
      label: "Request Expired",
      emoji: "⏰",
      className: "bg-orange-500/10 text-orange-600 border-orange-500/20",
    };
  }

  const actionMap: Record<
    string,
    { label: string; emoji: string; className: string }
  > = {
    REQUESTED: {
      label: "Access Requested",
      emoji: "📋",
      className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    },
    CONSENT_GRANTED: {
      label: "Access Granted",
      emoji: "✅",
      className: "bg-green-500/10 text-green-600 border-green-500/20",
    },
    CONSENT_DENIED: {
      label: "Access Denied",
      emoji: "❌",
      className: "bg-red-500/10 text-red-600 border-red-500/20",
    },
    CANCELLED: {
      label: "Request Cancelled",
      emoji: "🚫",
      className: "bg-gray-500/10 text-gray-600 border-gray-500/20",
    },
    TIMED_OUT: {
      label: "Request Expired",
      emoji: "⏰",
      className: "bg-orange-500/10 text-orange-600 border-orange-500/20",
    },
    REVOKED: {
      label: "Access Revoked",
      emoji: "🔒",
      className: "bg-red-500/10 text-red-600 border-red-500/20",
    },
  };
  return (
    actionMap[action] || {
      label: action,
      emoji: "📝",
      className: "bg-gray-500/10 text-gray-600",
    }
  );
};
