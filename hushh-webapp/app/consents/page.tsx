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
  Clipboard,
  Lock,
  FileText,
  Activity,
  Utensils,
  Briefcase,
  Wallet,
  Crown,
  LineChart,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/lib/morphy-ux/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useVault } from "@/lib/vault/vault-context";
import { useConsentSSE } from "@/lib/consent";
import { ApiService, getApiBaseUrl } from "@/lib/services/api-service";
import { CacheService, CACHE_KEYS, CACHE_TTL } from "@/lib/services/cache-service";
import { getSessionItem } from "@/lib/utils/session-storage";
import { useConsentActions } from "@/lib/consent";
import { DataTable } from "@/components/ui/data-table";
import {
  appColumns,
  AppSummary,
  AuditLogEntry,
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
import { useStepProgress } from "@/lib/progress/step-progress-context";

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

// ============================================================================
// MODULE-LEVEL HELPER FUNCTIONS (used by multiple components)
// ============================================================================

// Icon renderer helper (replaces emojis)
const renderIcon = (iconName: string, className: string = "h-4 w-4") => {
  const iconMap: Record<string, React.ReactNode> = {
    clipboard: <Clipboard className={className} />,
    check: <Check className={className} />,
    x: <X className={className} />,
    ban: <Ban className={className} />,
    clock: <Clock className={className} />,
    lock: <Lock className={className} />,
    "file-text": <FileText className={className} />,
    activity: <Activity className={className} />,
    utensils: <Utensils className={className} />,
    briefcase: <Briefcase className={className} />,
    wallet: <Wallet className={className} />,
    crown: <Crown className={className} />,
    "line-chart": <LineChart className={className} />,
  };
  return iconMap[iconName] || <FileText className={className} />;
};

// User-friendly action labels with colors (no emojis)
const getActionInfoLocal = (
  action: string
): { label: string; icon: string; className: string } => {
  const actionMap: Record<
    string,
    { label: string; icon: string; className: string }
  > = {
    REQUESTED: {
      label: "Access Requested",
      icon: "clipboard",
      className: "bg-orange-500/10 text-orange-600 border-orange-500/20",
    },
    CONSENT_GRANTED: {
      label: "Access Granted",
      icon: "check",
      className: "bg-green-500/10 text-green-600 border-green-500/20",
    },
    CONSENT_DENIED: {
      label: "Access Denied",
      icon: "x",
      className: "bg-red-500/10 text-red-600 border-red-500/20",
    },
    CANCELLED: {
      label: "Request Cancelled",
      icon: "ban",
      className: "bg-gray-500/10 text-gray-600 border-gray-500/20",
    },
    TIMED_OUT: {
      label: "Request Expired",
      icon: "clock",
      className: "bg-orange-500/10 text-orange-600 border-orange-500/20",
    },
    REVOKED: {
      label: "Access Revoked",
      icon: "lock",
      className: "bg-red-500/10 text-red-600 border-red-500/20",
    },
    OPERATION_PERFORMED: {
      label: "Operation",
      icon: "activity",
      className: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    },
  };
  return (
    actionMap[action] || {
      label: action,
      icon: "file-text",
      className: "bg-gray-500/10 text-gray-600",
    }
  );
};

// Human-readable scope labels (no emojis)
const formatScopeLocal = (
  scope: string
): { icon: string; label: string; description: string } => {
  const scopeMap: Record<
    string,
    { icon: string; label: string; description: string }
  > = {
    // API format (underscores)
    vault_read_finance: {
      icon: "wallet",
      label: "Financial Data",
      description: "Budget and spending preferences",
    },
    "vault.owner": {
      icon: "crown",
      label: "Owner Access",
      description: "Full control (You)",
    },
    // Dot format (from MCP)
    "vault.read.finance": {
      icon: "wallet",
      label: "Financial Data",
      description: "Investment preferences and financial data",
    },
    "agent.kai.analyze": {
      icon: "line-chart",
      label: "Kai Analysis",
      description: "Investment analysis operations",
    },
  };

  return (
    scopeMap[scope] || {
      icon: "lock",
      label: scope
        .replace(/[_\.]/g, " ")
        .replace("vault read ", "")
        .replace("vault write ", ""),
      description: `Access: ${scope}`,
    }
  );
};

// ============================================================================

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

                  const scopeInfo = formatScopeLocal(firstEvent.scope);

                  // Status color
                  const statusColor =
                    lastEvent.action === "CONSENT_GRANTED"
                      ? "border-l-green-500"
                      : lastEvent.action === "REVOKED" ||
                        lastEvent.action === "CONSENT_DENIED"
                      ? "border-l-red-500"
                      : lastEvent.is_timed_out
                      ? "border-l-orange-500"
                      : "border-l-orange-500";

                  return (
                    <div
                      key={trailId}
                      className={`border-l-4 ${statusColor} px-4 py-3 mb-3 bg-muted/20`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="flex items-center gap-1">
                          {renderIcon(scopeInfo.icon)} {scopeInfo.label}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        {events.map((entry) => {
                          const actionInfo = getActionInfoLocal(
                            entry.is_timed_out ? "TIMED_OUT" : entry.action
                          );
                          return (
                            <div
                              key={entry.id}
                              className="flex items-center justify-between text-sm"
                            >
                              <span className="flex items-center gap-2">
                                {renderIcon(actionInfo.icon)}
                                <span className="font-medium">
                                  {actionInfo.label}
                                </span>
                                {/* Show operation details for vault.owner operations */}
                                {entry.action === "OPERATION_PERFORMED" && (entry.scope_description || entry.metadata?.operation) && (
                                  <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                    {entry.scope_description || entry.metadata?.operation}
                                    {entry.metadata?.target && ` → ${entry.metadata.target}`}
                                  </span>
                                )}
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
  const { vaultKey, isVaultUnlocked, vaultOwnerToken } = useVault();
  const [pending, setPending] = useState<PendingConsent[]>([]);
  const [auditLog, setAuditLog] = useState<ConsentAuditEntry[]>([]);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [activeConsents, setActiveConsents] = useState<ActiveConsent[]>([]);
  const [loading, setLoading] = useState(true);
  const { registerSteps, completeStep, reset } = useStepProgress();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Tab from URL param (e.g., ?tab=session)
  const tabFromUrl = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(
    tabFromUrl && ["pending", "session", "history"].includes(tabFromUrl)
      ? tabFromUrl
      : "pending"
  );

  const fetchPendingConsents = useCallback(async (uid: string, forceRefresh = false) => {
    const cache = CacheService.getInstance();
    const cacheKey = CACHE_KEYS.PENDING_CONSENTS(uid);
    
    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = cache.get<PendingConsent[]>(cacheKey);
      if (cached) {
        setPending(cached);
        return;
      }
    }
    
    try {
      const response = await ApiService.getPendingConsents(uid);
      if (response.ok) {
        const data = await response.json();
        const pendingData = data.pending || [];
        setPending(pendingData);
        cache.set(cacheKey, pendingData, CACHE_TTL.SHORT);
      }
    } catch (err) {
      console.error("Error fetching pending consents:", err);
    }
  }, []);

  const fetchAuditLog = useCallback(async (uid: string, forceRefresh = false) => {
    const cache = CacheService.getInstance();
    const cacheKey = CACHE_KEYS.CONSENT_AUDIT_LOG(uid);
    
    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = cache.get<ConsentAuditEntry[]>(cacheKey);
      if (cached) {
        setAuditLog(cached);
        return;
      }
    }
    
    try {
      const response = await ApiService.getConsentHistory(uid, 1, 50);
      if (response.ok) {
        const data = await response.json();
        let auditData: ConsentAuditEntry[] = [];
        // Handle various potential response structures
        if (Array.isArray(data)) {
          auditData = data;
        } else if (data.items) {
          auditData = data.items;
        } else if (data.history) {
          auditData = data.history;
        }
        setAuditLog(auditData);
        cache.set(cacheKey, auditData, CACHE_TTL.SHORT);
      }
    } catch (err) {
      console.error("Error fetching audit log:", err);
    }
  }, []);

  const fetchActiveConsents = useCallback(async (uid: string, token: string, forceRefresh = false) => {
    if (!token) return;
    
    const cache = CacheService.getInstance();
    const cacheKey = CACHE_KEYS.ACTIVE_CONSENTS(uid);
    
    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = cache.get<ActiveConsent[]>(cacheKey);
      if (cached) {
        setActiveConsents(cached);
        return;
      }
    }
    
    try {
      const response = await ApiService.getActiveConsents(uid, token);
      if (response.ok) {
        const data = await response.json();
        const activeData = data.active || [];
        setActiveConsents(activeData);
        cache.set(cacheKey, activeData, CACHE_TTL.SHORT);
      }
    } catch (err) {
      console.error("Error fetching active consents:", err);
    }
  }, []);

  const { user, isAuthenticated, loading: authLoading } = useAuth();

  // Consolidated init effect - cache-first then background refresh
  useEffect(() => {
    let cancelled = false;

    async function initSession() {
      // Wait for auth to finish loading
      if (authLoading) return;

      // Register steps only once
      if (!initialized) {
        registerSteps(3);
        setInitialized(true);
      }

      // Step 1: Auth check
      completeStep();

      // Load session info from platform-aware storage
      const token = await getSessionItem("session_token");
      const expiresAt = await getSessionItem("session_token_expires");
      const uid = await getSessionItem("user_id");

      if (cancelled) return;

      if (uid) {
        setUserId(uid);
        const effectiveToken = token || vaultOwnerToken || "";

        // Cache-first: show cached data immediately so UI renders without waiting
        const cache = CacheService.getInstance();
        const cachedPending = cache.get<PendingConsent[]>(CACHE_KEYS.PENDING_CONSENTS(uid));
        const cachedAudit = cache.get<ConsentAuditEntry[]>(CACHE_KEYS.CONSENT_AUDIT_LOG(uid));
        const cachedActive = effectiveToken
          ? cache.get<ActiveConsent[]>(CACHE_KEYS.ACTIVE_CONSENTS(uid))
          : null;
        if (cachedPending) setPending(cachedPending);
        if (cachedAudit) setAuditLog(cachedAudit);
        if (cachedActive) setActiveConsents(cachedActive);
        const hasAnyCache = !!(cachedPending || cachedAudit || cachedActive);
        
        if (hasAnyCache && !cancelled) {
          // Cache hit: complete all remaining steps immediately so progress bar hides
          setLoading(false);
          completeStep(); // Step 2
          completeStep(); // Step 3
        }

        // Session state from storage
        if (token && expiresAt) {
          const expiryTime = parseInt(expiresAt, 10);
          setSession({
            isActive: Date.now() < expiryTime,
            expiresAt: expiryTime,
            token,
            scope: "vault.owner",
          });
        }

        // Background refresh (forceRefresh) to get latest data - silent when cache was used
        try {
          await fetchPendingConsents(uid, true);
          if (!cancelled && !hasAnyCache) completeStep();
          await Promise.all([
            fetchAuditLog(uid, true),
            ...(effectiveToken ? [fetchActiveConsents(uid, effectiveToken, true)] : []),
          ]);
          if (!cancelled && !hasAnyCache) completeStep();
        } catch (error) {
          console.error("Error loading consents:", error);
          if (!cancelled && !hasAnyCache) {
            completeStep();
            completeStep();
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      } else {
        completeStep();
        completeStep();
        setLoading(false);
      }
    }

    initSession();

    return () => {
      cancelled = true;
      reset();
    };
  }, [authLoading, vaultOwnerToken]);

  // =========================================================================
  // SSE: React to consent events via unified context (no duplicate connection)
  // =========================================================================
  const { lastEvent, eventCount } = useConsentSSE();

  useEffect(() => {
    if (!lastEvent || !userId) return;

    const { action, request_id, scope } = lastEvent;
    
    // Use token from session state or vault context
    const effectiveToken = session?.token || vaultOwnerToken || "";

    console.log(
      `📡 [ConsentsPage] SSE event: ${action} for ${request_id} (${scope})`
    );

    // Debounce 300ms to let DB commit before refreshing
    const timer = setTimeout(() => {
      // SSE events should force refresh to get latest data
      switch (action) {
        case "REQUESTED":
          // New request - only need to refresh pending
          fetchPendingConsents(userId, true);
          fetchAuditLog(userId, true);
          break;
        case "CONSENT_GRANTED":
          // Approval - pending → active, update all
          fetchPendingConsents(userId, true);
          if (effectiveToken) fetchActiveConsents(userId, effectiveToken, true);
          fetchAuditLog(userId, true);
          break;
        case "CONSENT_DENIED":
        case "TIMEOUT":
          // Denied/timeout - remove from pending, update audit
          fetchPendingConsents(userId, true);
          fetchAuditLog(userId, true);
          break;
        case "REVOKED":
          // Revoke - remove from active, update audit
          if (effectiveToken) fetchActiveConsents(userId, effectiveToken, true);
          fetchAuditLog(userId, true);

          // If VAULT_OWNER was revoked via SSE (e.g., from another tab), lock vault
          if (scope === "vault.owner" || scope === "VAULT_OWNER") {
            console.log(
              "🔒 [SSE] VAULT_OWNER revoked - dispatching lock event"
            );
            window.dispatchEvent(
              new CustomEvent("vault-lock-requested", {
                detail: { reason: "VAULT_OWNER token revoked (SSE)" },
              })
            );
          }
          break;
        default:
          // Any other event - refresh all to be safe
          fetchPendingConsents(userId, true);
          if (effectiveToken) fetchActiveConsents(userId, effectiveToken, true);
          fetchAuditLog(userId, true);
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
    session?.token,
    vaultOwnerToken
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
      const effectiveToken = session?.token || vaultOwnerToken || "";

      // Refresh all tables after action (force refresh)
      fetchPendingConsents(userId, true);
      if (effectiveToken) fetchActiveConsents(userId, effectiveToken, true);
      fetchAuditLog(userId, true);
    };

    window.addEventListener("consent-action-complete", handleConsentAction);
    return () =>
      window.removeEventListener(
        "consent-action-complete",
        handleConsentAction
      );
  }, [userId, fetchPendingConsents, fetchActiveConsents, fetchAuditLog, session?.token, vaultOwnerToken]);

  // =========================================================================
  // Unified Actions Hook (Native Compatible)
  // =========================================================================
  const refreshAll = useCallback(() => {
    if (userId) {
      const effectiveToken = session?.token || vaultOwnerToken || "";
      // Force refresh after actions
      const promises: Promise<any>[] = [
        fetchPendingConsents(userId, true),
        fetchAuditLog(userId, true),
      ];
      
      if (effectiveToken) {
        promises.push(fetchActiveConsents(userId, effectiveToken, true));
      }
      
      Promise.all(promises);
    }
  }, [userId, fetchPendingConsents, fetchActiveConsents, fetchAuditLog, session?.token, vaultOwnerToken]);


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
    if (scope.includes("finance"))
      return "bg-green-500/10 text-green-600 border-green-500/20";
    if (scope.includes("all"))
      return "bg-purple-500/10 text-purple-600 border-purple-500/20";
    return "bg-gray-500/10 text-gray-600 border-gray-500/20";
  };

  if (loading) {
    return null;
  }

  return (
    <div className="container mx-auto max-w-4xl py-6 px-4 md:px-6 space-y-6 pb-28">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-linear-to-r from-(--morphy-primary-start) to-(--morphy-primary-end)">
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
              const effectiveToken = session?.token || vaultOwnerToken || "";
              // Force refresh to bypass cache
              fetchPendingConsents(userId, true);
              fetchAuditLog(userId, true);
              if (effectiveToken) {
                fetchActiveConsents(userId, effectiveToken, true);
              }
              toast.success("Refreshed", { duration: 1500 });
            }
          }}
          className="flex items-center gap-2 border p-2 md:px-4"
          title="Refresh"
        >
          <RefreshCw className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Refresh</span>
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
              <Card key={request.id} className="border-l-4 border-l-orange-500">
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
                    <Badge className={`${getScopeColor(request.scope)} flex items-center gap-1`}>
                      {renderIcon(formatScopeLocal(request.scope).icon)}
                      {formatScopeLocal(request.scope).label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-sm font-medium">Requesting access to:</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {request.scopeDescription ||
                        formatScopeLocal(request.scope).description}
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
                  <Badge className={`${getScopeColor(session.scope)} flex items-center gap-1`}>
                    {renderIcon(formatScopeLocal(session.scope).icon)}
                    {formatScopeLocal(session.scope).label}
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
                const scopeInfo = formatScopeLocal(consent.scope);
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
                        <Badge className={`${getScopeColor(consent.scope)} flex items-center gap-1`}>
                          {renderIcon(scopeInfo.icon)} {scopeInfo.label}
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
