// app/food-setup/page.tsx

/**
 * Food Preferences Setup Page
 *
 * Demo page showcasing the Food Agent chat interface
 * for collecting dining preferences.
 * 
 * TODO: Re-enable FoodAgentChat component when implemented
 */

"use client";

// import { FoodAgentChat } from "@/components/chat/food-agent-chat";
import { Card } from "@/lib/morphy-ux/morphy";
import {
  UtensilsCrossed,
  ShieldCheck,
  Sparkles,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";

export default function FoodSetupPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Dashboard</span>
          </Link>
        </div>

        {/* Hero Card */}
        <Card className="p-8 mb-6 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-orange-100 rounded-full">
              <UtensilsCrossed className="w-8 h-8 text-orange-600" />
            </div>
          </div>
          <h1 className="text-3xl font-bold mb-2">Food Preferences</h1>
          <p className="text-gray-600">
            Tell us about your dining preferences, and we'll help you discover great
            restaurant options.
          </p>
        </Card>

        {/* TODO: Re-enable when FoodAgentChat is implemented */}
        <Card className="p-6">
          <p className="text-center text-gray-500">
            Food Agent Chat component is currently being refactored.
            <br />
            Check back soon!
          </p>
        </Card>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 gap-4 mt-6">
          <Card className="p-6">
            <ShieldCheck className="w-6 h-6 text-green-600 mb-3" />
            <h3 className="font-semibold mb-2">Privacy First</h3>
            <p className="text-sm text-gray-600">
              Your preferences are encrypted and stored securely on your device.
            </p>
          </Card>
          <Card className="p-6">
            <Sparkles className="w-6 h-6 text-purple-600 mb-3" />
            <h3 className="font-semibold mb-2">AI-Powered</h3>
            <p className="text-sm text-gray-600">
              Get personalized recommendations based on your unique tastes.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
