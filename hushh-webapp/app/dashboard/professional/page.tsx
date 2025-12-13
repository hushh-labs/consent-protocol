import { AgentChat } from "@/components/chat/agent-chat";
import { User, Shield, UserCheck } from "lucide-react";

export default function SelfProfilePage() {
  return (
    <div className="container mx-auto max-w-5xl py-8 space-y-8">
      {/* Header Section */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight bg-linear-to-r from-blue-600 to-emerald-500 bg-clip-text text-transparent">
          Professional Profile Orchestrator
        </h1>
        <p className="text-muted-foreground flex items-center gap-2">
          <Shield className="h-4 w-4 text-emerald-500" />
          Securely build your digital twin. Data stays within your vault.
        </p>
      </div>

      {/* Chat Interface */}
      <div className="flex gap-6">
        {/* Main Chat */}
        <div className="flex-1">
          <AgentChat 
            agentId="agent_orchestrator" 
            agentName="Hushh Orchestrator"
          />
        </div>

        {/* Info Sidebar (Optional, hidden on mobile) */}
        <div className="hidden lg:block w-72 space-y-4">
          <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-black/50 backdrop-blur-sm">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <User className="h-4 w-4" />
              Collected Data
            </h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex justify-between">
                <span>Dietary</span>
                <span className="text-emerald-500">Known</span>
              </div>
              <div className="flex justify-between">
                <span>Career</span>
                <span className="text-amber-500">Incomplete</span>
              </div>
              <div className="flex justify-between">
                <span>Travel</span>
                <span className="text-gray-400">Unknown</span>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200/50 dark:border-gray-800/50">
               <p className="text-xs leading-relaxed">
                 This agent will ask you questions to fill these gaps. It may also request to contact other agents (like the Kushal Agent) to auto-fill data.
               </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
