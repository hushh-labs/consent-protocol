"use client";

/**
 * Consent Management Dashboard
 *
 * Shows:
 * 1. Pending consent requests from developers
 * 2. Active session tokens
 * 3. Consent audit history (logs)
 */

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/lib/morphy-ux/morphy";
import {
  Check,
  X,
  Shield,
  Clock,
  RefreshCw,
  Bell,
  CheckCircle2,
  History,
  Key,
  Ban,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useVault } from "@/lib/vault/vault-context";
import { useConsentSSE } from "@/lib/consent";
import { ApiService, getApiBaseUrl } from "@/lib/services/api-service";
import { getSessionItem } from "@/lib/utils/session-storage";
import { useConsentActions } from "@/lib/consent";
import { DataTable } from "@/components/ui/data-table";
import {
  appColumns,
  AppSummary,
  AuditLogEntry,
  formatScope,
  getActionInfo,
} from "./columns";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

import { useAuth } from "@/hooks/use-auth";
import { VaultFlow } from "@/components/vault/vault-flow";
import { HushhLoader } from "@/components/ui/hushh-loader";

interface PendingConsent {
  id: string;
  developer: string;
  scope: string;
  scopeDescription: string;
  requestedAt: number;
  expiryHours: number;
}

interface ConsentAuditEntry {
  id: string;
  token_id: string;
  agent_id: string;
  scope: string;
  action: string;
  issued_at: number;
  expires_at: number | null;
  token_type: string;
  request_id: string | null;
  is_timed_out?: boolean; // Backend detects if REQUESTED + poll_timeout_at passed
}

interface SessionInfo {
  isActive: boolean;
  expiresAt: number | null;
  token: string | null;
  scope: string;
}

interface ActiveConsent {
  id: string;
  scope: string;
  developer: string;
  issued_at: number;
  expires_at: number;
  time_remaining_ms: number;
}

