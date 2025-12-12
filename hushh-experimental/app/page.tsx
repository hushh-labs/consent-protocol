"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-xl w-full text-center space-y-8">
        <div>
          <span className="text-6xl mb-4 block">🤫</span>
          <h1 className="text-headline mb-4">
            Hushh Protocol
          </h1>
          <p className="text-body text-secondary">
            Infrastructure for Consent-First Personal Data Agents
          </p>
        </div>

        <Card variant="none" effect="glass" className="p-8 text-left space-y-4">
          <div className="flex items-center gap-3">
             <div className="w-2 h-2 rounded-full bg-green-500" />
             <span className="text-sm font-medium">System Active</span>
          </div>
          <p className="text-sm text-secondary">
            Ready for Operon integration. Connect your local Python agent to start.
          </p>
          
          <div className="pt-4 flex gap-4">
            <Link href="/docs" className="flex-1">
              <Button variant="none" effect="glass" className="w-full">
                Documentation
              </Button>
            </Link>
            <Button variant="gradient" effect="glass" showRipple className="flex-1" disabled>
              Launch Agent (Pending)
            </Button>
          </div>
        </Card>
      </div>
    </main>
  );
}
