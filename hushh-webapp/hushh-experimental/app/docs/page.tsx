"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";

import {
  BookOpenIcon,
  ShieldCheckIcon,
  BrainIcon,
  UsersIcon,
  HandshakeIcon,
  ClockIcon,
  CodeIcon,
  RocketIcon,
  LockIcon,
  EyeIcon,
  ArrowRightIcon,
  ChatCircleIcon,
  GearIcon,
} from "@phosphor-icons/react";

// Sidebar sections
const docsSections = [
  {
    title: "Introduction",
    items: [
      { id: "about", label: "About Hushh", icon: BookOpenIcon },
      { id: "philosophy", label: "The 🤫 Promise", icon: ShieldCheckIcon },
    ],
  },
  {
    title: "Core Concepts",
    items: [
      { id: "consent", label: "Consent Flow", icon: HandshakeIcon },
      { id: "data", label: "Data Categories", icon: UsersIcon },
      { id: "agents", label: "Agent Modes", icon: BrainIcon },
    ],
  },
  {
    title: "API Reference",
    items: [
      { id: "endpoints", label: "Endpoints", icon: CodeIcon },
      { id: "examples", label: "Examples", icon: RocketIcon },
    ],
  },
];

// Data categories
const dataCategories = [
  { name: "Financial", icon: "💰", color: "#30D158", desc: "Spending, budgets" },
  { name: "Calendar", icon: "📅", color: "#007AFF", desc: "Events, meetings" },
  { name: "Professional", icon: "💼", color: "#BF5AF2", desc: "Skills, career" },
  { name: "Health", icon: "❤️", color: "#FF453A", desc: "Fitness, wellness" },
  { name: "Preferences", icon: "⚙️", color: "#FF9F0A", desc: "Likes, style" },
  { name: "Network", icon: "👥", color: "#FFD60A", desc: "Contacts" },
];

// Agent modes
const agentModes = [
  { id: "optimizer", name: "Optimizer", icon: "📈", endpoint: "/kai", desc: "Find deals, maximize value" },
  { id: "curator", name: "Curator", icon: "🎯", endpoint: "/nav", desc: "Organize data, insights" },
  { id: "professional", name: "Professional", icon: "💼", endpoint: "/kushal", desc: "Career context" },
  { id: "orchestrator", name: "Orchestrator", icon: "🔗", endpoint: "/", desc: "Coordinate agents" },
];

