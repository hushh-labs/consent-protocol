// app/dashboard/page.tsx

/**
 * Agent Kai Dashboard - Crystal Gold Theme
 *
 * Simplified dashboard with 4 primary actions:
 * 1. Ask Agent Kai - Chat interface
 * 2. View your profile - World model visualization
 * 3. Manage Consents - Consent management
 * 4. Check-In - Location-based (Coming Soon)
 */

"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/auth-context";
import { useVault } from "@/lib/vault/vault-context";
import { usePendingConsentCount } from "@/components/consent/notification-provider";
import {
  MessageSquare,
  User,
  Shield,
  MapPin,
  ChevronRight,
  Sparkles,
  Lock,
} from "lucide-react";

// =============================================================================
// ACTION CARD COMPONENT
// =============================================================================

interface ActionCardProps {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  onClick?: () => void;
  badge?: string | number;
  disabled?: boolean;
  comingSoon?: boolean;
  variant?: "default" | "primary" | "gold";
}

function ActionCard({
  title,
  description,
  icon: Icon,
  href,
  onClick,
  badge,
  disabled,
  comingSoon,
  variant = "default",
}: ActionCardProps) {
  const router = useRouter();

  const handleClick = () => {
    if (disabled || comingSoon) return;
    if (onClick) {
      onClick();
    } else if (href) {
      router.push(href);
    }
  };

  const baseClasses = `
    w-full p-4 rounded-ios-lg transition-all duration-200 cursor-pointer
    flex items-center gap-4
  `;

  const variantClasses = {
    default: `
      crystal-glass hover:border-[var(--crystal-gold-400)]/30
      ${disabled || comingSoon ? "opacity-50 cursor-not-allowed" : ""}
    `,
    primary: `
      crystal-glass-gold hover:border-[var(--crystal-gold-400)]/40
    `,
    gold: `
      bg-gradient-to-r from-[var(--crystal-gold-400)] to-[var(--crystal-gold-600)]
      text-white shadow-lg shadow-[var(--crystal-gold-400)]/25
      hover:shadow-xl hover:shadow-[var(--crystal-gold-400)]/30
    `,
  };

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]}`}
      onClick={handleClick}
    >
      {/* Icon */}
      <div
        className={`
          h-12 w-12 shrink-0 rounded-ios flex items-center justify-center
          ${variant === "gold" 
            ? "bg-white/20" 
            : "bg-gradient-to-br from-[var(--crystal-gold-400)]/20 to-[var(--crystal-gold-600)]/10 border border-[var(--crystal-gold-400)]/20"
          }
        `}
      >
        <Icon
          className={`h-6 w-6 ${
            variant === "gold" ? "text-white" : "text-[var(--crystal-gold-500)]"
          }`}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center gap-2">
          <h3
            className={`font-semibold text-base ${
              variant === "gold" ? "text-white" : ""
            }`}
          >
            {title}
          </h3>
          {badge !== undefined && (
            <span
              className={`
                text-xs px-2 py-0.5 rounded-full font-medium
                ${variant === "gold"
                  ? "bg-white/20 text-white"
                  : "bg-[var(--crystal-gold-400)]/20 text-[var(--crystal-gold-600)]"
                }
              `}
            >
              {badge}
            </span>
          )}
          {comingSoon && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
              Soon
            </span>
          )}
        </div>
        <p
          className={`text-sm mt-0.5 ${
            variant === "gold" ? "text-white/80" : "text-muted-foreground"
          }`}
        >
          {description}
        </p>
      </div>

      {/* Right indicator */}
      {comingSoon ? (
        <Lock className="h-5 w-5 text-muted-foreground/50 shrink-0" />
      ) : (
        <ChevronRight
          className={`h-5 w-5 shrink-0 ${
            variant === "gold" ? "text-white/70" : "text-muted-foreground/70"
          }`}
        />
      )}
    </div>
  );
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { getVaultKey } = useVault();
  const pendingConsentCount = usePendingConsentCount();

  // Auth protection
  if (!authLoading && !isAuthenticated) {
    router.push("/");
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 pb-28">
      {/* Logo and Title */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-gradient-to-br from-[var(--crystal-gold-400)] to-[var(--crystal-gold-600)] shadow-xl shadow-[var(--crystal-gold-400)]/30 mb-4">
          <Sparkles className="h-10 w-10 text-white" />
        </div>
        <h1 className="text-3xl font-bold mb-1">
          <span className="text-crystal-gold">hushh</span>
        </h1>
        <p className="text-muted-foreground text-sm">
          Your Personal Data Agent
        </p>
      </div>

      {/* Action Cards */}
      <div className="w-full max-w-md space-y-3">
        {/* Ask Agent Kai - Primary Action */}
        <ActionCard
          title="Ask Agent Kai"
          description="Chat with your AI investment advisor"
          icon={MessageSquare}
          href="/chat"
          variant="gold"
        />

        {/* View Profile */}
        <ActionCard
          title="View your profile"
          description="See your world model and preferences"
          icon={User}
          href="/profile"
          variant="primary"
        />

        {/* Manage Consents */}
        <ActionCard
          title="Manage Consents"
          description="Control who can access your data"
          icon={Shield}
          href="/consents"
          badge={pendingConsentCount > 0 ? pendingConsentCount : undefined}
        />

        {/* Check-In - Coming Soon */}
        <ActionCard
          title="Check-In"
          description="Share your location context"
          icon={MapPin}
          comingSoon
        />
      </div>

      {/* Security Footer */}
      <div className="mt-8 text-center">
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Shield className="h-3.5 w-3.5 text-emerald-500" />
          <span>End-to-end encrypted • BYOK secured</span>
        </div>
      </div>
    </div>
  );
}
