"use client";

/**
 * Agent Nav - Universal Agent Search
 * ===================================
 *
 * Unified interface to search and interact with all agents:
 * - Food & Dining
 * - Professional Profile
 * - Kai Investment Analyst
 *
 * Only accessible when vault is unlocked.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
} from "@/lib/morphy-ux/morphy";
import {
  Search,
  Sparkles,
  Utensils,
  Briefcase,
  TrendingUp,
  ArrowRight,
} from "lucide-react";

type AgentType = "food" | "professional" | "kai";

interface Agent {
  id: AgentType;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  route: string;
  color: string;
}

const agents: Agent[] = [
  {
    id: "food",
    name: "Food & Dining",
    description: "Personalized restaurant recommendations and meal planning",
    icon: Utensils,
    route: "/dashboard/food",
    color: "from-orange-400 to-red-500",
  },
  {
    id: "professional",
    name: "Professional Profile",
    description: "Career guidance and job matching",
    icon: Briefcase,
    route: "/dashboard/professional",
    color: "from-blue-400 to-indigo-500",
  },
  {
    id: "kai",
    name: "Kai Investment Analyst",
    description: "Educational stock analysis and investment insights",
    icon: TrendingUp,
    route: "/dashboard/kai",
    color: "from-purple-400 to-pink-500",
  },
];

export default function AgentNavPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredAgents = agents.filter(
    (agent) =>
      agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-dvh morphy-app-bg p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-3 pt-8">
          <div className="flex items-center justify-center gap-3">
            <Search className="h-10 w-10 text-purple-400" />
            <h1 className="text-4xl font-bold gradient-text">Agent Nav</h1>
          </div>
          <p className="text-body text-muted-foreground max-w-2xl mx-auto">
            Your universal gateway to all Hushh agents. Search, explore, and
            interact with AI assistants designed for your privacy.
          </p>
        </div>

        {/* Search Bar */}
        <Card variant="none" effect="glass">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search agents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-transparent border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-purple-500/50 transition-colors"
              />
            </div>
          </CardContent>
        </Card>

        {/* Agent Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAgents.map((agent) => {
            const Icon = agent.icon;

            return (
              <Card
                key={agent.id}
                variant="none"
                effect="glass"
                showRipple
                className="cursor-pointer group hover:border-purple-500/50 transition-all"
                onClick={() => router.push(agent.route)}
              >
                <CardHeader>
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-r ${agent.color} opacity-80 flex items-center justify-center mb-4 group-hover:opacity-100 transition-opacity`}
                  >
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-title">{agent.name}</CardTitle>
                  <CardDescription className="text-caption">
                    {agent.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-small text-purple-400 group-hover:gap-3 transition-all">
                    <span>Open Agent</span>
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* No Results */}
        {filteredAgents.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No agents match your search</p>
          </div>
        )}

        {/* Info Card */}
        <Card variant="none" effect="glass" className="mt-12">
          <CardHeader>
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                <Sparkles className="h-5 w-5 text-purple-400" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-title mb-2">
                  About Agent Nav
                </CardTitle>
                <CardDescription className="text-caption">
                  Agent Nav is built on <strong>AgentNav base class</strong> - a
                  universal foundation ensuring all Hushh agents follow the same
                  consent protocol, security standards, and user experience
                  patterns.
                </CardDescription>
                <div className="mt-4 space-y-2 text-small">
                  <div className="flex items-start gap-2">
                    <span className="text-green-400">✓</span>
                    <span className="text-muted-foreground">
                      Consent-first: All agents validate tokens before actions
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-green-400">✓</span>
                    <span className="text-muted-foreground">
                      Encrypted vault: Your data is end-to-end encrypted
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-green-400">✓</span>
                    <span className="text-muted-foreground">
                      Zero trust: No agent has default access to your data
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
