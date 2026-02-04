"use client";

/**
 * Profile Page
 *
 * Shows user info from authentication providers (Google, Apple, etc.), 
 * world model domains with KPI cards, sign out button, and theme toggle.
 * Mobile-first design with Morphy-UX styling.
 */

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
} from "@/lib/morphy-ux/morphy";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { useStepProgress } from "@/lib/progress/step-progress-context";
import { 
  User, 
  Mail, 
  LogOut, 
  Shield, 
  Wallet, 
  CreditCard, 
  Heart, 
  Plane, 
  Tv, 
  ShoppingBag, 
  Folder,
  Loader2,
  MessageSquare,
  ChevronRight
} from "lucide-react";
import { WorldModelService, DomainSummary } from "@/lib/services/world-model-service";

type ThemeOption = "light" | "dark" | "system";

// Icon mapping for domains
const DOMAIN_ICONS: Record<string, React.ElementType> = {
  financial: Wallet,
  subscriptions: CreditCard,
  health: Heart,
  travel: Plane,
  entertainment: Tv,
  shopping: ShoppingBag,
  general: Folder,
  wallet: Wallet,
  "credit-card": CreditCard,
  heart: Heart,
  plane: Plane,
  tv: Tv,
  "shopping-bag": ShoppingBag,
  folder: Folder,
};

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const { registerSteps, completeStep, reset } = useStepProgress();
  const [domains, setDomains] = useState<DomainSummary[]>([]);
  const [totalAttributes, setTotalAttributes] = useState(0);
  const [loadingDomains, setLoadingDomains] = useState(true);
  const [initialized, setInitialized] = useState(false);

  // Load world model data - auth is handled by VaultLockGuard in layout
  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      // Wait for auth to finish loading
      if (authLoading) return;

      // Register steps only once
      if (!initialized) {
        registerSteps(1); // Only 1 step now - loading world model data
        setInitialized(true);
      }

      // Load world model data
      if (!user?.uid) return;

      try {
        setLoadingDomains(true);
        const metadata = await WorldModelService.getMetadata(user.uid);
        if (!cancelled) {
          setDomains(metadata.domains);
          setTotalAttributes(metadata.totalAttributes);
          completeStep();
        }
      } catch (error) {
        console.error("Failed to load world model data:", error);
        if (!cancelled) completeStep(); // Complete step on error
      } finally {
        if (!cancelled) setLoadingDomains(false);
      }
    }

    loadData();

    return () => {
      cancelled = true;
      reset();
    };
  }, [authLoading, user?.uid]);

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push("/");
    } catch (err) {
      console.error("Sign out error:", err);
    }
  };

  // Get provider from Firebase user
  const getProvider = () => {
    if (!user?.providerData || user.providerData.length === 0) {
      return { name: "Unknown", id: "unknown" };
    }
    
    const providerId = user.providerData[0]?.providerId;
    
    switch (providerId) {
      case "google.com":
        return { name: "Google", id: "google" };
      case "apple.com":
        return { name: "Apple", id: "apple" };
      case "password":
        return { name: "Email/Password", id: "password" };
      default:
        return { name: providerId || "Unknown", id: providerId || "unknown" };
    }
  };

  const provider = getProvider();

  // Show loading state while auth is loading
  if (authLoading) {
    return null;
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl space-y-6 pb-28">
      {/* Profile Header */}
      <div className="text-center space-y-4">
        {user?.photoURL ? (
          <img
            src={user.photoURL}
            alt="Profile"
            className="h-24 w-24 rounded-full mx-auto ring-4 ring-primary/20"
          />
        ) : (
          <div className="h-24 w-24 rounded-full mx-auto bg-muted flex items-center justify-center ring-4 ring-primary/20">
            <User className="h-12 w-12 text-muted-foreground" />
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold">{user?.displayName || "User"}</h1>
          <p className="text-muted-foreground text-sm">{user?.email}</p>
        </div>
      </div>

      {/* World Model KPI Cards */}
      <Card variant="none" effect="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Folder className="h-5 w-5 text-primary" />
              </div>
              <span>Your Data Profile</span>
            </div>
            {!loadingDomains && (
              <Badge variant="secondary" className="text-xs">
                {totalAttributes} data points
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {loadingDomains ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : domains.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {domains.map((domain) => {
                const IconComponent = DOMAIN_ICONS[domain.icon] || DOMAIN_ICONS[domain.key] || Folder;
                return (
                  <button
                    key={domain.key}
                    onClick={() => router.push("/kai/dashboard")}
                    className="p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="p-2 rounded-lg"
                        style={{ backgroundColor: `${domain.color}20` }}
                      >
                        <IconComponent
                          className="h-5 w-5"
                          style={{ color: domain.color }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                          {domain.displayName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {domain.attributeCount} attribute{domain.attributeCount !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center">
                <MessageSquare className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                No data yet. Chat with Kai to build your profile.
              </p>
              <Button
                variant="gradient"
                size="sm"
                onClick={() => router.push("/chat")}
              >
                Ask Agent Kai
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Account Info Card */}
      <Card variant="none" effect="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <span>Account</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          {/* Email */}
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
              <Mail className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Email</p>
              <p className="text-xs text-muted-foreground truncate">
                {user?.email || "Not available"}
              </p>
            </div>
          </div>

          {/* Provider */}
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
              {provider.id === "google" ? (
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              ) : provider.id === "apple" ? (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.05 20.28c-.98.95-2.05.88-3.08.38-1.07-.52-2.07-.51-3.2 0-1.01.43-2.1.49-2.98-.38C5.22 17.63 2.7 12 5.45 8.04c1.47-2.09 3.8-2.31 5.33-1.18 1.1.75 3.3.73 4.45-.04 2.1-1.31 3.55-.95 4.5 1.14-.15.08.2.14 0 .2-2.63 1.34-3.35 6.03.95 7.84-.46 1.4-1.25 2.89-2.26 4.4l-.07.08-.05-.2zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.17 2.22-1.8 4.19-3.74 4.25z" />
                </svg>
              ) : (
                <Shield className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Sign-in Provider</p>
              <p className="text-xs text-muted-foreground">{provider.name}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Appearance Card */}
      <Card variant="none" effect="glass">
        <CardContent className="py-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Appearance</span>
            <ThemeToggle />
          </div>
        </CardContent>
      </Card>

      {/* Sign Out Button */}
      <Button
        variant="none"
        size="lg"
        className="w-full border border-destructive/30 text-destructive hover:bg-destructive/10"
        onClick={handleSignOut}
      >
        <LogOut className="h-5 w-5 mr-2" />
        Sign Out
      </Button>

      {/* Security Footer */}
      <p className="text-center text-xs text-muted-foreground">
        Your data is encrypted end-to-end and never leaves your device
        unencrypted.
      </p>
    </div>
  );
}
