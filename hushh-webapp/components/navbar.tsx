// components/navbar.tsx
// Bottom Pill Navigation - Hushh PDA

"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Card, Button } from "@/lib/morphy-ux/morphy";
import { cn } from "@/lib/utils";
import { TrendingUp, Bell, User, Mic } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { ApiService } from "@/lib/services/api-service";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
}

// Hook to get pending consent count
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
        const res = await ApiService.getPendingConsents(userId);
        if (!res.ok) return;
        const data = await res.json().catch(() => ({}));
        setCount(data.pending?.length || 0);
      } catch {
        // Ignore errors
      }
    };

    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  return count;
}

import { ThemeToggle } from "@/components/theme-toggle";

// ... existing imports

export const Navbar = () => {
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();
  const pendingConsents = usePendingConsents();

  // Sticky Kai path (last visited /kai or /kai/dashboard/*)
  const [kaiHref, setKaiHref] = useState("/kai");

  useEffect(() => {
    const saved = localStorage.getItem("lastKaiPath");
    if (saved) {
      setKaiHref(saved);
    }
  }, []);

  useEffect(() => {
    if (pathname && pathname.startsWith("/kai")) {
      localStorage.setItem("lastKaiPath", pathname);
      setKaiHref(pathname);
    }
  }, [pathname]);

  // If not authenticated, ONLY show the theme toggle in a floating pill
  if (!isAuthenticated) {
    return (
      <nav className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
        <div className="pointer-events-auto shadow-2xl rounded-full">
          <ThemeToggle className="bg-white/80 dark:bg-black/80 backdrop-blur-md border border-gray-200 dark:border-gray-800" />
        </div>
      </nav>
    );
  }

  // Navigation items with consistent sizing
  const navigationItems: NavItem[] = [
    {
      label: "Kai",
      href: kaiHref,
      icon: TrendingUp,
    },
    {
      label: "Consents",
      href: "/consents",
      icon: Bell,
      badge: pendingConsents,
    },
    {
      label: "Profile",
      href: "/profile",
      icon: User,
    },
    {
      label: "Agent Nav",
      href: "/agent-nav",
      icon: Mic,
    },
  ];

  return (
    <nav className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] inset-x-0 z-[120] flex justify-center px-4 pointer-events-none transform-gpu">
      <div className="pointer-events-auto flex items-center p-1 bg-muted/80 backdrop-blur-3xl border border-white/10 dark:border-white/5 rounded-full shadow-2xl ring-1 ring-black/5 min-h-[45px]">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          // Handle trailing slashes from Capacitor static export
          const normalizedPathname = pathname?.replace(/\/$/, "") || "";
          const normalizedHref = item.href.replace(/\/$/, "");

          const isActive =
            normalizedPathname === normalizedHref ||
            normalizedPathname.startsWith(normalizedHref + "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              data-tour-id={`nav-${item.label.toLowerCase().replace(" ", "-")}`}
              className={cn(
                "relative flex items-center justify-center gap-2 px-4 py-2.5 rounded-full transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)]",
                isActive
                  ? "bg-background text-foreground shadow-sm ring-1 ring-black/5 min-w-[120px]"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50 min-w-[44px]"
              )}
            >
              <div className="relative flex items-center justify-center">
                <Icon
                  className={cn(
                    "h-5 w-5 transition-transform duration-500 ease-[cubic-bezier(0.25,1,0.5,1)]",
                    isActive && "scale-105"
                  )}
                />
                {/* Badge */}
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 h-3.5 w-3.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center border-[1.5px] border-muted">
                    {item.badge > 9 ? "9" : item.badge}
                  </span>
                )}
              </div>

              <div
                className={cn(
                  "overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] flex items-center",
                  isActive
                    ? "w-auto max-w-[100px] opacity-100 ml-1"
                    : "w-0 max-w-0 opacity-0"
                )}
              >
                <span className="text-sm font-medium whitespace-nowrap">
                  {item.label}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
