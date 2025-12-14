"use client";

/**
 * Consent Management Dashboard
 *
 * Shows:
 * 1. Pending consent requests from developers
 * 2. Already granted consents with option to revoke
 */

import { useState, useEffect } from "react";
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
  Info,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

interface ConsentRequest {
  id: string;
  developer: string;
  scope: string;
  scopeDescription: string;
  requestedAt: string;
  expiryHours: number;
  status: "pending" | "granted" | "denied";
}

// Mock data - in production this comes from the backend
const MOCK_PENDING: ConsentRequest[] = [
  {
    id: "req-001",
    developer: "Partner App",
    scope: "vault_read_food",
    scopeDescription: "Read your food preferences (dietary, cuisines, budget)",
    requestedAt: new Date().toISOString(),
    expiryHours: 24,
    status: "pending",
  },
];

const MOCK_GRANTED: ConsentRequest[] = [
  {
    id: "grant-001",
    developer: "Restaurant Finder Pro",
    scope: "vault_read_food",
    scopeDescription: "Read your food preferences (dietary, cuisines, budget)",
    requestedAt: new Date(Date.now() - 86400000).toISOString(),
    expiryHours: 168,
    status: "granted",
  },
  {
    id: "grant-002",
    developer: "Job Match AI",
    scope: "vault_read_professional",
    scopeDescription:
      "Read your professional profile (title, skills, experience)",
    requestedAt: new Date(Date.now() - 172800000).toISOString(),
    expiryHours: 720,
    status: "granted",
  },
];

export default function ConsentsPage() {
  const [pending, setPending] = useState<ConsentRequest[]>(MOCK_PENDING);
  const [granted, setGranted] = useState<ConsentRequest[]>(MOCK_GRANTED);
  const [loading, setLoading] = useState(false);

  const handleApprove = (id: string) => {
    const request = pending.find((r) => r.id === id);
    if (request) {
      setGranted([...granted, { ...request, status: "granted" }]);
      setPending(pending.filter((r) => r.id !== id));
    }
  };

  const handleDeny = (id: string) => {
    setPending(pending.filter((r) => r.id !== id));
  };

  const handleRevoke = (id: string) => {
    setGranted(granted.filter((r) => r.id !== id));
  };

  const getScopeColor = (scope: string): string => {
    if (scope.includes("food"))
      return "bg-orange-500/10 text-orange-600 border-orange-500/20";
    if (scope.includes("professional"))
      return "bg-blue-500/10 text-blue-600 border-blue-500/20";
    if (scope.includes("finance"))
      return "bg-green-500/10 text-green-600 border-green-500/20";
    return "bg-gray-500/10 text-gray-600 border-gray-500/20";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="space-y-4 text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-blue-600" />
          <p className="text-muted-foreground">Loading consents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl py-6 space-y-6">
      {/* Header */}
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

      {/* Mock Data Banner */}
      <div className="flex items-center gap-3 p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400">
        <Info className="h-5 w-5 flex-shrink-0" />
        <div className="text-sm">
          <span className="font-semibold">Demo Mode:</span> This screen displays
          mock data for demonstration purposes. In production, consent requests
          will come from external developers via the API.
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Pending Requests
            {pending.length > 0 && (
              <Badge variant="destructive" className="ml-1">
                {pending.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="granted" className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Granted Access
            {granted.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {granted.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Pending Requests */}
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
                      {request.scope
                        .replace("vault_read_", "")
                        .replace("_", " ")}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-sm font-medium">Requesting access to:</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {request.scopeDescription}
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
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Approve
                    </Button>
                    <Button
                      onClick={() => handleDeny(request.id)}
                      variant="none"
                      className="flex-1 border border-destructive text-destructive hover:bg-destructive/10"
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

        {/* Granted Access */}
        <TabsContent value="granted" className="space-y-4 mt-4">
          {granted.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Shield className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold">No Active Consents</h3>
                <p className="text-muted-foreground mt-2">
                  You haven&apos;t granted any data access to developers yet.
                </p>
              </CardContent>
            </Card>
          ) : (
            granted.map((consent) => (
              <Card key={consent.id} className="border-l-4 border-l-green-500">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        {consent.developer}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Granted{" "}
                        {new Date(consent.requestedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge className={getScopeColor(consent.scope)}>
                      {consent.scope
                        .replace("vault_read_", "")
                        .replace("_", " ")}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/10">
                    <p className="text-sm font-medium text-green-700 dark:text-green-400">
                      ✓ Active Access
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {consent.scopeDescription}
                    </p>
                  </div>

                  <Button
                    onClick={() => handleRevoke(consent.id)}
                    variant="none"
                    className="w-full border border-destructive text-destructive hover:bg-destructive/10"
                  >
                    Revoke Access
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
