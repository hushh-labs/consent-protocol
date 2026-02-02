// app/dashboard/page.tsx

/**
 * Data Domains Dashboard - Minimal List UI
 *
 * Mobile-first overview of all collected data domains.
 * Clean list-based layout for maximum usability.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/lib/morphy-ux/morphy";
import { ConsentStatusBar } from "@/components/consent/status-bar";
import { useAuth } from "@/lib/firebase/auth-context";
import { ApiService } from "@/lib/services/api-service";
import { useVault } from "@/lib/vault/vault-context";
import { HushhIdentity, HushhVault } from "@/lib/capacitor";
import { useStepProgress } from "@/lib/progress/step-progress-context";
import {
  TrendingUp,
  UserCheck,
  Utensils,
  ShoppingBag,
  CreditCard,
  Plane,
  MessageCircle,
  Dumbbell,
  Shield,
  Lock,
  CheckCircle,
  ChevronRight,
} from "lucide-react";

// =============================================================================
// DATA DOMAIN DEFINITIONS
// =============================================================================

interface DataDomain {
  id: string;
  name: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  status: "active" | "soon" | "locked";
  dataCount?: number;
  badge?: string;
}

const DATA_DOMAINS: DataDomain[] = [
  {
    id: "investor",
    name: "Investor",
    description: "Personal investment committee with AI",
    href: "/dashboard/kai",
    icon: TrendingUp,
    iconBg: "bg-blue-500",
    status: "active",
    badge: "Hushh Technologies",
  },
  {
    id: "professional",
    name: "Professional",
    description: "Skills, experience, and career preferences",
    href: "/dashboard/professional",
    icon: UserCheck,
    iconBg: "bg-emerald-500",
    status: "active",
  },
  {
    id: "food",
    name: "Food & Dining",
    description: "Dietary preferences and cuisine favorites",
    href: "/dashboard/food",
    icon: Utensils,
    iconBg: "bg-orange-500",
    status: "active",
  },
  {
    id: "fashion",
    name: "Fashion",
    description: "Style preferences and wardrobe insights",
    href: "/dashboard/fashion",
    icon: ShoppingBag,
    iconBg: "bg-pink-500",
    status: "soon",
  },
  {
    id: "transactions",
    name: "Transactions",
    description: "Spending patterns and financial habits",
    href: "/dashboard/transactions",
    icon: CreditCard,
    iconBg: "bg-green-500",
    status: "soon",
  },
  {
    id: "travel",
    name: "Travel",
    description: "Trip history and destination preferences",
    href: "/dashboard/travel",
    icon: Plane,
    iconBg: "bg-sky-500",
    status: "soon",
  },
  {
    id: "social",
    name: "Social",
    description: "Social media and interactions",
    href: "/dashboard/social",
    icon: MessageCircle,
    iconBg: "bg-violet-500",
    status: "soon",
  },
  {
    id: "fitness",
    name: "Fitness",
    description: "Health goals and activity tracking",
    href: "/dashboard/fitness",
    icon: Dumbbell,
    iconBg: "bg-red-500",
    status: "soon",
  },
];

// =============================================================================
// DOMAIN LIST ITEM COMPONENT
// =============================================================================

// =============================================================================
// DOMAIN LIST ITEM COMPONENT
// =============================================================================

function DomainListItem({
  domain,
  dataCount,
}: {
  domain: DataDomain;
  dataCount?: number;
}) {
  const router = useRouter();
  const Icon = domain.icon;
  const isActive = domain.status === "active";

  if (!isActive) {
    return (
      <div className="w-full flex items-center gap-3 p-3 rounded-2xl bg-muted/40 opacity-60 cursor-not-allowed border border-transparent">
        <div
          className={`h-10 w-10 shrink-0 rounded-xl ${domain.iconBg} flex items-center justify-center shadow-sm grayscale opacity-50`}
        >
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-sm truncate">{domain.name}</h3>
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {domain.description}
          </p>
        </div>
        <Lock className="h-4 w-4 text-muted-foreground/50 shrink-0" />
      </div>
    );
  }

  return (
    <Card
      variant="none"
      effect="glass"
      showRipple
      className="w-full p-0 overflow-hidden group"
      onClick={() => router.push(domain.href)}
    >
      <div className="flex items-center gap-3 p-3">
        {/* Icon */}
        <div
          className={`h-10 w-10 shrink-0 rounded-xl ${domain.iconBg} flex items-center justify-center shadow-sm ring-1 ring-black/5 dark:ring-white/10`}
        >
          <Icon className="h-5 w-5 text-white" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-sm truncate">{domain.name}</h3>
            {domain.badge && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 font-semibold shrink-0">
                {domain.badge}
              </span>
            )}
            {dataCount !== undefined && dataCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium shrink-0">
                {dataCount}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {domain.description}
          </p>
        </div>

        {/* Right side */}
        <ChevronRight className="h-4 w-4 text-muted-foreground/70 shrink-0" />
      </div>
    </Card>
  );
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { getVaultKey, vaultOwnerToken, vaultKey } = useVault();
  const { registerSteps, completeStep, reset } = useStepProgress();
  const [dataCounts, setDataCounts] = useState<Record<string, number>>({});
  const [domainStatus, setDomainStatus] = useState({
    totalActive: 0,
    total: 3,
  });
  const [activeConsentsCount, setActiveConsentsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  // Decrypt encrypted payload helper
  const decryptPayload = useCallback(
    async (payload: { ciphertext: string; iv: string; tag: string }) => {
      if (!vaultKey) throw new Error("No vault key");
      const result = await HushhVault.decryptData({
        keyHex: vaultKey,
        payload: {
          ciphertext: payload.ciphertext,
          iv: payload.iv,
          tag: payload.tag,
          encoding: "base64",
          algorithm: "aes-256-gcm",
        },
      });
      return result.plaintext;
    },
    [vaultKey]
  );

  // Consolidated init effect - handles auth check and data loading
  useEffect(() => {
    let cancelled = false;

    async function init() {
      // Wait for auth to finish loading
      if (authLoading) return;

      // Register steps only once
      if (!initialized) {
        registerSteps(3);
        setInitialized(true);
      }

      // Step 1: Auth check
      if (!isAuthenticated) {
        router.push("/");
        return;
      }
      completeStep();

      // Check vault requirements
      if (!user || !vaultOwnerToken) {
        setLoading(false);
        completeStep(); // Step 2
        completeStep(); // Step 3
        return;
      }

      const currentVaultKey = getVaultKey();
      if (!currentVaultKey) {
        setLoading(false);
        completeStep(); // Step 2
        completeStep(); // Step 3
        return;
      }

      try {
        // Fetch status and active consents in parallel
        const [statusRes, activeRes] = await Promise.all([
          ApiService.getVaultStatus(user.uid, vaultOwnerToken),
          ApiService.getActiveConsents(user.uid, vaultOwnerToken),
        ]);

        if (cancelled) return;

        const counts: Record<string, number> = {};

        if (statusRes.ok) {
          const statusData = await statusRes.json();
          setDomainStatus({
            totalActive: statusData.totalActive,
            total: statusData.total,
          });

          // Set individual domain counts for badges
          if (statusData.domains?.food?.fieldCount) {
            counts.food = statusData.domains.food.fieldCount;
          }
          if (statusData.domains?.professional?.fieldCount) {
            counts.professional = statusData.domains.professional.fieldCount;
          }
        }

        if (activeRes.ok) {
          const data = await activeRes.json();
          setActiveConsentsCount((data.active || []).length);
        }

        // Step 2: Vault status + consents loaded
        if (!cancelled) completeStep();

        // Fetch encrypted investor profile and decrypt to count holdings
        try {
          const encrypted = await HushhIdentity.getEncryptedProfile({
            vaultOwnerToken,
          });
          if (encrypted?.profile_data && !cancelled) {
            const plaintext = await decryptPayload(encrypted.profile_data);
            const profile = JSON.parse(plaintext);
            // Count holdings from decrypted profile
            const holdingsCount = Array.isArray(profile.top_holdings)
              ? profile.top_holdings.length
              : 0;
            counts.investor = holdingsCount;
          }
        } catch (profileError: any) {
          // User hasn't confirmed identity yet (404) or other error
          console.log(
            "[Dashboard] No investor profile found:",
            profileError?.message
          );
          counts.investor = 0;
        }

        // Step 3: Investor profile loaded
        if (!cancelled) {
          completeStep();
          setDataCounts(counts);
        }
      } catch (error) {
        console.error("Failed to load vault status:", error);
        // Complete remaining steps on error to finish progress
        if (!cancelled) {
          completeStep();
          completeStep();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();

    return () => {
      cancelled = true;
      reset();
    };
  }, [authLoading, isAuthenticated, user?.uid, vaultOwnerToken]);

  // Calculate totals
  const totalDomains = domainStatus.total;
  const activeDomains = domainStatus.totalActive;
  const totalDataPoints = Object.values(dataCounts).reduce((a, b) => a + b, 0);

  // Separate active and coming soon domains
  const activeDomainsList = DATA_DOMAINS.filter((d) => d.status === "active");
  const soonDomainsList = DATA_DOMAINS.filter((d) => d.status === "soon");

  return (
    <div className="container mx-auto py-4 px-4 space-y-4 max-w-lg pb-28">
      {/* Consent Status */}
      <ConsentStatusBar className="mb-1" />

      {/* Header - Minimal */}
      <div className="space-y-1">
        {/* <h1 className="text-2xl font-bold">
          <span className="hushh-gradient-text">Dashboard</span>
        </h1> */}
        <p className="text-sm text-muted-foreground">
          Your encrypted data vault • {activeDomains}/{totalDomains} domains
          active
        </p>
      </div>

      {/* Quick Stats */}
      <div className="flex gap-3">
        <div className="flex-1 bg-card rounded-xl p-3 border border-border/50">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-emerald-500" />
            <span className="text-lg font-bold">
              {activeDomains}/{totalDomains}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">Domains</p>
        </div>
        <div
          className="flex-1 bg-card rounded-xl p-3 border border-border/50 cursor-pointer hover:border-blue-500/50 transition-colors"
          onClick={() => router.push("/consents?tab=session")}
        >
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-blue-500" />
            <span className="text-lg font-bold">{activeConsentsCount}</span>
          </div>
          <p className="text-xs text-muted-foreground">Active Consents</p>
        </div>
      </div>

      {/* Active Domains */}
      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Active Domains
        </h2>
        <div className="space-y-1.5">
          {activeDomainsList.map((domain) => (
            <DomainListItem
              key={domain.id}
              domain={domain}
              dataCount={dataCounts[domain.id]}
            />
          ))}
        </div>
      </div>

      {/* Coming Soon */}
      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Coming Soon
        </h2>
        <div className="space-y-1.5">
          {soonDomainsList.map((domain) => (
            <DomainListItem
              key={domain.id}
              domain={domain}
              dataCount={dataCounts[domain.id]}
            />
          ))}
        </div>
      </div>

      {/* Security Footer - Minimal */}
      <div className="text-center text-xs text-muted-foreground pt-2">
        <div className="flex items-center justify-center gap-1.5">
          <Shield className="h-3 w-3 text-emerald-500" />
          <span>End-to-end encrypted</span>
        </div>
      </div>
    </div>
  );
}
