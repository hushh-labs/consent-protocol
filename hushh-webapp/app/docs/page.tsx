"use client";

import Link from "next/link";
import {
  Button,
  Card,
  CardTitle,
  CardDescription,
} from "@/lib/morphy-ux/morphy";
import {
  ShieldCheck,
  Lock,
  Zap,
  Code,
  ArrowRight,
  Database,
  Key,
  Eye,
} from "lucide-react";

export default function DocsPage() {
  return (
    <main className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative px-4 py-16 md:py-24 max-w-5xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-sm font-medium mb-6">
          <Lock className="h-4 w-4" />
          <span>Consent Protocol v1.0</span>
        </div>

        <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
          Your Data.{" "}
          <span className="bg-linear-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
            Your Vault.
          </span>{" "}
          Your Agents.
        </h1>

        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
          Hushh is a consent-first personal data platform where AI works{" "}
          <strong>for you</strong>, not against you. Every action requires your
          explicit cryptographic permission.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/dashboard">
            <Button
              variant="gradient"
              effect="glass"
              size="lg"
              showRipple
              className="w-full sm:w-auto"
            >
              Get Started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Link href="/docs/developer-api">
            <Button
              variant="none"
              effect="glass"
              size="lg"
              className="w-full sm:w-auto border border-gray-200 dark:border-gray-800"
            >
              <Code className="mr-2 h-4 w-4" />
              Developer API
            </Button>
          </Link>
        </div>
      </section>

      {/* How It Works */}
      <section className="px-4 py-16 max-w-5xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-4">
          How It Works
        </h2>
        <p className="text-muted-foreground text-center mb-12 max-w-xl mx-auto">
          Traditional AI sends your data to servers. Hushh keeps it encrypted
          locally.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: ShieldCheck,
              title: "Consent First",
              desc: "Every action requires your explicit permission via signed consent tokens.",
              color: "from-emerald-500 to-teal-500",
            },
            {
              icon: Lock,
              title: "Zero Knowledge",
              desc: "Your data is encrypted in your browser. The server only sees ciphertext.",
              color: "from-blue-500 to-cyan-500",
            },
            {
              icon: Database,
              title: "Encrypted Vault",
              desc: "AES-256-GCM encryption with keys only you control.",
              color: "from-purple-500 to-pink-500",
            },
          ].map((item) => (
            <Card
              key={item.title}
              variant="none"
              effect="glass"
              className="p-6 text-center"
            >
              <div
                className={`h-14 w-14 rounded-2xl bg-linear-to-br ${item.color} flex items-center justify-center mx-auto mb-4`}
              >
                <item.icon className="h-7 w-7 text-white" />
              </div>
              <CardTitle className="text-lg mb-2">{item.title}</CardTitle>
              <CardDescription>{item.desc}</CardDescription>
            </Card>
          ))}
        </div>
      </section>

      {/* The Promise */}
      <section className="px-4 py-16 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <Card
            variant="none"
            effect="glass"
            className="p-8 md:p-12 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-linear-to-bl from-blue-500/10 to-transparent rounded-full -mr-32 -mt-32" />

            <div className="relative">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-5xl">🤫</span>
                <h2 className="text-2xl md:text-3xl font-bold">
                  The Hushh Promise
                </h2>
              </div>

              <blockquote className="text-xl md:text-2xl italic text-muted-foreground mb-8 border-l-4 border-blue-500 pl-6">
                "Your data stays quiet until YOU decide to share it."
              </blockquote>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { icon: Key, text: "You own your encryption keys" },
                  { icon: Eye, text: "Full visibility into data usage" },
                  { icon: ArrowRight, text: "Export or delete anytime" },
                  { icon: ShieldCheck, text: "We never sell your data" },
                ].map((item) => (
                  <div
                    key={item.text}
                    className="flex items-center gap-3 text-sm md:text-base"
                  >
                    <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                      <item.icon className="h-4 w-4 text-green-600" />
                    </div>
                    <span>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Active Agents */}
      <section className="px-4 py-16 max-w-5xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-4">
          Your Personal Agents
        </h2>
        <p className="text-muted-foreground text-center mb-12 max-w-xl mx-auto">
          Specialized AI agents that work within your consent boundaries.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            {
              emoji: "🍽️",
              name: "Food & Dining",
              desc: "Dietary preferences, cuisines, and budget tracking",
              status: "Active",
            },
            {
              emoji: "💼",
              name: "Professional Profile",
              desc: "Skills, experience, and career goals",
              status: "Active",
            },
            {
              emoji: "🛍️",
              name: "Shopping",
              desc: "Purchase preferences and style",
              status: "Coming Soon",
            },
            {
              emoji: "✈️",
              name: "Travel",
              desc: "Trip preferences and destinations",
              status: "Coming Soon",
            },
          ].map((agent) => (
            <Card
              key={agent.name}
              variant="none"
              effect="glass"
              className="p-5 flex items-start gap-4"
            >
              <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center text-2xl shrink-0">
                {agent.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold truncate">{agent.name}</h3>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${
                      agent.status === "Active"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                    }`}
                  >
                    {agent.status}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{agent.desc}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-16 max-w-3xl mx-auto text-center">
        <Card variant="none" effect="glass" className="p-8 md:p-12">
          <span className="text-5xl mb-4 block">🔐</span>
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Ready to Take Control?
          </h2>
          <p className="text-muted-foreground mb-8">
            Your privacy-first AI agents are waiting. Start building your
            encrypted vault today.
          </p>
          <Link href="/login">
            <Button variant="gradient" effect="glass" size="lg" showRipple>
              Create Your Vault
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t px-4 py-8">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="text-xl">🤫</span>
            <span>Hushh - Personal Data Agents</span>
          </div>
          <div className="flex gap-6">
            <Link
              href="/docs/developer-api"
              className="hover:text-foreground transition-colors"
            >
              Developer API
            </Link>
            <a
              href="https://github.com/hushh"
              className="hover:text-foreground transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
