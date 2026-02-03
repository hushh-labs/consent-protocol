// components/dashboard/user-profile.tsx

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/lib/morphy-ux/morphy";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  ShieldCheck,
  Calendar,
  Clock,
  Wallet,
  CreditCard,
  Heart,
  Plane,
  Tv,
  ShoppingBag,
  Folder,
  Users,
  MapPin,
  Loader2,
  MessageSquare,
} from "lucide-react";
import {
  WorldModelService,
  DomainSummary,
} from "@/lib/services/world-model-service";

interface UserData {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  emailVerified: boolean;
  phoneNumber?: string;
  creationTime?: string;
  lastSignInTime?: string;
  providerData?: Record<string, unknown>[];
}

// Icon mapping for domains
const DOMAIN_ICONS: Record<string, React.ElementType> = {
  financial: Wallet,
  subscriptions: CreditCard,
  health: Heart,
  travel: Plane,
  entertainment: Tv,
  shopping: ShoppingBag,
  social: Users,
  location: MapPin,
  general: Folder,
  // Icon name mappings
  wallet: Wallet,
  "credit-card": CreditCard,
  heart: Heart,
  plane: Plane,
  tv: Tv,
  "shopping-bag": ShoppingBag,
  users: Users,
  "map-pin": MapPin,
  folder: Folder,
};

// Domain Card Component
function DomainCard({
  domain,
  onClick,
}: {
  domain: DomainSummary;
  onClick: () => void;
}) {
  // Get icon name and render directly to avoid creating components during render
  const iconName = domain.icon;
  const IconComponent = DOMAIN_ICONS[iconName] || DOMAIN_ICONS[domain.key] || Folder;

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 rounded-ios-lg crystal-glass hover:bg-muted/80 transition-all duration-200 group"
    >
      <div className="flex items-start gap-3">
        <div
          className="p-2 rounded-ios-md"
          style={{ backgroundColor: `${domain.color}20` }}
        >
          <IconComponent
            className="h-5 w-5"
            style={{ color: domain.color }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">
            {domain.displayName}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {domain.attributeCount} attribute{domain.attributeCount !== 1 ? "s" : ""}
          </p>
          {Object.keys(domain.summary).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {Object.entries(domain.summary).slice(0, 2).map(([key, value]) => (
                <Badge
                  key={key}
                  variant="secondary"
                  className="text-xs px-2 py-0.5"
                >
                  {String(value)}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

// Empty State Component
function EmptyState() {
  const router = useRouter();

  return (
    <div className="text-center py-8 px-4">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
        <MessageSquare className="h-8 w-8 text-primary" />
      </div>
      <h3 className="font-semibold text-lg mb-2">No data yet</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Start chatting with Kai to build your profile
      </p>
      <button
        onClick={() => router.push("/chat")}
        className="crystal-btn-gold px-6 py-2 text-sm"
      >
        Ask Agent Kai
      </button>
    </div>
  );
}

export function UserProfile() {
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [domains, setDomains] = useState<DomainSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalAttributes, setTotalAttributes] = useState(0);

  useEffect(() => {
    const uid = sessionStorage.getItem("user_uid") || "";
    const email = sessionStorage.getItem("user_email") || "";
    const displayName = sessionStorage.getItem("user_displayName") || "";
    const photoURL = sessionStorage.getItem("user_photo");
    const emailVerified =
      sessionStorage.getItem("user_emailVerified") === "true";
    const phoneNumber = sessionStorage.getItem("user_phoneNumber");
    const creationTime = sessionStorage.getItem("user_creationTime");
    const lastSignInTime = sessionStorage.getItem("user_lastSignInTime");
    const providerDataStr = sessionStorage.getItem("user_providerData");

    if (!uid) {
      router.push("/login");
      return;
    }

    setUserData({
      uid,
      email,
      displayName: displayName || email.split("@")[0] || "User",
      photoURL: photoURL || undefined,
      emailVerified,
      phoneNumber: phoneNumber || undefined,
      creationTime: creationTime || undefined,
      lastSignInTime: lastSignInTime || undefined,
      providerData: providerDataStr ? JSON.parse(providerDataStr) : [],
    });

    // Load world model metadata
    loadWorldModelData(uid);
  }, [router]);

  const loadWorldModelData = async (userId: string) => {
    try {
      setLoading(true);
      const metadata = await WorldModelService.getMetadata(userId);
      setDomains(metadata.domains);
      setTotalAttributes(metadata.totalAttributes);
    } catch (error) {
      console.error("Failed to load world model data:", error);
      // Don't show error to user, just show empty state
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleDomainClick = (_domainKey: string) => {
    router.push("/kai/dashboard");
  };

  if (!userData) return null;

  return (
    <div className="space-y-6">
      {/* User Info Card */}
      <Card className="crystal-glass">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20 ring-2 ring-primary/20">
                {userData.photoURL && (
                  <AvatarImage
                    src={userData.photoURL}
                    alt={userData.displayName}
                  />
                )}
                <AvatarFallback className="text-2xl bg-gradient-to-br from-[var(--morphy-primary-start)] to-[var(--morphy-primary-end)] text-white">
                  {userData.displayName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-3xl font-bold">{userData.displayName}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-sm text-muted-foreground">
                    {userData.email}
                  </p>
                  {userData.emailVerified ? (
                    <Badge className="bg-green-500 flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3" />
                      Verified
                    </Badge>
                  ) : (
                    <Badge
                      variant="secondary"
                      className="flex items-center gap-1"
                    >
                      <Shield className="h-3 w-3" />
                      Unverified
                    </Badge>
                  )}
                </div>
                {userData.phoneNumber && (
                  <p className="text-sm text-muted-foreground mt-1">
                    📱 {userData.phoneNumber}
                  </p>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Account Info */}
            <div className="p-4 rounded-ios-lg bg-muted/50">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Member Since</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {formatDate(userData.creationTime)}
              </p>
            </div>

            {/* Last Sign In */}
            <div className="p-4 rounded-ios-lg bg-muted/50">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Last Sign In</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {formatDate(userData.lastSignInTime)}
              </p>
            </div>

            {/* Total Attributes */}
            <div className="p-4 rounded-ios-lg bg-muted/50">
              <div className="flex items-center gap-2 mb-2">
                <Folder className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Data Points</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin inline" />
                ) : (
                  `${totalAttributes} attributes`
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* World Model Domains */}
      <Card className="crystal-glass">
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Your Data Domains</h3>
            {domains.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {domains.length} domain{domains.length !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : domains.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {domains.map((domain) => (
                <DomainCard
                  key={domain.key}
                  domain={domain}
                  onClick={() => handleDomainClick(domain.key)}
                />
              ))}
            </div>
          ) : (
            <EmptyState />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
