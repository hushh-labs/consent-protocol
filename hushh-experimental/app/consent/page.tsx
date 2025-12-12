"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";

// Data categories with permissions
const dataCategories = [
  {
    id: "financial",
    name: "Financial",
    icon: "💰",
    color: "#30D158",
    description: "Spending, budgets, bank accounts, investments",
    examples: ["Track spending patterns", "Budget recommendations", "Investment insights"],
  },
  {
    id: "calendar",
    name: "Calendar",
    icon: "📅",
    color: "#007AFF",
    description: "Events, meetings, schedule, reminders",
    examples: ["Schedule optimization", "Meeting prep", "Time blocking"],
  },
  {
    id: "professional",
    name: "Professional",
    icon: "💼",
    color: "#BF5AF2",
    description: "Skills, projects, resume, career history",
    examples: ["Resume analysis", "Career mapping", "Skill tracking"],
  },
  {
    id: "health",
    name: "Health",
    icon: "❤️",
    color: "#FF453A",
    description: "Fitness, wellness, medical information",
    examples: ["Fitness tracking", "Health insights", "Wellness tips"],
  },
  {
    id: "preferences",
    name: "Preferences",
    icon: "⚙️",
    color: "#FF9F0A",
    description: "Likes, style, settings, habits",
    examples: ["Personalized recommendations", "Style preferences", "Product suggestions"],
  },
  {
    id: "network",
    name: "Network",
    icon: "👥",
    color: "#FFD60A",
    description: "Contacts, relationships, connections",
    examples: ["Relationship insights", "Network analysis", "Contact management"],
  },
];

export default function ConsentPage() {
  const [permissions, setPermissions] = useState<Record<string, boolean>>({
    financial: true,
    calendar: true,
    professional: true,
    health: false,
    preferences: true,
    network: false,
  });

  const togglePermission = (id: string) => {
    setPermissions((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const enabledCount = Object.values(permissions).filter(Boolean).length;

  return (
    <main className="min-h-screen">
      {/* Navigation */}
      <nav className="nav-glass fixed top-0 left-0 right-0 z-50 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">🤫</span>
            <span className="font-semibold text-primary text-lg">hushh</span>
          </Link>

          <div className="flex items-center gap-6">
            <Link href="/personas" className="nav-link">Personas</Link>
            <Link href="/docs" className="nav-link">Docs</Link>
            <Link href="/jarvis">
              <Button variant="gradient" effect="glass" showRipple size="sm">
                Open Chat
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Header */}
      <section className="pt-32 pb-12 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="text-headline mb-4">Data Permissions</h1>
            <p className="text-body text-secondary max-w-2xl mx-auto">
              Control exactly what your AI agents can access.
              Toggle categories on/off at any time.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="px-6 pb-8">
        <div className="max-w-4xl mx-auto">
          <Card variant="none" effect="glass" className="text-center py-6">
            <div className="flex items-center justify-center gap-8">
              <div>
                <p className="text-3xl font-bold" style={{ color: "var(--color-accent-red)" }}>
                  {enabledCount}
                </p>
                <p className="text-sm text-secondary">Categories Enabled</p>
              </div>
              <div className="w-px h-12 bg-gray-200" />
              <div>
                <p className="text-3xl font-bold" style={{ color: "var(--color-accent-gold)" }}>
                  {dataCategories.length - enabledCount}
                </p>
                <p className="text-sm text-secondary">Categories Disabled</p>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Permission Cards */}
      <section className="px-6 pb-20">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-2 gap-6">
            {dataCategories.map((category, i) => (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Card
                  variant="none"
                  effect="glass"
                  showRipple
                  onClick={() => togglePermission(category.id)}
                  className="cursor-pointer"
                  style={{
                    borderLeft: `4px solid ${permissions[category.id] ? category.color : "transparent"}`,
                  }}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                      style={{ background: `${category.color}20` }}
                    >
                      {category.icon}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <CardTitle className="text-base">{category.name}</CardTitle>
                        <div
                          className={`w-12 h-6 rounded-full transition-all cursor-pointer flex items-center ${
                            permissions[category.id] ? "justify-end" : "justify-start"
                          }`}
                          style={{
                            background: permissions[category.id] ? category.color : "#E5E5E5",
                            padding: "2px",
                          }}
                        >
                          <div className="w-5 h-5 rounded-full bg-white shadow-sm" />
                        </div>
                      </div>
                      <CardDescription className="mb-3">{category.description}</CardDescription>
                      <div className="flex flex-wrap gap-2">
                        {category.examples.map((ex) => (
                          <span
                            key={ex}
                            className="text-xs px-2 py-1 rounded-full"
                            style={{
                              background: `${category.color}15`,
                              color: category.color,
                            }}
                          >
                            {ex}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6" style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between text-small text-tertiary">
          <span>🤫 hushh</span>
          <Link href="/docs" className="hover:text-primary">Documentation</Link>
          <span>Your data, your control</span>
        </div>
      </footer>
    </main>
  );
}
