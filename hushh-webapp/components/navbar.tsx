// components/navbar.tsx
// Bottom Pill Navigation for Hushh PDA

"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/lib/morphy-ux/morphy";
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

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  requiresAuth?: boolean;
}

const navigationItems: NavItem[] = [
  { label: "Home", href: "/", icon: Home },
  { label: "Docs", href: "/docs", icon: FileText },
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

  const content = (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-2 sm:px-4 py-1.5 sm:py-2 rounded-xl transition-all cursor-pointer",
        isActive
          ? "bg-linear-to-br from-blue-500 to-purple-600 dark:from-gray-300 dark:to-gray-500 text-white dark:text-black shadow-lg"
          : "text-muted-foreground hover:text-foreground hover:bg-accent"
      )}
      onClick={onClick}
    >
      <Icon
        className={cn(
          "h-4 w-4 sm:h-5 sm:w-5 mb-0.5",
          isActive && "dark:text-black"
        )}
      />
      <span className="text-[10px] sm:text-xs font-medium">{item.label}</span>
    </div>
  );

  if (onClick) {
    return <div>{content}</div>;
  }

  return <Link href={item.href}>{content}</Link>;
};

export const Navbar = () => {
  const pathname = usePathname();
  const router = useRouter();

  // Check if user is logged in
  const [isLoggedIn, setIsLoggedIn] = React.useState(false);

  React.useEffect(() => {
    const checkAuth = () => {
      const userId = sessionStorage.getItem("user_id");
      setIsLoggedIn(!!userId);
    };

    // Check on mount
    checkAuth();

    // Check periodically (in case sessionStorage changes)
    const interval = setInterval(checkAuth, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    sessionStorage.clear();
    setIsLoggedIn(false);
    router.push("/logout");
  };

  // Filter navigation items based on auth status
  const filteredItems = navigationItems.filter(
    (item) => !item.requiresAuth || isLoggedIn
  );

  return (
    <nav className="fixed bottom-4 left-0 right-0 z-50 flex justify-center px-4">
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
          {isLoggedIn ? (
            <NavButton
              item={{ label: "Logout", href: "/logout", icon: LogOut }}
              isActive={false}
              onClick={handleLogout}
            />
          ) : (
            <NavButton
              item={{ label: "Login", href: "/login", icon: LogIn }}
              isActive={pathname === "/login"}
            />
          )}

          {/* Theme Toggle */}
          <div className="flex flex-col items-center justify-center px-4 py-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer transition-all">
            <ThemeToggle />
          </div>
        </div>
      </Card>
    </nav>
  );
};
