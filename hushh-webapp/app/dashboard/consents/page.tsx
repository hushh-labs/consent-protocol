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
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

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

export default function ConsentsPage() {
  const [pending, setPending] = useState<PendingConsent[]>([]);
  const [auditLog, setAuditLog] = useState<ConsentAuditEntry[]>([]);
  const [activeConsents, setActiveConsents] = useState<ActiveConsent[]>([]);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const fetchPendingConsents = useCallback(async (uid: string) => {
    try {
      const response = await fetch(`/api/consent/pending?userId=${uid}`);
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
      const response = await fetch(
        `/api/consent/history?userId=${uid}&page=1&limit=50`
      );
      if (response.ok) {
        const data = await response.json();
        setAuditLog(data.items || []);
      }
    } catch (err) {
      console.error("Error fetching audit log:", err);
    }
  }, []);

  const fetchActiveConsents = useCallback(async (uid: string) => {
    try {
      const response = await fetch(`/api/consent/active?userId=${uid}`);
      if (response.ok) {
        const data = await response.json();
        setActiveConsents(data.active || []);
      }
    } catch (err) {
      console.error("Error fetching active consents:", err);
    }
  }, []);

  useEffect(() => {
    // Load session info from sessionStorage
    const token = sessionStorage.getItem("session_token");
    const expiresAt = sessionStorage.getItem("session_token_expires");
    const uid = sessionStorage.getItem("user_id");

    if (uid) {
      setUserId(uid);

      // Initial fetch - set loading false after complete
      Promise.all([
        fetchPendingConsents(uid),
        fetchAuditLog(uid),
        fetchActiveConsents(uid),
      ]).finally(() => {
        setLoading(false);
      });

      // Auto-poll every 5 seconds for real-time updates
      const pollInterval = setInterval(() => {
        fetchPendingConsents(uid);
        fetchAuditLog(uid);
        fetchActiveConsents(uid);
      }, 5000);

      // Cleanup interval on unmount
      return () => clearInterval(pollInterval);
    }

    if (token && expiresAt) {
      const expiryTime = parseInt(expiresAt, 10);
      setSession({
        isActive: Date.now() < expiryTime,
        expiresAt: expiryTime,
        token,
        scope: "vault.read.all",
      });
    }

    // No user ID, stop loading
    setLoading(false);
  }, [fetchPendingConsents, fetchAuditLog]);

  const handleApprove = async (requestId: string) => {
    if (!userId) return;
    setActionLoading(requestId);

    try {
      // Find the pending request to get scope
      const pendingRequest = pending.find((p) => p.id === requestId);
      if (!pendingRequest) {
        console.error("Pending request not found");
        return;
      }

      // Get vault key from session storage
      const vaultKey = sessionStorage.getItem("vault_key");
      if (!vaultKey) {
        console.error("Vault key not found - user must unlock vault first");
        return;
      }

      // Fetch the scope data from vault
      const scopeDataEndpoint = getScopeDataEndpoint(pendingRequest.scope);
      let scopeData: Record<string, unknown> = {};

      if (scopeDataEndpoint) {
        console.log(
          `[Consent] Fetching data from: ${scopeDataEndpoint}?userId=${userId}`
        );
        const dataResponse = await fetch(
          `${scopeDataEndpoint}?userId=${userId}`
        );

        if (dataResponse.ok) {
          const data = await dataResponse.json();
          console.log("[Consent] Vault response:", Object.keys(data));

          // Decrypt the data with vault key
          const { decryptData } = await import("@/lib/vault/encrypt");
          const decryptedFields: Record<string, unknown> = {};

          // Handle object format: { field_name: { ciphertext, iv, tag, algorithm, encoding } }
          const preferences = data.preferences || data.data || {};

          if (
            preferences &&
            typeof preferences === "object" &&
            !Array.isArray(preferences)
          ) {
            // Object format (actual vault data)
            for (const [fieldName, encryptedField] of Object.entries(
              preferences
            )) {
              try {
                const field = encryptedField as {
                  ciphertext: string;
                  iv: string;
                  tag: string;
                  algorithm?: string;
                  encoding?: string;
                };
                const decrypted = await decryptData(
                  {
                    ciphertext: field.ciphertext,
                    iv: field.iv,
                    tag: field.tag,
                    encoding: (field.encoding || "base64") as "base64",
                    algorithm: (field.algorithm ||
                      "aes-256-gcm") as "aes-256-gcm",
                  },
                  vaultKey
                );
                decryptedFields[fieldName] = JSON.parse(decrypted);
              } catch (err) {
                console.warn(`Failed to decrypt field: ${fieldName}`, err);
              }
            }
          } else if (Array.isArray(preferences)) {
            // Array format (legacy)
            for (const field of preferences) {
              try {
                const decrypted = await decryptData(
                  {
                    ciphertext: field.ciphertext,
                    iv: field.iv,
                    tag: field.tag,
                    encoding: "base64",
                    algorithm: "aes-256-gcm",
                  },
                  vaultKey
                );
                decryptedFields[field.field_name] = JSON.parse(decrypted);
              } catch {
                console.warn(`Failed to decrypt field: ${field.field_name}`);
              }
            }
          }

          scopeData = decryptedFields;
          console.log("[Consent] Decrypted fields:", Object.keys(scopeData));
        } else {
          console.error(
            "[Consent] Failed to fetch scope data:",
            dataResponse.status
          );
        }
      }

      // Generate export key and encrypt the scope data
      const { generateExportKey, encryptForExport } = await import(
        "@/lib/vault/export-encrypt"
      );
      const exportKey = await generateExportKey();
      const encrypted = await encryptForExport(
        JSON.stringify(scopeData),
        exportKey
      );

      console.log("[Consent] Sending approval request...");

      // Send to server with encrypted data and export key
      const response = await fetch("/api/consent/pending/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          requestId,
          exportKey, // Server will embed this in token
          encryptedData: encrypted.ciphertext,
          encryptedIv: encrypted.iv,
          encryptedTag: encrypted.tag,
        }),
      });

      if (response.ok) {
        console.log("[Consent] ✅ Consent approved successfully");
        toast.success("Consent Approved", {
          description: "The application can now access your data securely.",
        });
        await fetchPendingConsents(userId);
        await fetchAuditLog(userId);
      } else {
        const errorText = await response.text();
        console.error("[Consent] Failed to approve consent:", errorText);
        toast.error("Approval Failed", {
          description: errorText || "Server error occurred",
        });
      }
    } catch (err) {
      console.error("[Consent] Error approving consent:", err);
      toast.error("Network Error", {
        description: err instanceof Error ? err.message : "Connection failed",
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Map scope to data endpoint
  const getScopeDataEndpoint = (scope: string): string | null => {
    const scopeMap: Record<string, string> = {
      vault_read_food: "/api/vault/food",
      vault_read_professional: "/api/vault/professional",
      vault_read_finance: "/api/vault/finance",
    };
    return scopeMap[scope] || null;
  };

  const handleDeny = async (requestId: string) => {
    if (!userId) return;
    setActionLoading(requestId);

    try {
      const response = await fetch("/api/consent/pending/deny", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, requestId }),
      });

      if (response.ok) {
        toast.info("Access Denied", {
          description: "The consent request has been rejected.",
        });
        await fetchPendingConsents(userId);
        await fetchAuditLog(userId);
      } else {
        toast.error("Failed to deny consent");
      }
    } catch (err) {
      console.error("Error denying consent:", err);
      toast.error("Network error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevoke = async (scope: string) => {
    if (!userId) return;
    setActionLoading(scope);

    try {
      const response = await fetch("/api/consent/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, scope }),
      });

      if (response.ok) {
        toast.success("Access Revoked", {
          description: "The application can no longer access your data.",
        });
        await fetchActiveConsents(userId);
        await fetchAuditLog(userId);
      } else {
        toast.error("Failed to revoke access");
      }
    } catch (err) {
      console.error("Error revoking consent:", err);
      toast.error("Network error");
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
      vault_read_all: {
        emoji: "🔓",
        label: "All Data Access",
        description: "Full vault access (admin)",
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
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl py-6 space-y-6">
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
          onClick={() => {
            if (userId) {
              fetchPendingConsents(userId);
              fetchAuditLog(userId);
            }
          }}
          variant="none"
          size="sm"
          className="text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Pending
            {pending.length > 0 && (
              <Badge variant="destructive" className="ml-1">
                {pending.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="session" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            Session
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
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
                      className="flex-1"
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

        {/* Active Sessions Tab - Shows granted consent tokens */}
        <TabsContent value="session" className="space-y-4 mt-4">
          {activeConsents.length > 0 ? (
            <div className="space-y-4">
              {activeConsents.map((consent) => {
                const scopeInfo = formatScope(consent.scope);
                return (
                  <Card
                    key={consent.id}
                    className="border-l-4 border-l-green-500"
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{scopeInfo.emoji}</span>
                          <div>
                            <CardTitle className="text-lg">
                              {scopeInfo.label}
                            </CardTitle>
                            <p className="text-sm text-muted-foreground">
                              {scopeInfo.description}
                            </p>
                          </div>
                        </div>
                        <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                          Active
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 rounded-lg bg-muted/50">
                          <p className="text-xs text-muted-foreground">
                            Time Remaining
                          </p>
                          <p className="text-lg font-semibold flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            {getTimeRemaining(consent.expires_at)}
                          </p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/50">
                          <p className="text-xs text-muted-foreground">
                            Expires At
                          </p>
                          <p className="text-sm font-medium">
                            {new Date(consent.expires_at).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-muted/50">
                        <p className="text-xs text-muted-foreground">
                          Token ID
                        </p>
                        <p className="text-xs font-mono truncate">
                          {consent.id}
                        </p>
                      </div>

                      <Button
                        onClick={() => handleRevoke(consent.scope)}
                        variant="none"
                        className="w-full border border-destructive text-destructive hover:bg-destructive/10"
                        disabled={actionLoading === consent.scope}
                      >
                        {actionLoading === consent.scope ? (
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <X className="h-4 w-4 mr-2" />
                        )}
                        Revoke Access
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : session ? (
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-blue-500" />
                  Vault Session Active
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Authenticated via passphrase
                </p>
              </CardHeader>
              <CardContent>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">
                    No app consent tokens issued yet.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Key className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold">No Active Sessions</h3>
                <p className="text-muted-foreground mt-2">
                  Approve a consent request to grant app access.
                </p>
              </CardContent>
            </Card>
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
            <div className="space-y-3">
              {auditLog.map((entry) => {
                const actionInfo = getActionInfo(entry.action);
                const scopeInfo = formatScope(entry.scope);
                return (
                  <Card key={entry.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <span className="text-xl">{scopeInfo.emoji}</span>
                        <div>
                          <p className="font-medium flex items-center gap-2">
                            <span>{actionInfo.emoji}</span>
                            {actionInfo.label}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {scopeInfo.label}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDate(entry.issued_at)}
                          </p>
                        </div>
                      </div>
                      <Badge className={actionInfo.className}>
                        {actionInfo.label.split(" ")[1]}
                      </Badge>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