// AppAuditLog component - groups by app and shows Drawer for event details
function AppAuditLog({
  auditLog,
  activeConsents,
}: {
  auditLog: AuditLogEntry[];
  activeConsents: ActiveConsent[];
}) {
  const [selectedApp, setSelectedApp] = React.useState<AppSummary | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  // Group audit log by app and compute summary
  const appSummaries: AppSummary[] = React.useMemo(() => {
    const grouped = auditLog.reduce((acc, entry) => {
      const appName = entry.agent_id || "Unknown App";
      if (!acc[appName]) {
        acc[appName] = [];
      }
      acc[appName].push(entry);
      return acc;
    }, {} as Record<string, AuditLogEntry[]>);

    return Object.entries(grouped)
      .map(([agent_id, events]) => {
        const sortedEvents = [...events].sort(
          (a, b) => b.issued_at - a.issued_at
        );
        const hasActiveToken = activeConsents.some(
          (c) => c.developer === agent_id
        );

        return {
          agent_id,
          lastActivity: sortedEvents[0]?.issued_at ?? 0,
          totalEvents: events.length,
          hasActiveToken,
          events: sortedEvents,
        };
      })
      .sort((a, b) => b.lastActivity - a.lastActivity);
  }, [auditLog, activeConsents]);

  // Handle row click to open drawer
  const handleRowClick = (app: AppSummary) => {
    setSelectedApp(app);
    setDrawerOpen(true);
  };

  // Format date for drawer
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Connected Apps
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={appColumns}
            data={appSummaries}
            searchPlaceholder="Search by app name..."
            onRowClick={handleRowClick}
          />
        </CardContent>
      </Card>

      {/* Event Trail Drawer */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              {selectedApp?.agent_id}
              {selectedApp?.hasActiveToken && (
                <Badge className="bg-green-500/10 text-green-600 border-green-500/20 ml-2">
                  Active
                </Badge>
              )}
            </DrawerTitle>
            <DrawerDescription>
              {selectedApp?.totalEvents} events • Last activity{" "}
              {selectedApp?.lastActivity
                ? formatDate(selectedApp.lastActivity)
                : "N/A"}
            </DrawerDescription>
          </DrawerHeader>

          <div className="px-4 py-2 max-h-[50vh] overflow-y-auto">
            {/* Group by request trail */}
            {selectedApp?.events &&
              (() => {
                const trails = Object.entries(
                  selectedApp.events.reduce((acc, entry) => {
                    const trailKey = entry.request_id || `single-${entry.id}`;
                    if (!acc[trailKey]) acc[trailKey] = [];
                    acc[trailKey].push(entry);
                    return acc;
                  }, {} as Record<string, AuditLogEntry[]>)
                )
                  .map(([trailId, events]) => ({
                    trailId,
                    events: [...events].sort(
                      (a, b) => a.issued_at - b.issued_at
                    ),
                  }))
                  .sort(
                    (a, b) =>
                      (b.events[0]?.issued_at ?? 0) -
                      (a.events[0]?.issued_at ?? 0)
                  );

                return trails.map(({ trailId, events }) => {
                  const firstEvent = events[0];
                  const lastEvent = events[events.length - 1];

                  // Skip if no events (shouldn't happen but satisfies TypeScript)
                  if (!firstEvent || !lastEvent) return null;

                  const scopeInfo = formatScope(firstEvent.scope);

                  // Status color
                  const statusColor =
                    lastEvent.action === "CONSENT_GRANTED"
                      ? "border-l-green-500"
                      : lastEvent.action === "REVOKED" ||
                        lastEvent.action === "CONSENT_DENIED"
                      ? "border-l-red-500"
                      : lastEvent.is_timed_out
                      ? "border-l-orange-500"
                      : "border-l-yellow-500";

                  return (
                    <div
                      key={trailId}
                      className={`border-l-4 ${statusColor} pl-4 py-3 mb-3 rounded-r-lg bg-muted/20`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline">
                          {scopeInfo.emoji} {scopeInfo.label}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        {events.map((entry) => {
                          const actionInfo = getActionInfo(
                            entry.is_timed_out ? "TIMED_OUT" : entry.action
                          );
                          return (
                            <div
                              key={entry.id}
                              className="flex items-center justify-between text-sm"
                            >
                              <span className="flex items-center gap-2">
                                <span>{actionInfo.emoji}</span>
                                <span className="font-medium">
                                  {actionInfo.label}
                                </span>
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {formatDate(entry.issued_at)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                });
              })()}
          </div>

          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="none" className="cursor-pointer border">
                Close
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}

// Need React for useMemo and useState in AppAuditLog
import * as React from "react";

export default function ConsentsPage() {
  const searchParams = useSearchParams();
  const { vaultKey, isVaultUnlocked } = useVault();
  const [pending, setPending] = useState<PendingConsent[]>([]);
  const [auditLog, setAuditLog] = useState<ConsentAuditEntry[]>([]);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [activeConsents, setActiveConsents] = useState<ActiveConsent[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Tab from URL param (e.g., ?tab=session)
  const tabFromUrl = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(
    tabFromUrl && ["pending", "session", "history"].includes(tabFromUrl)
      ? tabFromUrl
      : "pending"
  );

  const fetchPendingConsents = useCallback(async (uid: string) => {
    try {
      const response = await ApiService.getPendingConsents(uid);
      if (response.ok) {
        const data = await response.json();
        setPending(data.pending || []);
      }
    } catch (err) {
      console.error("Error fetching pending consents:", err);
    }
  }, []);

  const fetchAuditLog = useCallback(async (uid: string) => {
    try {
      const response = await ApiService.getConsentHistory(uid, 1, 50);
      if (response.ok) {
        const data = await response.json();
        console.log("🔍 [AuditLog] Fetched data:", data);
        // Handle various potential response structures
        if (Array.isArray(data)) {
          setAuditLog(data);
        } else if (data.items) {
          setAuditLog(data.items);
        } else if (data.history) {
          setAuditLog(data.history);
        } else {
          setAuditLog([]);
        }
      }
    } catch (err) {
      console.error("Error fetching audit log:", err);
    }
  }, []);

  const fetchActiveConsents = useCallback(async (uid: string) => {
    try {
      const response = await ApiService.getActiveConsents(uid);
      if (response.ok) {
        const data = await response.json();
        setActiveConsents(data.active || []);
      }
    } catch (err) {
      console.error("Error fetching active consents:", err);
    }
  }, []);

  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    async function initSession() {
      // Load session info from platform-aware storage
      const token = await getSessionItem("session_token");
      const expiresAt = await getSessionItem("session_token_expires");
      const uid = await getSessionItem("user_id");

      if (uid) {
        setUserId(uid);

        // Initial fetch
        Promise.all([
          fetchPendingConsents(uid),
          fetchAuditLog(uid),
          fetchActiveConsents(uid),
        ]).finally(() => {
          setLoading(false);
        });
      } else {
        setLoading(false);
      }

      if (token && expiresAt) {
        const expiryTime = parseInt(expiresAt, 10);
        setSession({
          isActive: Date.now() < expiryTime,
          expiresAt: expiryTime,
          token,
          scope: "vault.owner",
        });
      }
    }
    initSession();
  }, [fetchPendingConsents, fetchAuditLog, fetchActiveConsents]);

  // =========================================================================
  // SSE: React to consent events via unified context (no duplicate connection)
  // =========================================================================
  const { lastEvent, eventCount } = useConsentSSE();

  useEffect(() => {
    if (!lastEvent || !userId) return;

    const { action, request_id, scope } = lastEvent;
    console.log(
      `📡 [ConsentsPage] SSE event: ${action} for ${request_id} (${scope})`
    );

    // Debounce 300ms to let DB commit before refreshing
    const timer = setTimeout(() => {
      switch (action) {
        case "REQUESTED":
          // New request - only need to refresh pending
          fetchPendingConsents(userId);
          fetchAuditLog(userId);
          break;
        case "CONSENT_GRANTED":
          // Approval - pending → active, update all
          fetchPendingConsents(userId);
          fetchActiveConsents(userId);
          fetchAuditLog(userId);
          break;
        case "CONSENT_DENIED":
        case "TIMEOUT":
          // Denied/timeout - remove from pending, update audit
          fetchPendingConsents(userId);
          fetchAuditLog(userId);
          break;
        case "REVOKED":
          // Revoke - remove from active, update audit
          fetchActiveConsents(userId);
          fetchAuditLog(userId);
          break;
        default:
          // Any other event - refresh all to be safe
          fetchPendingConsents(userId);
          fetchActiveConsents(userId);
          fetchAuditLog(userId);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [
    lastEvent,
    eventCount,
    userId,
    fetchPendingConsents,
    fetchAuditLog,
    fetchActiveConsents,
  ]);

  // =========================================================================
  // Listen for consent action events from notification toast actions
  // =========================================================================
  useEffect(() => {
    const handleConsentAction = (event: Event) => {
      const customEvent = event as CustomEvent<{
        action: string;
        requestId: string;
      }>;
      console.log(
        `📡 [ConsentsPage] Action event: ${customEvent.detail.action}`
      );

      if (!userId) return;

      // Refresh all tables after action
      fetchPendingConsents(userId);
      fetchActiveConsents(userId);
      fetchAuditLog(userId);
    };

    window.addEventListener("consent-action-complete", handleConsentAction);
    return () =>
      window.removeEventListener(
        "consent-action-complete",
        handleConsentAction
      );
  }, [userId, fetchPendingConsents, fetchActiveConsents, fetchAuditLog]);

  // =========================================================================
  // Unified Actions Hook (Native Compatible)
  // =========================================================================
  const refreshAll = useCallback(() => {
    if (userId) {
      Promise.all([
        fetchPendingConsents(userId),
        fetchActiveConsents(userId),
        fetchAuditLog(userId),
      ]);
    }
  }, [userId, fetchPendingConsents, fetchActiveConsents, fetchAuditLog]);

  const {
    handleApprove: hookApprove,
    handleDeny: hookDeny,
    handleRevoke: hookRevoke,
  } = useConsentActions({
    onActionComplete: refreshAll,
  });

  const handleApprove = async (requestId: string) => {
    const pendingRequest = pending.find((p) => p.id === requestId);
    if (!pendingRequest) {
      toast.error("Request not found");
      return;
    }
    setActionLoading(requestId);
    try {
      await hookApprove(pendingRequest);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeny = async (requestId: string) => {
    setActionLoading(requestId);
    try {
      await hookDeny(requestId);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevoke = async (scope: string) => {
    setActionLoading(`revoke-${scope}`);
    try {
      await hookRevoke(scope);
    } finally {
      setActionLoading(null);
    }
  };

  const getTimeRemaining = (expiresAt: number): string => {
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) return "Expired";

    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString();
  };

  const getScopeColor = (scope: string): string => {
    if (scope.includes("food"))
      return "bg-orange-500/10 text-orange-600 border-orange-500/20";
    if (scope.includes("professional"))
      return "bg-blue-500/10 text-blue-600 border-blue-500/20";
    if (scope.includes("finance"))
      return "bg-green-500/10 text-green-600 border-green-500/20";
    if (scope.includes("all"))
      return "bg-purple-500/10 text-purple-600 border-purple-500/20";
    return "bg-gray-500/10 text-gray-600 border-gray-500/20";
  };

  // User-friendly action labels with colors
  const getActionInfo = (
    action: string
  ): { label: string; emoji: string; className: string } => {
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

  // Human-readable scope labels with emojis
  const formatScope = (
    scope: string
  ): { emoji: string; label: string; description: string } => {
    const scopeMap: Record<
      string,
      { emoji: string; label: string; description: string }
    > = {
      // API format (underscores)
      vault_read_food: {
        emoji: "🍽️",
        label: "Food Preferences",
        description: "Dietary restrictions, cuisines, and dining budget",
      },
      vault_read_professional: {
        emoji: "💼",
        label: "Professional Profile",
        description: "Job title, skills, and career preferences",
      },
      vault_read_finance: {
        emoji: "💰",
        label: "Financial Data",
        description: "Budget and spending preferences",
      },
      vault_write_food: {
        emoji: "🍽️",
        label: "Save Food Preferences",
        description: "Store your dietary and cuisine preferences",
      },
      vault_write_professional: {
        emoji: "💼",
        label: "Save Professional Profile",
        description: "Store your career data",
      },
      "vault.owner": {
        emoji: "👑",
        label: "Owner Access",
        description: "Full control (You)",
      },
      // Dot format (from MCP)
      "vault.read.food": {
        emoji: "🍽️",
        label: "Food Preferences",
        description: "Dietary restrictions, cuisines, and dining budget",
      },
      "vault.read.professional": {
        emoji: "💼",
        label: "Professional Profile",
        description: "Job title, skills, and career preferences",
      },
    };

    return (
      scopeMap[scope] || {
        emoji: "🔐",
        label: scope
          .replace(/[_\.]/g, " ")
          .replace("vault read ", "")
          .replace("vault write ", ""),
        description: `Access: ${scope}`,
      }
    );
  };

  if (loading) {
    return <HushhLoader label="Loading consents..." />;
  }

  return (
    <div className="container mx-auto max-w-4xl py-6 px-4 md:px-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-r from-[var(--morphy-primary-start)] to-[var(--morphy-primary-end)]">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Consent Management</h1>
            <p className="text-muted-foreground">
              Control who can access your data
            </p>
          </div>
        </div>
        <Button
          variant="none"
          size="sm"
          onClick={() => {
            if (userId) {
              fetchPendingConsents(userId);
              fetchAuditLog(userId);
              fetchActiveConsents(userId);
              toast.success("Refreshed", { duration: 1500 });
            }
          }}
          className="flex items-center gap-2 border"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger
            value="pending"
            className="flex items-center gap-2 cursor-pointer"
          >
            <Bell className="h-4 w-4" />
            Pending
            {pending.length > 0 && (
              <Badge
                variant="destructive"
                className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
              >
                {pending.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="session"
            className="flex items-center gap-2 cursor-pointer"
          >
            <Key className="h-4 w-4" />
            Session
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="flex items-center gap-2 cursor-pointer"
          >
            <History className="h-4 w-4" />
            Audit Log
          </TabsTrigger>
        </TabsList>

        {/* Pending Requests Tab */}
        <TabsContent value="pending" className="space-y-4 mt-4">
          {pending.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Bell className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold">No Pending Requests</h3>
                <p className="text-muted-foreground mt-2">
                  When developers request access to your data, it will appear
                  here.
                </p>
              </CardContent>
            </Card>
          ) : (
            pending.map((request) => (
              <Card key={request.id} className="border-l-4 border-l-yellow-500">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        {request.developer}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Requested{" "}
                        {new Date(request.requestedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge className={getScopeColor(request.scope)}>
                      {formatScope(request.scope).emoji}{" "}
                      {formatScope(request.scope).label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-sm font-medium">Requesting access to:</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {request.scopeDescription ||
                        formatScope(request.scope).description}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    Access valid for {request.expiryHours} hours if approved
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button
                      onClick={() => handleApprove(request.id)}
                      variant="gradient"
                      className="flex-1 cursor-pointer"
                      disabled={actionLoading === request.id}
                    >
                      {actionLoading === request.id ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4 mr-2" />
                      )}
                      Approve
                    </Button>
                    <Button
                      onClick={() => handleDeny(request.id)}
                      variant="none"
                      className="flex-1 border border-destructive text-destructive hover:bg-destructive/10"
                      disabled={actionLoading === request.id}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Deny
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Active Session Tab */}
        <TabsContent value="session" className="space-y-4 mt-4">
          {/* 1. Owner Session Card */}
          {session && (
            <Card className="border-l-4 border-l-purple-500 bg-purple-500/5">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Key className="h-5 w-5 text-purple-600" />
                      Owner Session
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Authenticated via verified request
                    </p>
                  </div>
                  <Badge className={getScopeColor(session.scope)}>
                    {formatScope(session.scope).emoji}{" "}
                    {formatScope(session.scope).label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-background/50">
                    <p className="text-xs text-muted-foreground">
                      Time Remaining
                    </p>
                    <p className="text-lg font-semibold flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {session.expiresAt
                        ? getTimeRemaining(session.expiresAt)
                        : "N/A"}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-background/50">
                    <p className="text-xs text-muted-foreground">Expires At</p>
                    <p className="text-sm font-medium">
                      {session.expiresAt
                        ? new Date(session.expiresAt).toLocaleTimeString()
                        : "N/A"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 2. Active External Consents */}
          {activeConsents.length > 0 ? (
            <div className="space-y-4">
              {activeConsents.map((consent, index) => {
                const scopeInfo = formatScope(consent.scope);
                const timeRemaining = consent.expires_at
                  ? getTimeRemaining(consent.expires_at)
                  : "N/A";

                return (
                  <Card
                    key={`${consent.scope}-${index}`}
                    className="border-l-4 border-l-green-500"
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                            Active Consent
                          </CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {consent.developer || "External Developer"}
                          </p>
                        </div>
                        <Badge className={getScopeColor(consent.scope)}>
                          {scopeInfo.emoji} {scopeInfo.label}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="p-3 rounded-lg bg-muted/50">
                        <p className="text-sm text-muted-foreground">
                          {scopeInfo.description}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 rounded-lg bg-muted/50">
                          <p className="text-xs text-muted-foreground">
                            Time Remaining
                          </p>
                          <p className="text-lg font-semibold flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            {timeRemaining}
                          </p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/50">
                          <p className="text-xs text-muted-foreground">
                            Expires At
                          </p>
                          <p className="text-sm font-medium">
                            {consent.expires_at
                              ? new Date(consent.expires_at).toLocaleString()
                              : "N/A"}
                          </p>
                        </div>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/50">
                        <p className="text-xs text-muted-foreground">
                          Granted At
                        </p>
                        <p className="text-sm font-medium">
                          {consent.issued_at
                            ? new Date(consent.issued_at).toLocaleString()
                            : "N/A"}
                        </p>
                      </div>
                      <Button
                        variant="none"
                        onClick={() => handleRevoke(consent.scope)}
                        disabled={actionLoading === `revoke-${consent.scope}`}
                        className="w-full border border-destructive text-destructive hover:bg-destructive/10 cursor-pointer"
                      >
                        <Ban className="h-4 w-4 mr-2" />
                        {actionLoading === `revoke-${consent.scope}`
                          ? "Revoking..."
                          : "Revoke Access"}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            !session && (
              <Card>
                <CardContent className="py-12 text-center">
                  <Key className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-semibold">No Active Sessions</h3>
                  <p className="text-muted-foreground mt-2">
                    Unlock your vault to start a session.
                  </p>
                </CardContent>
              </Card>
            )
          )}
        </TabsContent>

        {/* Audit Log Tab */}
        <TabsContent value="history" className="space-y-4 mt-4">
          {auditLog.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <History className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold">No Audit History</h3>
                <p className="text-muted-foreground mt-2">
                  Consent actions will be recorded here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <AppAuditLog
              auditLog={auditLog as unknown as AuditLogEntry[]}
              activeConsents={activeConsents}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
