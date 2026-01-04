// app/dashboard/page.tsx

/**
 * Data Domains Dashboard
 *
 * Mobile-first overview of all collected data domains.
 * Beautiful tiles with Morphy-UX physics + Material 3 Expressive.
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, Button } from "@/lib/morphy-ux/morphy";
import { VaultFlow } from "@/components/vault/vault-flow";
import { ConsentStatusBar } from "@/components/consent/status-bar";
import { useAuth } from "@/lib/firebase/auth-context";
import { ApiService } from "@/lib/services/api-service";
import { useVault } from "@/lib/vault/vault-context";
import { decryptData } from "@/lib/vault/encrypt";
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
  ArrowRight,
  Sparkles,
  Lock,
  LayoutGrid,
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
  gradient: string;
  status: "active" | "soon" | "locked";
  dataCount?: number;
}

const DATA_DOMAINS: DataDomain[] = [
  {
    id: "investor",
    name: "Investor",
    description: "Personal investment committee with AI analysis",
    href: "/kai",
    icon: TrendingUp,
    gradient: "from-blue-500 to-purple-600",
    status: "active",
  },
  {
    id: "professional",
    name: "Professional",
    description: "Skills, experience, and career preferences",
    href: "/dashboard/professional",
    icon: UserCheck,
    gradient: "from-emerald-500 to-teal-600",
    status: "active",
  },
  {
    id: "food",
    name: "Food & Dining",
    description: "Dietary preferences and cuisine favorites",
    href: "/dashboard/food",
    icon: Utensils,
    gradient: "from-orange-500 to-red-500",
    status: "active",
  },
  {
    id: "fashion",
    name: "Fashion",
    description: "Style preferences and wardrobe insights",
    href: "/dashboard/fashion",
    icon: ShoppingBag,
    gradient: "from-pink-500 to-rose-500",
    status: "soon",
  },
  {
    id: "transactions",
    name: "Transactions",
    description: "Spending patterns and financial habits",
    href: "/dashboard/transactions",
    icon: CreditCard,
    gradient: "from-green-500 to-emerald-600",
    status: "soon",
  },
  {
    id: "travel",
    name: "Travel",
    description: "Trip history and destination preferences",
    href: "/dashboard/travel",
    icon: Plane,
    gradient: "from-sky-500 to-blue-600",
    status: "soon",
  },
  {
    id: "social",
    name: "Social",
    description: "Social media preferences and interactions",
    href: "/dashboard/social",
    icon: MessageCircle,
    gradient: "from-violet-500 to-purple-600",
    status: "soon",
  },
  {
    id: "fitness",
    name: "Fitness",
    description: "Health goals and activity tracking",
    href: "/dashboard/fitness",
    icon: Dumbbell,
    gradient: "from-red-500 to-orange-500",
    status: "soon",
  },
];

// =============================================================================
// DOMAIN TILE COMPONENT
// =============================================================================

function DomainTile({
  domain,
  dataCount,
}: {
  domain: DataDomain;
  dataCount?: number;
}) {
  const router = useRouter();
  const Icon = domain.icon;
  const isActive = domain.status === "active";
  const isSoon = domain.status === "soon";

  return (
    <Card
      variant="none"
      effect="glass"
      showRipple={isActive}
      onClick={isActive ? () => router.push(domain.href) : undefined}
      className={`relative overflow-hidden transition-all duration-300 cursor-pointer group h-full rounded-2xl ${
        isActive
          ? "hover:shadow-lg hover:shadow-primary/10"
          : "opacity-60 cursor-not-allowed"
      }`}
    >
      {/* Gradient accent bar */}
      <div
        className={`absolute top-0 left-0 right-0 h-1.5 bg-linear-to-r ${domain.gradient} opacity-80`}
      />

      <CardContent className="p-2.5">
        <div className="flex flex-col items-center text-center gap-1.5 pt-1">
          {/* Icon with gradient background */}
          <div
            className={`h-9 w-9 rounded-lg bg-linear-to-br ${domain.gradient} flex items-center justify-center shadow-md mb-1`}
          >
            <Icon className="h-4 w-4 text-white" />
          </div>

          {/* Content */}
          <div className="w-full min-w-0 space-y-1">
            <h3 className="font-semibold text-xs truncate w-full px-1">
              {domain.name}
            </h3>

            <div className="flex justify-center gap-1 flex-wrap min-h-[16px]">
              {isSoon && (
                <span className="text-[9px] px-1.5 rounded-full bg-muted text-muted-foreground border border-black/5 dark:border-white/10 flex items-center">
                  Soon
                </span>
              )}
              {dataCount !== undefined && dataCount > 0 && (
                <span className="text-[9px] px-1.5 rounded-full bg-primary/10 text-primary font-medium border border-primary/20 flex items-center">
                  {dataCount}
                </span>
              )}
            </div>

            <p className="text-[10px] text-muted-foreground line-clamp-2 leading-tight px-1 pb-1">
              {domain.description}
            </p>
          </div>

          {/* Lock Icon for inactive */}
          {!isActive && (
            <div className="absolute top-2 right-2">
              <Lock className="h-3 w-3 text-muted-foreground/40" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// STATS CARDS
// =============================================================================

function StatsCard({
  icon: Icon,
  label,
  value,
  gradient,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  gradient: string;
}) {
  return (
    <Card variant="none" effect="glass" className="flex-1">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div
            className={`h-10 w-10 rounded-lg bg-linear-to-br ${gradient} flex items-center justify-center`}
          >
            <Icon className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { getVaultKey } = useVault();
  const [dataCounts, setDataCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [isLocked, setIsLocked] = useState(false);

  // Auth & Vault protection
  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        // Not logged in -> Home/Login
        router.push("/");
      } else {
        // Logged in
        const key = getVaultKey();
        if (!key) {
          // Vault Locked -> Show Unlock Screen (In-Place)
          setIsLocked(true);
        } else {
          // Vault Unlocked -> Hide Unlock Screen
          setIsLocked(false);
        }
      }
    }
  }, [authLoading, isAuthenticated, getVaultKey, router]);

  // Handle unlock success
  const handleUnlockSuccess = () => {
    setIsLocked(false);
    // Data fetching will happen automatically due to dependency on getVaultKey or re-render
  };

  // Fetch data counts for each domain
  useEffect(() => {
    async function loadDataCounts() {
      if (!user) {
        setLoading(false);
        return;
      }

      const vaultKey = getVaultKey();
      if (!vaultKey) {
        setLoading(false);
        return;
      }

      try {
        const [foodRes, profRes] = await Promise.all([
          ApiService.getFoodPreferences(user.uid),
          ApiService.getProfessionalProfile(user.uid),
        ]);

        const counts: Record<string, number> = {};

        // Count food items
        if (foodRes.ok) {
          const data = await foodRes.json();
          const prefs = data.preferences || {};
          counts.food = Object.keys(prefs).filter((k) => prefs[k]).length;
        }

        // Count professional items
        if (profRes.ok) {
          const data = await profRes.json();
          const prefs = data.preferences || {};
          counts.professional = Object.keys(prefs).filter(
            (k) => prefs[k]
          ).length;
        }

        setDataCounts(counts);
      } catch (error) {
        console.error("Failed to load data counts:", error);
      } finally {
        setLoading(false);
      }
    }

    loadDataCounts();
  }, [user, getVaultKey]);

  // Calculate totals
  const totalDomains = DATA_DOMAINS.filter((d) => d.status === "active").length;
  const activeDomains = Object.keys(dataCounts).filter(
    (k) => (dataCounts[k] ?? 0) > 0
  ).length;
  const totalDataPoints = Object.values(dataCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="container mx-auto py-6 px-4 space-y-6 max-w-4xl">
      {/* Consent Status */}
      <ConsentStatusBar className="mb-2" />

      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
          <Sparkles className="h-4 w-4" />
          Your Personal Data Agent
        </div>
        <h1 className="text-3xl font-bold">
          <span className="hushh-gradient-text">Data Dashboard</span>
        </h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          All your data, encrypted in your vault. Tap a domain to view or add
          preferences.
        </p>
      </div>

      {/* Stats Row */}
      <div className="flex gap-4">
        <StatsCard
          icon={Shield}
          label="Domains Active"
          value={`${activeDomains}/${totalDomains}`}
          gradient="from-emerald-500 to-teal-600"
        />
        <StatsCard
          icon={Lock}
          label="Data Points"
          value={totalDataPoints}
          gradient="from-blue-500 to-purple-600"
        />
      </div>

      {/* Data Domains Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-primary" />
            <span>Your Data Domains</span>
          </h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {DATA_DOMAINS.map((domain) => (
            <DomainTile
              key={domain.id}
              domain={domain}
              dataCount={dataCounts[domain.id]}
            />
          ))}
        </div>
      </div>

      {/* Security Footer */}
      <Card
        variant="none"
        effect="glass"
        className="border-emerald-200 dark:border-emerald-800/50"
      >
        <CardContent className="p-4 text-center">
          <div className="flex items-center justify-center gap-2 text-sm">
            <Shield className="h-4 w-4 text-emerald-500" />
            <span className="text-muted-foreground">
              End-to-end encrypted • Data never leaves your device unencrypted
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
