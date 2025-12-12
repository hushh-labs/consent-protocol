"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";

// Agent Personas
const agents = [
  {
    id: "kai",
    name: "KAI",
    role: "The Optimizer",
    emoji: "💰",
    description: "Find the best deals, maximize value, optimize finances",
    color: "#C7A035",
  },
  {
    id: "kushal",
    name: "KUSHAL",
    role: "The Professional",
    emoji: "💼",
    description: "Your digital twin for career and professional contexts",
    color: "#007AFF",
  },
  {
    id: "nav",
    name: "NAV",
    role: "The Curator",
    emoji: "🎯",
    description: "Organize data, surface insights, curate experiences",
    color: "#BF5AF2",
  },
  {
    id: "orchestrator",
    name: "HUSHH",
    role: "The Orchestrator",
    emoji: "🤫",
    description: "Coordinate all agents, unified intelligence",
    color: "#DC143C",
  },
];

// Data categories
const dataCategories = [
  { name: "Financial", icon: "💰", color: "#30D158" },
  { name: "Calendar", icon: "📅", color: "#007AFF" },
  { name: "Professional", icon: "💼", color: "#BF5AF2" },
  { name: "Health", icon: "❤️", color: "#FF453A" },
  { name: "Preferences", icon: "⚙️", color: "#FF9F0A" },
  { name: "Network", icon: "👥", color: "#FFD60A" },
];

export default function HomePage() {
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

      {/* Hero Section */}
      <section className="pt-32 pb-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center justify-center gap-3 mb-8">
              <span className="text-6xl">🤫</span>
            </div>
            
            <h1 className="text-headline mb-6">
              Your Data.{" "}
              <span style={{ 
                background: "linear-gradient(135deg, var(--color-accent-red) 0%, var(--color-accent-gold) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent"
              }}>Your Business.</span>
            </h1>

            <p className="text-body text-secondary mb-10 max-w-2xl mx-auto">
              Consent-first personal AI agents that work exclusively for you.
              Your context stays private until YOU decide to share.
            </p>

            <div className="flex items-center justify-center gap-4">
              <Link href="/jarvis">
                <Button variant="gradient" effect="glass" showRipple size="lg">
                  Start Chat →
                </Button>
              </Link>
              <Link href="/docs">
                <Button variant="none" effect="glass" size="lg">
                  Learn More
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Agents Section */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-title mb-3">Meet Your Agents</h2>
            <p className="text-secondary">
              Four specialized personas, each with unique capabilities
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {agents.map((agent, i) => (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Link href={`/jarvis?persona=${agent.id}`}>
                  <Card 
                    variant="none" 
                    effect="glass" 
                    showRipple 
                    className="h-full text-center cursor-pointer"
                  >
                    <div 
                      className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center text-3xl"
                      style={{ background: `${agent.color}20` }}
                    >
                      {agent.emoji}
                    </div>
                    <CardTitle className="text-lg mb-1">{agent.name}</CardTitle>
                    <p className="text-xs font-medium mb-2" style={{ color: agent.color }}>
                      {agent.role}
                    </p>
                    <CardDescription className="text-sm">
                      {agent.description}
                    </CardDescription>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>

          <div className="text-center mt-8">
            <Link href="/personas">
              <Button variant="none" effect="glass" showRipple>
                View All Personas →
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Data Control Section */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-title mb-3">Your Data, Your Control</h2>
            <p className="text-secondary">
              Every data category requires explicit consent
            </p>
          </motion.div>

          <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
            {dataCategories.map((cat, i) => (
              <motion.div
                key={cat.name}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <Card variant="none" effect="glass" className="text-center p-4">
                  <div 
                    className="w-12 h-12 mx-auto mb-3 rounded-xl flex items-center justify-center text-xl"
                    style={{ background: `${cat.color}20` }}
                  >
                    {cat.icon}
                  </div>
                  <span className="text-xs font-medium text-primary">{cat.name}</span>
                </Card>
              </motion.div>
            ))}
          </div>

          <div className="text-center mt-8">
            <Link href="/consent">
              <Button variant="none" effect="glass" showRipple>
                Manage Permissions →
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6" style={{ background: "var(--color-text-primary)" }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto text-center"
        >
          <h2 className="text-title mb-4 text-white">
            Ready to take control?
          </h2>
          <p className="mb-8" style={{ color: "rgba(255,255,255,0.6)" }}>
            Start building your personal AI context today.
          </p>
          <Link href="/jarvis">
            <Button variant="gradient" effect="glass" showRipple size="lg">
              Launch Agent →
            </Button>
          </Link>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6" style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between text-small text-tertiary">
          <span>🤫 hushh</span>
          <div className="flex items-center gap-6">
            <Link href="/docs" className="hover:text-primary">Docs</Link>
            <Link href="/consent" className="hover:text-primary">Privacy</Link>
          </div>
          <span>Powered by Google ADK</span>
        </div>
      </footer>
    </main>
  );
}
