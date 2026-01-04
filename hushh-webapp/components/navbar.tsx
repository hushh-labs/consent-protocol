// components/navbar.tsx
// Bottom Pill Navigation with Consent Badge for Hushh PDA

"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, Button } from "@/lib/morphy-ux/morphy";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { Home, LayoutDashboard, LogIn, LogOut, Bell } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  requiresAuth?: boolean;
  badge?: number;
}

const NavButton = ({
  item,
  isActive,
  onClick,
}: {
  item: NavItem;
  isActive: boolean;
  onClick?: () => void;
}) => {
  const Icon = item.icon;

  const buttonContent = (
    <Button
      variant="link"
      effect="glass"
      showRipple
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-center justify-center h-auto px-3 py-2 rounded-xl",
        !isActive && "text-muted-foreground hover:text-foreground"
      )}
    >
      <div className="relative">
        <Icon
          className={cn(
            "h-5 w-5 mb-0.5",
            isActive && "text-(--morphy-primary-start)"
          )}
        />
        {/* Badge for notifications */}
        {item.badge !== undefined && item.badge > 0 && (
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {item.badge > 9 ? "9+" : item.badge}
          </span>
        )}
      </div>
      <span
        className={cn(
          "text-[10px] font-medium",
          isActive && "hushh-gradient-text"
        )}
      >
        {item.label}
      </span>
    </Button>
  );

  if (onClick) {
    return buttonContent;
  }

  return <Link href={item.href}>{buttonContent}</Link>;
};

// Hook to get pending consent count (client-side only)
function usePendingConsents(): number {
  const [count, setCount] = useState(0);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      setCount(0);
      return;
    }

    const fetchCount = async () => {
      const userId = sessionStorage.getItem("user_id");
      if (!userId) return;

      try {
        const res = await fetch(`/api/consent/pending?userId=${userId}`);
        if (res.ok) {
          const data = await res.json();
          setCount(data.pending?.length || 0);
        }
      } catch {
        // Ignore errors
      }
    };

    fetchCount();
    // Refresh every 30 seconds
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  return count;
}

export const Navbar = () => {
  const pathname = usePathname();
  const { isAuthenticated, signOut } = useAuth();
  const pendingConsents = usePendingConsents();

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (err) {
      console.warn("Logout error:", err);
    }
  };

  // Build navigation items dynamically
  const navigationItems: NavItem[] = [
    ...(isAuthenticated
      ? [
          {
            label: "Dashboard",
            href: "/dashboard",
            icon: LayoutDashboard,
            requiresAuth: true,
          },
        ]
      : []),
  ];

  return (
    <nav className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-0 right-0 z-50 flex justify-center px-4">
      <Card
        variant="none"
        effect="fill"
        className="px-3 py-2 rounded-full bg-white dark:bg-black border border-gray-200 dark:border-gray-800 shadow-2xl"
      >
        <div className="flex items-center gap-1">
          {/* Navigation Items */}
          {navigationItems.map((item) => {
            const isActive =
              pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <NavButton key={item.href} item={item} isActive={isActive} />
            );
          })}

          {/* Consent Notifications (when authenticated) */}
          {isAuthenticated && (
            <NavButton
              item={{
                label: "Consents",
                href: "/dashboard/consents",
                icon: Bell,
                badge: pendingConsents,
              }}
              isActive={pathname === "/dashboard/consents"}
            />
          )}

          {/* Separator */}
          <div className="h-10 w-px bg-gray-300 dark:bg-gray-600 mx-1" />

          {/* Auth Button */}
          {isAuthenticated ? (
            <NavButton
              item={{ label: "Sign Out", href: "/logout", icon: LogOut }}
              isActive={false}
              onClick={handleLogout}
            />
          ) : (
            <NavButton
              item={{ label: "Sign In", href: "/login", icon: LogIn }}
              isActive={pathname === "/login"}
            />
          )}

          {/* Theme Toggle */}
          <div className="flex flex-col items-center justify-center px-2 py-2">
            <ThemeToggle />
          </div>
        </div>
      </Card>
    </nav>
  );
};
