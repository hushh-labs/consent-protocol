// components/navbar.tsx
// Bottom Pill Navigation for Hushh PDA

"use client";

import React, { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, Button } from "@/lib/morphy-ux/morphy";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Home,
  FileText,
  LayoutDashboard,
  LogIn,
  LogOut,
  Code,
} from "lucide-react";
import { signOut, onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { useAuth } from "@/hooks/use-auth";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  requiresAuth?: boolean;
}

const navigationItems: NavItem[] = [
  { label: "Home", href: "/", icon: Home },
  { label: "API", href: "/api-docs", icon: Code },
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    requiresAuth: true,
  },
];

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
        "flex flex-col items-center justify-center h-auto px-2 sm:px-4 py-1.5 sm:py-2 rounded-xl",
        // Inactive: muted text with hover
        !isActive && "text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 sm:h-5 sm:w-5 mb-0.5",
          // Active icon: gradient start color (blue light, gold dark)
          isActive && "text-(--morphy-primary-start)"
        )}
      />
      <span
        className={cn(
          "text-[10px] sm:text-xs font-medium",
          // Active text: gradient effect
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

export const Navbar = () => {
  const pathname = usePathname();
  const router = useRouter();

  // Check if user is authenticated (Unified Native/Web Logic via Hook)
  // This ensures Navbar state matches the rest of the app (e.g. protected routes)
  const { isAuthenticated, user, signOut } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (err) {
      console.warn("Logout error:", err);
    }
    // Router push is handled by signOut in useAuth, but safe to do here too if needed
  };

  // Filter navigation items based on auth status
  const filteredItems = navigationItems.filter(
    (item) => !item.requiresAuth || isAuthenticated
  );

  return (
    <nav className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-0 right-0 z-50 flex justify-center px-4">
      <Card
        variant="none"
        effect="fill"
        className="px-3 py-2 rounded-full bg-white dark:bg-black border border-gray-200 dark:border-gray-800 shadow-2xl"
      >
        <div className="flex items-center gap-1">
          {/* Navigation Items */}
          {filteredItems.map((item) => {
            const isActive =
              pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <NavButton key={item.href} item={item} isActive={isActive} />
            );
          })}

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

          {/* Theme Toggle - no wrapper hover, Button has its own effects */}
          <div className="flex flex-col items-center justify-center px-2 py-2">
            <ThemeToggle />
          </div>
        </div>
      </Card>
    </nav>
  );
};
