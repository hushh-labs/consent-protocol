/**
 * Bottom Navigation Component
 * ===========================
 *
 * Mobile-first bottom navigation bar with proper dark mode theming.
 * Uses CSS variables for glass effect that automatically switches in dark mode.
 */

"use client";

import React from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/firebase";
import { cn } from "@/lib/utils";

// Navigation items for bottom nav
const navItems = [
  { href: "/", label: "Home", icon: "🏠" },
  { href: "/docs", label: "Docs", icon: "📚" },
  { href: "/kai", label: "Kai", icon: "📈", requiresAuth: true },
  { href: "/login", label: "Account", icon: "👤", showWhenLoggedOut: true },
];

export function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();

  // Don't show bottom nav on login page


  // Filter items based on auth state
  const visibleItems = navItems.filter((item) => {
    if (item.requiresAuth && !user) return false;
    if (item.showWhenLoggedOut && user) return false;
    return true;
  });

  // Replace Account with profile when logged in
  const items = user
    ? [
        ...visibleItems.filter((i) => i.href !== "/login"),
        { href: "/profile", label: "Profile", icon: "👤" },
      ]
    : visibleItems;

  // Check if path is active
  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  };

  // Sticky Kai path
  const [kaiHref, setKaiHref] = React.useState("/kai");

  React.useEffect(() => {
    const saved = localStorage.getItem("lastKaiPath");
    if (saved) {
      setKaiHref(saved);
    }
  }, []);

  React.useEffect(() => {
    if (pathname.startsWith("/kai")) {
      localStorage.setItem("lastKaiPath", pathname);
      setKaiHref(pathname);
    }
  }, [pathname]);

  // Don't show bottom nav on login page
  if (pathname === "/login") return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      {/* Glass background using CSS variables that automatically switch in dark mode */}
      <div
        className="backdrop-blur-xl border-t safe-area-pb"
        style={{
          backgroundColor: "var(--glass-fill)",
          borderColor: "var(--glass-border)",
        }}
      >
        <div className="flex items-center justify-around px-2 py-3">
          {items
            .filter(
              (item, index, self) =>
                self.findIndex((i) => i.href === item.href) === index
            )
            .slice(0, 5)
            .map((item) => {
              // Override href for Kai item; Profile uses /profile
              const finalHref =
                item.label === "Kai" ? kaiHref : item.href;

              return (
                <Link
                  key={`${item.href}-${item.label}`}
                  href={finalHref}
                  className={cn(
                    "flex flex-col items-center gap-1 px-4 py-2 rounded-2xl transition-all min-w-[64px]",
                    isActive(item.href)
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span className="text-xs font-medium">{item.label}</span>
                </Link>
              );
            })}
        </div>
      </div>
    </nav>
  );
}

export default BottomNav;
