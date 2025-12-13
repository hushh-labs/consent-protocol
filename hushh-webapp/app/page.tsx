/**
 * Home Page
 * =========
 * 
 * Landing page that redirects to login for unauthenticated users.
 * Uses Hushh brand gradient text.
 */

"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/lib/firebase";

const features = [
  {
    icon: "🔐",
    title: "Consent-First",
    description: "Every data access requires explicit user permission with time-limited tokens.",
  },
  {
    icon: "🧬",
    title: "Operons",
    description: "Modular data logic units that execute only with valid consent.",
  },
  {
    icon: "🤖",
    title: "AI Agents",
    description: "Personal AI assistants that work for you, not against you.",
  },
  {
    icon: "🔒",
    title: "Encrypted Vault",
    description: "Your data encrypted at rest with AES-256-GCM.",
  },
];

const domains = [
  { icon: "🍽️", name: "Food & Dining", status: "live" },
  { icon: "👗", name: "Fashion", status: "soon" },
  { icon: "💪", name: "Health", status: "soon" },
  { icon: "✈️", name: "Travel", status: "soon" },
];

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Show loading state while checking auth
  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">🤫</div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </main>
    );
  }

  // If not logged in, show nothing (redirect happening)
  if (!user) {
    return null;
  }

  return (
    <main className="flex-1">
      {/* Hero Section */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-sm text-foreground">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            System Active
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold leading-tight text-foreground">
            Your Data.
            <br />
            <span className="hushh-gradient-text">
              Your Control.
            </span>
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Hushh is the infrastructure for consent-first personal data agents. 
            AI that works for you, with privacy built in.
          </p>
          
          <div className="flex items-center justify-center gap-4 pt-4">
            <Link href="/dashboard">
              <Button variant="gradient" effect="glass" showRipple className="text-lg px-8 py-6">
                Go to Dashboard
              </Button>
            </Link>
            <Link href="/docs">
              <Button variant="none" effect="glass" className="text-lg px-8 py-6">
                Documentation
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-6 bg-secondary/50 dark:bg-secondary/20">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12 text-foreground">
            Built on <span className="hushh-gradient-text">Consent</span>
          </h2>
          
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <Card key={feature.title} variant="none" effect="glass" className="p-6">
                <div className="text-3xl mb-4">{feature.icon}</div>
                <CardTitle className="mb-2 text-foreground">{feature.title}</CardTitle>
                <CardDescription className="text-muted-foreground">{feature.description}</CardDescription>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Data Domains */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4 text-foreground">
            Personal <span className="hushh-gradient-text">Data Domains</span>
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Connect and control your personal data across different aspects of your life.
          </p>
          
          <div className="flex flex-wrap justify-center gap-4">
            {domains.map((domain) => (
              <div
                key={domain.name}
                className={`flex items-center gap-3 px-6 py-3 rounded-full border ${
                  domain.status === "live"
                    ? "bg-card/50 border-border text-foreground"
                    : "bg-card/20 border-border/50 text-muted-foreground opacity-60"
                }`}
              >
                <span className="text-2xl">{domain.icon}</span>
                <span className="font-medium">{domain.name}</span>
                {domain.status === "live" && (
                  <span className="px-2 py-0.5 rounded text-xs bg-green-500/20 text-green-600 dark:text-green-300">
                    Live
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
