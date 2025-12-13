/**
 * Navigation Component
 * ====================
 * 
 * Global navigation header with auth state awareness.
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from '@/lib/morphy-ux/morphy';
import { useAuth } from "@/lib/firebase";

const navItems = [
  { href: "/", label: "Home", public: true },
  { href: "/docs", label: "Docs", public: true },
  { href: "/dashboard", label: "Dashboard", public: false },
];

export function Navigation() {
  const pathname = usePathname();
  const { user, loading, signOut } = useAuth();
  
  // Don't show nav on login page
  if (pathname === "/login") return null;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-background/80 border-b border-white/10">
      <nav className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <span className="text-2xl">🤫</span>
          <span className="font-semibold text-lg">Hushh</span>
        </Link>

        {/* Nav Links */}
        <div className="hidden md:flex items-center gap-1">
          {navItems.map((item) => {
            // Skip private items if not logged in
            if (!item.public && !user) return null;
            
            const isActive = pathname === item.href || 
              (item.href !== "/" && pathname.startsWith(item.href));
            
            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant="none"
                  className={`px-4 py-2 rounded-lg transition-all ${
                    isActive
                      ? "bg-white/10 text-white"
                      : "text-secondary hover:text-white hover:bg-white/5"
                  }`}
                >
                  {item.label}
                </Button>
              </Link>
            );
          })}
        </div>

        {/* Auth Actions */}
        <div className="flex items-center gap-3">
          {loading ? (
            <div className="w-8 h-8 rounded-full bg-white/10 animate-pulse" />
          ) : user ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-secondary hidden sm:block">
                {user.phoneNumber}
              </span>
              <Button
                variant="none"
                effect="glass"
                className="text-sm"
                onClick={() => signOut()}
              >
                Sign Out
              </Button>
            </div>
          ) : (
            <Link href="/login">
              <Button variant="gradient" effect="glass" showRipple className="text-sm">
                Sign In
              </Button>
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
