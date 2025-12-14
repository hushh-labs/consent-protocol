"use client";

/**
 * Home Page - Hushh PDA
 * Compact landing page with quick access
 */

import Link from "next/link";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/lib/morphy-ux/morphy";
import { Shield, Lock, Key, Sparkles, ArrowRight } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="w-full max-w-2xl space-y-6">
        {/* Hero Section */}
        <div className="text-center space-y-4">
          <div className="flex justify-center mb-2">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 dark:from-gray-400 dark:to-gray-600 flex items-center justify-center text-3xl shadow-lg">
              🤫
            </div>
          </div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-gray-300 dark:to-gray-500 bg-clip-text text-transparent">
            Hushh
          </h1>
          <p className="text-xl text-muted-foreground max-w-md mx-auto">
            Privacy-First Personal Data Assistant
          </p>
        </div>

        {/* CTA Card */}
        <Card className="glass border-2">
          <CardContent className="pt-6 space-y-4">
            <div className="flex justify-center gap-4">
              <Link href="/login">
                <Button variant="gradient" effect="glass" size="lg" showRipple>
                  Get Started
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/docs">
                <Button
                  variant="none"
                  effect="glass"
                  size="lg"
                  showRipple={false}
                  className="border"
                >
                  Learn More
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="glass text-center">
            <CardHeader>
              <div className="flex justify-center mb-2">
                <Shield className="h-8 w-8 text-green-500" />
              </div>
              <CardTitle className="text-lg">E2EE</CardTitle>
              <CardDescription className="text-sm">
                End-to-end encrypted vault
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="glass text-center">
            <CardHeader>
              <div className="flex justify-center mb-2">
                <Lock className="h-8 w-8 text-blue-500" />
              </div>
              <CardTitle className="text-lg">Your Control</CardTitle>
              <CardDescription className="text-sm">
                Own your personal data
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="glass text-center">
            <CardHeader>
              <div className="flex justify-center mb-2">
                <Key className="h-8 w-8 text-purple-500" />
              </div>
              <CardTitle className="text-lg">Zero-Knowledge</CardTitle>
              <CardDescription className="text-sm">
                We can't read your data
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    </main>
  );
}
