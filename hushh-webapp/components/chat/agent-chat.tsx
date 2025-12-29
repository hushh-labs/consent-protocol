"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/lib/morphy-ux/morphy";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, User, Loader2, Sparkles, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMessage } from "@/lib/format-message";
import { CollectedDataCard } from "./collected-data-card";
import { CheckboxSelector } from "./checkbox-selector";
import { encryptData } from "@/lib/vault/encrypt";
import { useVault } from "@/lib/vault/vault-context";
import { ApiService } from "@/lib/services/api-service";

/**
 * Save collected data to encrypted vault
 * CONSENT PROTOCOL: Requires valid consent token from agent
 * SECURITY: vaultKey must be passed from component (memory-only)
 */
async function saveToVault(
  collectedData: Record<string, unknown>,
  consentToken: string,
  vaultKey: string | null // Now passed as parameter from vault context
): Promise<boolean> {
  try {
    const userId =
      localStorage.getItem("user_id") || sessionStorage.getItem("user_id");

    if (!userId || !vaultKey) {
      console.error("Session expired. Missing user_id or vault_key");
      return false;
    }

    if (!consentToken) {
      console.error("❌ CONSENT PROTOCOL VIOLATION: No consent token provided");
      return false;
    }

    if (process.env.NODE_ENV === "development") {
      console.log(
        "🔐 Consent token received:",
        consentToken.substring(0, 30) + "..."
      );
      console.log("🔒 Encrypting preferences for vault...", collectedData);
    }

    // Detect which domain based on collected data keys
    const isFood =
      collectedData.dietary_restrictions ||
      collectedData.cuisine_preferences ||
      collectedData.monthly_budget;
    const isProfessional =
      collectedData.professional_title ||
      collectedData.skills ||
      collectedData.experience_level;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const preferences: Record<string, any> = {};

    if (isFood) {
      // Encrypt food fields
      const dietary = collectedData.dietary_restrictions || [];
      const cuisines = collectedData.cuisine_preferences || [];
      const budget = collectedData.monthly_budget || 0;

      preferences.dietary_restrictions = await encryptData(
        JSON.stringify(dietary),
        vaultKey
      );
      preferences.cuisine_preferences = await encryptData(
        JSON.stringify(cuisines),
        vaultKey
      );
      preferences.monthly_food_budget = await encryptData(
        JSON.stringify(budget),
        vaultKey
      );
    }

    if (isProfessional) {
      // Encrypt professional profile fields
      const title = collectedData.professional_title || "";
      const skills = collectedData.skills || [];
      const experience = collectedData.experience_level || "";
      const jobPrefs = collectedData.job_preferences || [];

      preferences.professional_title = await encryptData(
        JSON.stringify(title),
        vaultKey
      );
      preferences.skills = await encryptData(JSON.stringify(skills), vaultKey);
      preferences.experience_level = await encryptData(
        JSON.stringify(experience),
        vaultKey
      );
      preferences.job_preferences = await encryptData(
        JSON.stringify(jobPrefs),
        vaultKey
      );
    }

    if (process.env.NODE_ENV === "development") {
      console.log("📦 Saving fields:", Object.keys(preferences));
    }

    // Store encrypted data WITH consent token
    const response = await ApiService.storePreferences({
      userId,
      preferences,
      consentToken,
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("❌ Vault write failed:", error);
      throw new Error(error.error || "Failed to save to vault");
    }

    if (process.env.NODE_ENV === "development") {
      console.log("✅ Preferences saved to encrypted vault (consent verified)");
    }
    return true;
  } catch (error) {
    console.error("Vault save error:", error);
    return false;
  }
}

export interface PendingUI {
  ui_type: "checkbox" | "buttons" | null;
  options: string[];
  allow_custom?: boolean;
  allow_none?: boolean;
}

interface Message {
  role: "user" | "agent";
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  type?: "text" | "system_event"; // New type for visual distinction
}

interface AgentChatProps {
  agentId: string;
  agentName: string;
  initialMessage?: string;
  className?: string;
  onCollectedDataChange?: (data: Record<string, unknown>) => void;
  initialUI?: PendingUI;
  hideHeader?: boolean;
}

export function AgentChat({
  agentId,
  agentName,
  initialMessage = "Hello! I'm ready to help you build your profile.",
  className,
  onCollectedDataChange,
  initialUI,
  hideHeader = false,
}: AgentChatProps) {
  const { getVaultKey } = useVault();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "agent",
      content: initialMessage,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Track active domain agent and session state for multi-turn conversations
  const [activeAgent, setActiveAgent] = useState<string>(agentId);
  const [sessionState, setSessionState] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [collectedData, setCollectedData] = useState<Record<string, unknown>>(
    {}
  );
  const [pendingUI, setPendingUI] = useState<PendingUI | null>(
    initialUI || null
  );

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input;
    setInput("");

    // Add User Message
    const newMessages: Message[] = [
      ...messages,
      { role: "user", content: userMessage, timestamp: new Date() },
    ];
    setMessages(newMessages);
    setIsLoading(true);

    // Get current user ID to ensure consent token matches vault user
    const userId =
      localStorage.getItem("user_id") || sessionStorage.getItem("user_id");

    // Real API Call
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          userId, // Send user ID so token is issued for correct user
          agentId: activeAgent,
          sessionState: sessionState,
        }),
      });

      const data = await response.json();

      // Update session state if returned
      if (data.sessionState) {
        setSessionState(data.sessionState);
        // Update collected data from session
        if (data.sessionState.collected) {
          const newCollectedData = data.sessionState.collected as Record<
            string,
            unknown
          >;
          setCollectedData(newCollectedData);
          // Notify parent component
          if (onCollectedDataChange) {
            onCollectedDataChange(newCollectedData);
          }
        }
      }

      // Track which agent is now active
      if (data.agentId) {
        setActiveAgent(data.agentId);
      }

      // Handle System Events (Delegation) if present
      if (data.delegation && data.agentId !== activeAgent) {
        setMessages((prev) => [
          ...prev,
          {
            role: "agent",
            content: `🔄 Connecting to ${
              data.delegation.domain || data.delegation.target_agent
            }...`,
            timestamp: new Date(),
            type: "system_event",
          },
        ]);
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "agent",
          content: data.content,
          timestamp: new Date(),
          isStreaming: false,
        },
      ]);

      // If flow is complete, save collected data to vault WITH consent token
      if (data.isComplete && data.sessionState?.collected) {
        if (!data.consent_token) {
          console.error(
            "❌ CONSENT PROTOCOL VIOLATION: Flow complete but no consent token received!"
          );
          setMessages((prev) => [
            ...prev,
            {
              role: "agent",
              content: "⚠️ Save failed: No consent token received from agent.",
              timestamp: new Date(),
              type: "system_event",
            },
          ]);
        } else {
          console.log(
            "🎉 Flow complete - saving to vault with consent token..."
          );
          const saved = await saveToVault(
            data.sessionState.collected,
            data.consent_token,
            getVaultKey()
          );
          if (saved) {
            setMessages((prev) => [
              ...prev,
              {
                role: "agent",
                content:
                  "✅ Your preferences have been securely saved to your encrypted vault (consent verified).",
                timestamp: new Date(),
                type: "system_event",
              },
            ]);
          } else {
            setMessages((prev) => [
              ...prev,
              {
                role: "agent",
                content: "⚠️ Failed to save preferences. Please try again.",
                timestamp: new Date(),
                type: "system_event",
              },
            ]);
          }
        }
      }

      // Check for UI type hints from agent
      if (data.ui_type && data.options) {
        setPendingUI({
          ui_type: data.ui_type,
          options: data.options,
          allow_custom: data.allow_custom,
          allow_none: data.allow_none,
        });
      } else {
        setPendingUI(null);
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "agent",
          content:
            "Error: Failed to reach the agent. Please ensure the Python services are running.",
          timestamp: new Date(),
          isStreaming: false,
        },
      ]);
    }

    setIsLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Handle selection from checkbox or button UI
  const handleSelection = async (selected: string[]) => {
    const userMessage = selected.join(", ");
    setPendingUI(null);

    // Add user message to chat
    setMessages((prev) => [
      ...prev,
      { role: "user", content: userMessage, timestamp: new Date() },
    ]);
    setIsLoading(true);

    // Get current user ID for proper consent token issuance
    const userId =
      localStorage.getItem("user_id") || sessionStorage.getItem("user_id");

    // Send to agent
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          userId, // CRITICAL: Include userId for consent token matching
          agentId: activeAgent,
          sessionState: sessionState,
        }),
      });

      const data = await response.json();

      if (data.sessionState) {
        setSessionState(data.sessionState);
        if (data.sessionState.collected) {
          const newCollectedData = data.sessionState.collected as Record<
            string,
            unknown
          >;
          setCollectedData(newCollectedData);
          if (onCollectedDataChange) {
            onCollectedDataChange(newCollectedData);
          }
        }
      }

      if (data.agentId) {
        setActiveAgent(data.agentId);
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "agent",
          content: data.content,
          timestamp: new Date(),
          isStreaming: false,
        },
      ]);

      // If flow is complete, save collected data to vault WITH consent token
      if (data.isComplete && data.sessionState?.collected) {
        if (!data.consent_token) {
          console.error(
            "❌ CONSENT PROTOCOL VIOLATION: Flow complete but no consent token received!"
          );
          setMessages((prev) => [
            ...prev,
            {
              role: "agent",
              content: "⚠️ Save failed: No consent token received from agent.",
              timestamp: new Date(),
              type: "system_event",
            },
          ]);
        } else {
          console.log(
            "🎉 Flow complete (selection) - saving with consent token..."
          );
          const saved = await saveToVault(
            data.sessionState.collected,
            data.consent_token,
            getVaultKey()
          );
          if (saved) {
            setMessages((prev) => [
              ...prev,
              {
                role: "agent",
                content:
                  "✅ Your preferences have been securely saved to your encrypted vault (consent verified).",
                timestamp: new Date(),
                type: "system_event",
              },
            ]);
          } else {
            setMessages((prev) => [
              ...prev,
              {
                role: "agent",
                content: "⚠️ Failed to save preferences. Please try again.",
                timestamp: new Date(),
                type: "system_event",
              },
            ]);
          }
        }
      }

      if (data.ui_type && data.options) {
        setPendingUI({
          ui_type: data.ui_type,
          options: data.options,
          allow_custom: data.allow_custom,
          allow_none: data.allow_none,
        });
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "agent",
          content: "Error: Failed to reach the agent.",
          timestamp: new Date(),
          isStreaming: false,
        },
      ]);
    }
    setIsLoading(false);
  };

  return (
    <div className="flex gap-4 max-w-6xl mx-auto">
      {/* Main Chat */}
      <Card
        className={cn(
          "flex flex-col h-[600px] flex-1 overflow-hidden border-0 shadow-2xl bg-white/60 dark:bg-black/60 backdrop-blur-[6px]",
          className
        )}
        variant="none"
        effect="glass"
      >
        {/* Header */}
        {!hideHeader && (
          <div className="flex items-center justify-between p-4 border-b border-gray-200/50 dark:border-gray-800/50 bg-white/30 dark:bg-black/30">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                <Bot className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">{agentName}</h3>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  Active • {activeAgent}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-primary"
              >
                <ShieldCheck className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6" ref={scrollRef}>
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={cn(
                "flex gap-3 max-w-[85%]",
                msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
              )}
            >
              {/* Avatar */}
              <div
                className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center shrink-0 mt-1",
                  msg.role === "user"
                    ? "bg-gray-200 dark:bg-gray-800"
                    : "bg-linear-to-br from-blue-500/20 to-purple-600/20 border border-blue-200 dark:border-blue-900"
                )}
              >
                {msg.role === "user" ? (
                  <User className="h-4 w-4" />
                ) : (
                  <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                )}
              </div>

              {/* Bubble */}
              <div
                className={cn(
                  "p-4 rounded-2xl text-sm leading-relaxed shadow-sm",
                  msg.role === "user"
                    ? "bg-blue-600 text-white rounded-tr-none"
                    : msg.type === "system_event"
                    ? "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-xs italic"
                    : "bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-tl-none"
                )}
              >
                {msg.role === "user" ? msg.content : formatMessage(msg.content)}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3 max-w-[85%] mr-auto">
              <div className="h-8 w-8 rounded-full bg-linear-to-br from-blue-500/20 to-purple-600/20 border border-blue-200 dark:border-blue-900 flex items-center justify-center shrink-0 mt-1">
                <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="p-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  Thinking...
                </span>
              </div>
            </div>
          )}

          {/* Interactive UI - Checkbox or Buttons */}
          {/* Interactive UI - Checkbox or Buttons */}
          {pendingUI && !isLoading && (
            <div className="ml-11 max-w-[85%]">
              {pendingUI.ui_type === "checkbox" && (
                <CheckboxSelector
                  options={pendingUI.options}
                  onSubmit={handleSelection}
                  allowCustom={pendingUI.allow_custom}
                  submitLabel="Continue"
                />
              )}
              {pendingUI.ui_type === "buttons" && (
                <div className="flex flex-wrap gap-2">
                  {pendingUI.options.map((option) => {
                    // Determine button action based on context
                    const isSaveAction = option.toLowerCase().includes("save");
                    const isEditAction = option.toLowerCase().includes("edit");
                    const actionValue = isSaveAction
                      ? "save"
                      : isEditAction
                      ? "edit"
                      : option;

                    return (
                      <Button
                        key={option}
                        onClick={() => handleSelection([actionValue])}
                        variant={isSaveAction ? "default" : "outline"}
                        size="sm"
                        className={cn(
                          "h-8 text-xs",
                          isSaveAction && "bg-emerald-600 hover:bg-emerald-700",
                          option.includes("Food") &&
                            "border-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20",
                          option.includes("Professional") &&
                            "border-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                        )}
                      >
                        {option}
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input Area - solid bg instead of blur for performance */}
        <div className="p-4 bg-white/90 dark:bg-black/90 border-t border-gray-200/50 dark:border-gray-800/50">
          <div className="relative flex items-center">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="pr-12 h-12 rounded-full border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-black/50 shadow-inner focus-visible:ring-blue-500"
              disabled={isLoading}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              size="icon"
              className={cn(
                "absolute right-1.5 h-9 w-9 rounded-full transition-all",
                input.trim()
                  ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md scale-100"
                  : "bg-gray-200 dark:bg-gray-800 text-gray-400 scale-90 pointer-events-none"
              )}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-2 flex justify-center">
            <p className="text-[10px] text-muted-foreground text-center flex items-center gap-1.5">
              <ShieldCheck className="h-3 w-3" />
              Private & Secure via Hushh Consent Protocol
            </p>
          </div>
        </div>
      </Card>

      {/* Collected Data Sidebar - only show when parent doesn't handle it */}
      {!onCollectedDataChange && Object.keys(collectedData).length > 0 && (
        <div className="w-72 shrink-0">
          <CollectedDataCard
            data={collectedData}
            domain={
              activeAgent === "agent_food_dining"
                ? "Food & Dining"
                : "Preferences"
            }
          />
        </div>
      )}
    </div>
  );
}
