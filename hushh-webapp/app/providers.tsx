"use client";

/**
 * Unified Client Providers
 *
 * Wraps all client-side providers in a single "use client" boundary
 * to ensure proper hydration and avoid server/client mismatch issues.
 */

import { ReactNode } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/lib/firebase";
import { VaultProvider } from "@/lib/vault/vault-context";
import { NavigationProvider } from "@/lib/navigation/navigation-context";
import { TopAppBar, TopAppBarSpacer } from "@/components/ui/top-app-bar";
import { Navbar } from "@/components/navbar";
import { Toaster } from "@/components/ui/sonner";

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <AuthProvider>
        <VaultProvider>
          <NavigationProvider>
            <Navbar />
            <TopAppBar />
            <TopAppBarSpacer />
            {/* Main scroll container - applies to ALL routes */}
            <div className="flex-1 overflow-y-auto pb-24 relative z-10">
              {children}
            </div>
            <Toaster />
          </NavigationProvider>
        </VaultProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
