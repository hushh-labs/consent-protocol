"use client";

/**
 * Kai Landing Page - First page after login
 *
 * Hero and value proposition for the finance-focused AI committee.
 * Primary CTA: Open Kai Dashboard.
 */

import { useRouter } from "next/navigation";
import { Button, Card, CardContent } from "@/lib/morphy-ux/morphy";
import { TrendingUp, BarChart3, Shield, ArrowRight } from "lucide-react";

export default function KaiLandingPage() {
  const router = useRouter();

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-6 min-h-0">
      <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Hero */}
        <div className="text-center space-y-4">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <TrendingUp className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            Your AI investment committee
          </h1>
          <p className="text-muted-foreground text-balance">
            Kai – Smarter portfolio decisions. Private. Encrypted. Yours.
          </p>
        </div>

        {/* Value bullets */}
        <div className="space-y-3">
          <Card variant="none" effect="glass" className="p-4">
            <CardContent className="p-0 flex items-start gap-3">
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Portfolio overview</h3>
                <p className="text-xs text-muted-foreground">
                  KPIs, allocation, and risk at a glance.
                </p>
              </div>
            </CardContent>
          </Card>
          <Card variant="none" effect="glass" className="p-4">
            <CardContent className="p-0 flex items-start gap-3">
              <div className="p-2 rounded-xl bg-green-500/10 text-green-600 dark:text-green-400 shrink-0">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Analysis and debate</h3>
                <p className="text-xs text-muted-foreground">
                  AI-powered insights with your data staying on-device.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* CTA */}
        <div className="pt-4">
          <Button
            variant="gradient"
            size="xl"
            className="w-full h-14 text-lg shadow-lg shadow-primary/25 rounded-2xl"
            onClick={() => router.push("/kai/dashboard")}
            showRipple
          >
            Open Kai Dashboard
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </div>
    </main>
  );
}
