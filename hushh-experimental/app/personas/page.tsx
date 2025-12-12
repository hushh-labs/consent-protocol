"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const personas = [
  {
    id: "kushal",
    name: "KUSHAL",
    codename: "THE PROFESSIONAL",
    emoji: "💼",
    tagline: "Your Digital Twin",
    description: "I am your professional persona, digitized. With exhaustive context about your career, skills, and experiences, I represent you accurately in any professional context.",
    capabilities: ["Resume Analysis", "Interview Prep", "Career Mapping", "Portfolio", "Networking", "Skills"],
    stats: { context: "1M tokens", accuracy: "98%", speed: "<2s" },
    color: "#007AFF",
    endpoint: "/kushal",
  },
  {
    id: "kai",
    name: "KAI",
    codename: "THE HUSTLER",
    emoji: "💰",
    tagline: "Optimize Everything",
    description: "I'm the hustler, always looking for the best deal. Whether selling your old devices or finding the perfect purchase, I maximize your value.",
    capabilities: ["Price Compare", "Resale Value", "Deal Finder", "Market Analysis", "Trade-in", "CFO Tasks"],
    stats: { savings: "avg 23%", markets: "12+", deals: "1000+/day" },
    color: "#C7A035",
    endpoint: "/kai",
  },
  {
    id: "nav",
    name: "NAV",
    codename: "THE CURATOR",
    emoji: "🎯",
    tagline: "Data Sovereignty",
    description: "I curate and organize your digital life. From browsing patterns to preferences, I help you understand and monetize your own data.",
    capabilities: ["Data Curation", "Insights", "Monetization", "Brand Matching", "Privacy", "Control"],
    stats: { categories: "50+", brands: "200+", earnings: "$0-500/mo" },
    color: "#BF5AF2",
    endpoint: "/nav",
  },
  {
    id: "orchestrator",
    name: "HUSHH",
    codename: "THE ORCHESTRATOR",
    emoji: "🤫",
    tagline: "Unified Intelligence",
    description: "I coordinate all agents into a seamless experience. Ask anything, and I'll route to the right specialist while maintaining your complete context.",
    capabilities: ["Multi-Agent", "Context Sync", "Routing", "Memory", "Learning", "Synthesis"],
    stats: { agents: "4", latency: "<100ms", context: "∞" },
    color: "#DC143C",
    endpoint: "/",
  },
];

export default function PersonasPage() {
  const [selectedPersona, setSelectedPersona] = useState<typeof personas[0] | null>(null);

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
            <Link href="/consent" className="nav-link">Consent</Link>
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
            <h1 className="text-headline mb-4">Agent Personas</h1>
            <p className="text-body text-secondary max-w-2xl mx-auto">
              Four specialized AI agents, each with unique capabilities.
              Choose the right one for your needs.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Persona Grid */}
      <section className="px-6 pb-20">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8">
            {personas.map((persona, i) => (
              <motion.div
                key={persona.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Card
                  variant="none"
                  effect="glass"
                  className="h-full"
                  style={{ borderTop: `4px solid ${persona.color}` }}
                >
                  {/* Header */}
                  <div className="flex items-start gap-4 mb-4">
                    <div
                      className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
                      style={{ background: `${persona.color}20` }}
                    >
                      {persona.emoji}
                    </div>
                    <div>
                      <CardTitle className="text-xl">{persona.name}</CardTitle>
                      <p className="text-xs font-medium" style={{ color: persona.color }}>
                        {persona.codename}
                      </p>
                      <p className="text-sm text-secondary mt-1">{persona.tagline}</p>
                    </div>
                  </div>

                  {/* Description */}
                  <CardDescription className="mb-4">{persona.description}</CardDescription>

                  {/* Capabilities */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {persona.capabilities.map((cap) => (
                      <span
                        key={cap}
                        className="text-xs px-2 py-1 rounded-full"
                        style={{ background: `${persona.color}15`, color: persona.color }}
                      >
                        {cap}
                      </span>
                    ))}
                  </div>

                  {/* Stats */}
                  <div
                    className="grid grid-cols-3 gap-4 py-4 mb-4"
                    style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}
                  >
                    {Object.entries(persona.stats).map(([key, value]) => (
                      <div key={key} className="text-center">
                        <p className="text-lg font-bold" style={{ color: persona.color }}>
                          {value}
                        </p>
                        <p className="text-xs text-secondary uppercase">{key}</p>
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3">
                    <Link href={`/jarvis?persona=${persona.id}`} className="flex-1">
                      <Button variant="gradient" effect="glass" showRipple className="w-full">
                        Start Chat
                      </Button>
                    </Link>
                    <Button
                      variant="none"
                      effect="glass"
                      onClick={() => setSelectedPersona(persona)}
                    >
                      Details
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Detail Modal */}
      {selectedPersona && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setSelectedPersona(null)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
          >
            <Card variant="none" effect="glass" className="max-w-lg w-full">
              <div className="flex items-center gap-4 mb-6">
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl"
                  style={{ background: `${selectedPersona.color}20` }}
                >
                  {selectedPersona.emoji}
                </div>
                <div>
                  <CardTitle className="text-2xl">{selectedPersona.name}</CardTitle>
                  <p className="font-medium" style={{ color: selectedPersona.color }}>
                    {selectedPersona.codename}
                  </p>
                </div>
              </div>

              <CardDescription className="text-base mb-6">
                {selectedPersona.description}
              </CardDescription>

              <div className="flex gap-4">
                <Link href={`/jarvis?persona=${selectedPersona.id}`} className="flex-1">
                  <Button variant="gradient" effect="glass" showRipple className="w-full">
                    Start Conversation
                  </Button>
                </Link>
                <Button variant="none" effect="glass" onClick={() => setSelectedPersona(null)}>
                  Close
                </Button>
              </div>
            </Card>
          </motion.div>
        </motion.div>
      )}

      {/* Footer */}
      <footer className="py-8 px-6" style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between text-small text-tertiary">
          <span>🤫 hushh</span>
          <Link href="/docs" className="hover:text-primary">Documentation</Link>
          <span>Powered by Google ADK</span>
        </div>
      </footer>
    </main>
  );
}