// Consent flow steps
const consentSteps = [
  { step: 1, title: "Agent Requests Data", time: "Instant" },
  { step: 2, title: "System Checks Permission", time: "Instant" },
  { step: 3, title: "User Sees Approval Request", time: "3 min window" },
  { step: 4, title: "Pending if No Response", time: "24 hours" },
  { step: 5, title: "Access Granted or Denied", time: "Immediate" },
];

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState("about");

  useEffect(() => {
    const handleScroll = () => {
      const sections = docsSections.flatMap((s) => s.items.map((i) => i.id));
      for (const id of sections) {
        const el = document.getElementById(id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 150 && rect.bottom > 150) {
            setActiveSection(id);
            break;
          }
        }
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <main className="min-h-screen flex" style={{ background: "var(--color-background)" }}>
      {/* Sidebar */}
      <aside 
        className="fixed left-0 top-0 h-full w-64 glass-prominent overflow-y-auto z-50"
        style={{ borderRight: "0.5px solid rgba(0,0,0,0.06)" }}
      >
        {/* Logo */}
        <div className="p-6 border-b" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
          <Link href="/" className="flex items-center gap-3">
            <div className="agent-avatar" style={{ width: 40, height: 40 }}>
              <span className="text-xl">🤫</span>
            </div>
            <div>
              <span className="font-semibold text-primary">Hushh</span>
              <p className="text-xs text-secondary">Documentation</p>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="p-4">
          {docsSections.map((section) => (
            <div key={section.title} className="mb-6">
              <h3 className="text-small uppercase tracking-wider mb-3 px-3" style={{ color: "var(--color-accent-gold)" }}>
                {section.title}
              </h3>
              <ul className="space-y-1">
                {section.items.map((item) => (
                  <li key={item.id}>
                    <a
                      href={`#${item.id}`}
                      onClick={() => setActiveSection(item.id)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all ${
                        activeSection === item.id
                          ? "glass-interactive text-primary font-medium"
                          : "text-secondary hover:text-primary hover:bg-white/50"
                      }`}
                    >
                      <item.icon weight="regular" className="w-4 h-4" />
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* CTA */}
        <div className="p-4 border-t" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
          <Link href="/jarvis">
            <Button variant="gradient" effect="glass" showRipple className="w-full">
              Launch Agent →
            </Button>
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 ml-64">
        {/* Header */}
        <header className="nav-glass px-8 py-4 ml-64">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            <div className="flex items-center gap-2 text-caption">
              <span>Documentation</span>
              <span>/</span>
              <span className="text-primary font-medium">
                {docsSections.flatMap(s => s.items).find(i => i.id === activeSection)?.label}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--color-success)" }} />
              <span className="text-small" style={{ color: "var(--color-success)" }}>Online</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="max-w-4xl mx-auto px-8 pt-24 pb-16">
          {/* About Section */}
          <section id="about" className="mb-20">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <div className="flex items-center gap-4 mb-8">
                <div className="agent-avatar" style={{ width: 56, height: 56 }}>
                  <span className="text-3xl">🤫</span>
                </div>
                <div>
                  <h1 className="text-headline">Hushh Agent Platform</h1>
                  <p className="text-caption mt-1">Personal AI with privacy at its core</p>
                </div>
              </div>

              <Card variant="none" effect="glass" className="mb-8">
                <p className="text-body" style={{ color: "var(--color-text-secondary)" }}>
                  Hushh is a personal AI system that remembers everything about you, learns from your context, 
                  and works exclusively for your benefit—with privacy as the foundation.
                </p>
              </Card>

              {/* Feature Cards */}
              <div className="grid md:grid-cols-3 gap-4">
                {[
                  { icon: BrainIcon, title: "Persistent Memory", desc: "Context that compounds over time" },
                  { icon: LockIcon, title: "Consent-First", desc: "You control every data access" },
                  { icon: RocketIcon, title: "Instant Action", desc: "Question to action in seconds" },
                ].map((feature) => (
                  <Card
                    key={feature.title}
                    variant="none"
                    effect="glass"
                    icon={{ icon: feature.icon, gradient: true }}
                  >
                    <CardTitle className="text-sm mt-2">{feature.title}</CardTitle>
                    <CardDescription>{feature.desc}</CardDescription>
                  </Card>
                ))}
              </div>
            </motion.div>
          </section>

          {/* Philosophy Section */}
          <section id="philosophy" className="mb-20">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-title mb-6">The 🤫 Promise</h2>
              
              <Card variant="none" effect="glass" className="mb-6" style={{ borderLeft: "3px solid var(--color-accent-red)" }}>
                <p className="text-lg italic mb-4" style={{ color: "var(--color-text-primary)" }}>
                  &quot;Your data stays quiet until YOU decide to share it.&quot;
                </p>
                <p className="text-body" style={{ color: "var(--color-text-secondary)" }}>
                  The name <strong>Hushh</strong> isn&apos;t just branding—it&apos;s a commitment. 
                  The 🤫 emoji represents our core belief: privacy should be the default, not the exception.
                </p>
              </Card>

              <div className="grid md:grid-cols-2 gap-4">
                {[
                  { icon: ShieldCheckIcon, title: "Data Sovereignty", desc: "Your data belongs to YOU, not us" },
                  { icon: EyeIcon, title: "Full Transparency", desc: "See exactly what data is used" },
                  { icon: ArrowRightIcon, title: "Exit Anytime", desc: "Export or delete everything" },
                  { icon: LockIcon, title: "Zero Exploitation", desc: "We never sell your data" },
                ].map((item) => (
                  <Card key={item.title} variant="none" effect="glass" icon={{ icon: item.icon }}>
                    <CardTitle className="text-sm">{item.title}</CardTitle>
                    <CardDescription>{item.desc}</CardDescription>
                  </Card>
                ))}
              </div>
            </motion.div>
          </section>

          {/* Consent Flow Section */}
          <section id="consent" className="mb-20">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-title mb-2">Consent Flow</h2>
              <p className="text-caption mb-6">How data access permissions work</p>

              <div className="space-y-4">
                {consentSteps.map((item) => (
                  <Card key={item.step} variant="none" effect="glass" className="flex items-center gap-4">
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white flex-shrink-0"
                      style={{ background: "var(--color-accent-red)" }}
                    >
                      {item.step}
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-sm">{item.title}</CardTitle>
                    </div>
                    <span className="text-small px-3 py-1 rounded-full" style={{ background: "rgba(199, 160, 53, 0.15)", color: "var(--color-accent-gold)" }}>
                      {item.time}
                    </span>
                  </Card>
                ))}
              </div>
            </motion.div>
          </section>

          {/* Data Categories Section */}
          <section id="data" className="mb-20">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-title mb-2">Data Categories</h2>
              <p className="text-caption mb-6">Types of personal data your agent can access with consent</p>

              <div className="grid md:grid-cols-2 gap-4">
                {dataCategories.map((cat) => (
                  <div 
                    key={cat.name}
                    className="data-card flex items-center gap-4"
                  >
                    <div 
                      className="data-card-icon"
                      style={{ background: `${cat.color}15` }}
                    >
                      {cat.icon}
                    </div>
                    <div>
                      <h4 className="font-medium text-primary">{cat.name}</h4>
                      <p className="text-small">{cat.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 text-center">
                <Link href="/consent" className="text-caption hover:underline" style={{ color: "var(--color-accent-blue)" }}>
                  Manage your permissions →
                </Link>
              </div>
            </motion.div>
          </section>

          {/* Agent Modes Section */}
          <section id="agents" className="mb-20">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-title mb-2">Agent Modes</h2>
              <p className="text-caption mb-6">Switch between specialized modes for different tasks</p>

              <div className="space-y-3">
                {agentModes.map((mode) => (
                  <Card key={mode.id} variant="none" effect="glass" className="flex items-center gap-4">
                    <div className={`agent-avatar ${mode.id}`} style={{ width: 48, height: 48 }}>
                      {mode.icon}
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-sm">{mode.name}</CardTitle>
                      <CardDescription>{mode.desc}</CardDescription>
                    </div>
                    <code className="text-xs px-3 py-1 rounded-lg" style={{ background: "rgba(220, 20, 60, 0.1)", color: "var(--color-accent-red)" }}>
                      {mode.endpoint}
                    </code>
                  </Card>
                ))}
              </div>
            </motion.div>
          </section>

          {/* Endpoints Section */}
          <section id="endpoints" className="mb-20">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-title mb-2">API Endpoints</h2>
              <p className="text-caption mb-6">Core endpoints for interacting with the agent</p>

              <div className="space-y-3">
                {[
                  { method: "POST", path: "/api/chat", desc: "Send message to agent" },
                  { method: "GET", path: "/api/chat", desc: "Health check" },
                  { method: "POST", path: "/api/consent/request", desc: "Request data consent" },
                  { method: "GET", path: "/api/consent/status", desc: "Check consent status" },
                ].map((ep) => (
                  <Card key={`${ep.method}-${ep.path}`} variant="none" effect="glass" className="flex items-center gap-4">
                    <span 
                      className="text-xs font-mono font-bold px-2 py-1 rounded"
                      style={{ 
                        background: ep.method === "POST" ? "rgba(48, 209, 88, 0.15)" : "rgba(0, 122, 255, 0.15)",
                        color: ep.method === "POST" ? "var(--color-success)" : "var(--color-info)"
                      }}
                    >
                      {ep.method}
                    </span>
                    <code className="font-mono text-sm text-primary">{ep.path}</code>
                    <span className="text-caption flex-1 text-right">{ep.desc}</span>
                  </Card>
                ))}
              </div>
            </motion.div>
          </section>

          {/* Examples Section */}
          <section id="examples" className="mb-20">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-title mb-2">Code Examples</h2>
              <p className="text-caption mb-6">Common request patterns</p>

              <Card variant="none" effect="glass" className="mb-4">
                <p className="text-small mb-2" style={{ color: "var(--color-text-tertiary)" }}># Send a message</p>
                <pre className="text-sm overflow-x-auto" style={{ color: "var(--color-text-primary)" }}>
{`curl -X POST /api/chat \\
  -H "Content-Type: application/json" \\
  -d '{
    "message": "Check my spending",
    "mode": "curator",
    "sessionId": "user-123"
  }'`}
                </pre>
              </Card>

              <Card variant="none" effect="glass">
                <p className="text-small mb-2" style={{ color: "var(--color-text-tertiary)" }}># Response</p>
                <pre className="text-sm overflow-x-auto" style={{ color: "var(--color-text-primary)" }}>
{`{
  "response": "Based on your data...",
  "mode": "curator",
  "dataUsed": ["Financial"],
  "sessionId": "user-123"
}`}
                </pre>
              </Card>
            </motion.div>
          </section>

          {/* CTA */}
          <section className="mb-12">
            <Card variant="none" effect="glass" className="text-center py-12">
              <div className="agent-avatar mx-auto mb-4" style={{ width: 64, height: 64 }}>
                <span className="text-3xl">🤫</span>
              </div>
              <h3 className="text-title mb-2">Ready to Begin?</h3>
              <p className="text-caption mb-6">Your privacy-first AI agent is waiting</p>
              <Link href="/jarvis">
                <Button variant="gradient" effect="glass" showRipple size="lg">
                  <ChatCircleIcon className="mr-2 h-5 w-5" weight="regular" />
                  Launch Agent
                </Button>
              </Link>
            </Card>
          </section>
        </div>

        {/* Footer */}
        <footer className="border-t px-8 py-6" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
          <div className="max-w-4xl mx-auto flex items-center justify-between text-small">
            <span>🤫 Hushh Agent Platform</span>
            <span>Powered by Google ADK</span>
          </div>
        </footer>
      </div>
    </main>
  );
}
