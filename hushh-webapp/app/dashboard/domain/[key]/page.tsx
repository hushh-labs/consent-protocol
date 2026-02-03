"use client";

/**
 * Domain Detail Page
 *
 * Generic page for viewing World Model domain data.
 * Displays decrypted attributes for any domain type (financial, health, food, etc.)
 * 
 * Route: /dashboard/domain/[key]
 */

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
} from "@/lib/morphy-ux/morphy";
import { useAuth } from "@/hooks/use-auth";
import { useVault } from "@/lib/vault/vault-context";
import { useStepProgress } from "@/lib/progress/step-progress-context";
import { WorldModelService, DomainSummary, EncryptedValue } from "@/lib/services/world-model-service";
import { decryptData } from "@/lib/vault/encrypt";
import { 
  ArrowLeft,
  Wallet, 
  CreditCard, 
  Heart, 
  Plane, 
  Utensils, 
  Briefcase, 
  Tv, 
  ShoppingBag, 
  Folder,
  Loader2,
  Lock,
  Calendar,
  Hash,
  Type,
  AlertCircle,
  RefreshCw
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { VaultFlow } from "@/components/vault/vault-flow";

// Icon mapping for domains
const DOMAIN_ICONS: Record<string, React.ElementType> = {
  financial: Wallet,
  subscriptions: CreditCard,
  health: Heart,
  travel: Plane,
  food: Utensils,
  professional: Briefcase,
  entertainment: Tv,
  shopping: ShoppingBag,
  general: Folder,
};

// Color mapping for domains
const DOMAIN_COLORS: Record<string, string> = {
  financial: "#10b981",
  subscriptions: "#8b5cf6",
  health: "#ef4444",
  travel: "#3b82f6",
  food: "#f97316",
  professional: "#6366f1",
  entertainment: "#ec4899",
  shopping: "#14b8a6",
  general: "#6b7280",
};

// Display names for domains
const DOMAIN_DISPLAY_NAMES: Record<string, string> = {
  financial: "Financial Data",
  subscriptions: "Subscriptions",
  health: "Health & Wellness",
  travel: "Travel Preferences",
  food: "Food & Dining",
  professional: "Professional Profile",
  entertainment: "Entertainment",
  shopping: "Shopping Preferences",
  general: "General Data",
};

interface DecryptedAttribute {
  key: string;
  value: unknown;
  displayName: string;
  dataType: string;
}

export default function DomainDetailPage() {
  const params = useParams();
  const router = useRouter();
  const domainKey = params.key as string;
  
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { vaultKey, isVaultUnlocked } = useVault();
  const { registerSteps, completeStep, reset } = useStepProgress();
  
  const [domainInfo, setDomainInfo] = useState<DomainSummary | null>(null);
  const [attributes, setAttributes] = useState<DecryptedAttribute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [showVaultFlow, setShowVaultFlow] = useState(false);

  // Get icon and color for domain
  const IconComponent = DOMAIN_ICONS[domainKey] || Folder;
  const domainColor = DOMAIN_COLORS[domainKey] || "#6b7280";
  const displayName = domainInfo?.displayName || DOMAIN_DISPLAY_NAMES[domainKey] || domainKey;

  useEffect(() => {
    let cancelled = false;

    async function loadDomainData() {
      // Wait for auth to finish loading
      if (authLoading) return;

      // Register steps only once
      if (!initialized) {
        registerSteps(3);
        setInitialized(true);
      }

      // Step 1: Auth check
      if (!isAuthenticated || !user?.uid) {
        router.push("/");
        return;
      }
      completeStep();

      // Step 2: Check vault is unlocked
      if (!isVaultUnlocked || !vaultKey) {
        setShowVaultFlow(true);
        setLoading(false);
        completeStep();
        completeStep();
        return;
      }
      completeStep();

      // Step 3: Load and decrypt domain data
      try {
        setLoading(true);
        setError(null);

        // Get metadata to find domain info
        const metadata = await WorldModelService.getMetadata(user.uid);
        const domain = metadata.domains.find(d => d.key === domainKey);
        
        if (domain) {
          setDomainInfo(domain);
        }

        // Get encrypted domain data
        const encryptedBlob = await WorldModelService.getDomainData(user.uid, domainKey);
        
        if (!encryptedBlob) {
          setAttributes([]);
          if (!cancelled) completeStep();
          return;
        }

        // Decrypt the data - ensure we have the required fields
        const payload = {
          ciphertext: encryptedBlob.ciphertext,
          iv: encryptedBlob.iv,
          tag: encryptedBlob.tag,
          encoding: 'base64' as const,
          algorithm: (encryptedBlob.algorithm || 'aes-256-gcm') as 'aes-256-gcm',
        };
        const decryptedJson = await decryptData(payload, vaultKey);
        const decryptedData = JSON.parse(decryptedJson);

        // Convert to attribute list
        const attrs: DecryptedAttribute[] = [];
        
        function flattenObject(obj: Record<string, unknown>, prefix = "") {
          for (const [key, value] of Object.entries(obj)) {
            const fullKey = prefix ? `${prefix}.${key}` : key;
            const displayKey = key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
            
            if (value !== null && typeof value === "object" && !Array.isArray(value)) {
              flattenObject(value as Record<string, unknown>, fullKey);
            } else {
              attrs.push({
                key: fullKey,
                value,
                displayName: displayKey,
                dataType: Array.isArray(value) ? "array" : typeof value,
              });
            }
          }
        }

        flattenObject(decryptedData);
        setAttributes(attrs);

        if (!cancelled) completeStep();
      } catch (err) {
        console.error("Failed to load domain data:", err);
        setError(err instanceof Error ? err.message : "Failed to load data");
        if (!cancelled) completeStep();
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadDomainData();

    return () => {
      cancelled = true;
      reset();
    };
  }, [authLoading, isAuthenticated, user?.uid, isVaultUnlocked, vaultKey, domainKey]);

  // Handle vault unlock success
  const handleVaultSuccess = () => {
    setShowVaultFlow(false);
    setInitialized(false); // Re-trigger loading
  };

  // Format value for display
  const formatValue = (value: unknown, dataType: string): string => {
    if (value === null || value === undefined) return "—";
    if (Array.isArray(value)) {
      if (value.length === 0) return "None";
      return value.join(", ");
    }
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "number") {
      // Format currency-like numbers
      if (value >= 1000) {
        return new Intl.NumberFormat("en-US", {
          style: "decimal",
          maximumFractionDigits: 2,
        }).format(value);
      }
      return value.toString();
    }
    return String(value);
  };

  // Get icon for data type
  const getTypeIcon = (dataType: string) => {
    switch (dataType) {
      case "number":
        return <Hash className="h-3 w-3" />;
      case "string":
        return <Type className="h-3 w-3" />;
      case "array":
        return <Folder className="h-3 w-3" />;
      default:
        return <Type className="h-3 w-3" />;
    }
  };

  // Show nothing while checking auth
  if (authLoading) {
    return null;
  }

  // Show vault flow if vault is locked
  if (showVaultFlow && user) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-2xl">
        <VaultFlow user={user} onSuccess={handleVaultSuccess} />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl space-y-6 pb-28">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="none"
          size="icon"
          onClick={() => router.back()}
          className="border"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3 flex-1">
          <div
            className="h-12 w-12 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${domainColor}20` }}
          >
            <IconComponent
              className="h-6 w-6"
              style={{ color: domainColor }}
            />
          </div>
          <div>
            <h1 className="text-xl font-bold">{displayName}</h1>
            <p className="text-sm text-muted-foreground">
              {domainInfo?.attributeCount || attributes.length} data points
            </p>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <Card variant="none" effect="glass">
          <CardContent className="py-12 flex flex-col items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-sm text-muted-foreground">Decrypting your data...</p>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {error && !loading && (
        <Card variant="none" effect="glass" className="border-destructive/50">
          <CardContent className="py-8 flex flex-col items-center justify-center">
            <AlertCircle className="h-8 w-8 text-destructive mb-4" />
            <p className="text-sm text-destructive mb-4">{error}</p>
            <Button
              variant="none"
              size="sm"
              onClick={() => {
                setInitialized(false);
                setError(null);
              }}
              className="border"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!loading && !error && attributes.length === 0 && (
        <Card variant="none" effect="glass">
          <CardContent className="py-12 text-center">
            <div
              className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
              style={{ backgroundColor: `${domainColor}10` }}
            >
              <Folder className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No Data Yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              This domain doesn&apos;t have any data stored yet.
            </p>
            <Button
              variant="gradient"
              onClick={() => router.push("/dashboard/kai")}
            >
              Chat with Kai to add data
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Attributes List */}
      {!loading && !error && attributes.length > 0 && (
        <Card variant="none" effect="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              Decrypted Data
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              This data is encrypted at rest and only visible to you
            </p>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-3">
              {attributes.map((attr) => (
                <div
                  key={attr.key}
                  className="p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">{attr.displayName}</span>
                        <Badge variant="outline" className="text-xs flex items-center gap-1">
                          {getTypeIcon(attr.dataType)}
                          {attr.dataType}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground break-all">
                        {formatValue(attr.value, attr.dataType)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Domain Summary */}
      {domainInfo && domainInfo.summary && Object.keys(domainInfo.summary).length > 0 && (
        <Card variant="none" effect="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Summary</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(domainInfo.summary).map(([key, value]) => (
                <div key={key} className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">
                    {key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                  </p>
                  <p className="text-sm font-medium">{String(value)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Last Updated */}
      {domainInfo?.lastUpdated && (
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          Last updated: {new Date(domainInfo.lastUpdated).toLocaleDateString()}
        </div>
      )}

      {/* Security Footer */}
      <p className="text-center text-xs text-muted-foreground">
        Your data is encrypted end-to-end using your vault key
      </p>
    </div>
  );
}
