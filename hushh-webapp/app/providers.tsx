"use client";

/**
 * Unified Client Providers
 *
 * Wraps all client-side providers in a single "use client" boundary
 * to ensure proper hydration and avoid server/client mismatch issues.
 *
 * Uses StepProgressProvider for step-based loading progress tracking.
 * Pages register their loading steps and the progress bar shows real progress.
 *
 * CacheProvider enables data sharing across page navigations to reduce API calls.
 */

import { ReactNode } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/lib/firebase";
import { VaultProvider } from "@/lib/vault/vault-context";
import { NavigationProvider } from "@/lib/navigation/navigation-context";
import { StepProgressProvider } from "@/lib/progress/step-progress-context";
import { StepProgressBar } from "@/components/ui/step-progress-bar";
import { CacheProvider } from "@/lib/cache/cache-context";
import { ConsentSSEProvider } from "@/lib/consent";
import { ConsentNotificationProvider } from "@/components/consent/notification-provider";
import { StatusBarBlur, TopAppBar } from "@/components/ui/top-app-bar";
import { Navbar } from "@/components/navbar";
import { Toaster } from "@/components/ui/sonner";

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <StepProgressProvider>
        {/* Step-based progress bar at top of viewport */}
        <StepProgressBar />
        <AuthProvider>
          <CacheProvider>
            <VaultProvider>
              <ConsentSSEProvider>
                <ConsentNotificationProvider>
                  <NavigationProvider>
                    {/* Flex container for proper scroll behavior */}
                    <div className="flex flex-col flex-1 min-h-0">
                      <Navbar />
                      <StatusBarBlur />
                      <TopAppBar />
                      {/* Main scroll container: extends under fixed bar so content can scroll behind it; padding clears bar height */}
                      <div className="flex-1 overflow-y-auto pb-[calc(6rem+env(safe-area-inset-bottom))] relative z-10 min-h-0 pt-[45px]">
                        {children}
                      </div>
                    </div>
                    <Toaster />
                  </NavigationProvider>
                </ConsentNotificationProvider>
              </ConsentSSEProvider>
            </VaultProvider>
          </CacheProvider>
        </AuthProvider>
      </StepProgressProvider>
    </ThemeProvider>
  );
}
