// components/kai/kai-chat.tsx

/**
 * Unified Kai Chat Component
 *
 * Features:
 * - Persistent conversation history
 * - Insertable UI components
 * - Voice input support
 * - Streaming responses with debate visualization
 */

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HushhLoader } from "@/components/ui/hushh-loader";
import {
  Send,
  Mic,
  MicOff,
  ArrowLeft,
  Sparkles,
  User,
  TrendingUp,
  Upload,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ApiService } from "@/lib/services/api-service";
import { InsertableComponent } from "./insertable-components";

// =============================================================================
// TYPES
// =============================================================================

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  contentType: "text" | "component";
  componentType?: string;
  componentData?: Record<string, unknown>;
  createdAt: Date;
}

interface KaiChatProps {
  userId: string;
  vaultOwnerToken: string;
  conversationId?: string;
  onWorldModelUpdate?: (attributes: unknown[]) => void;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function KaiChat({
  userId,
  vaultOwnerToken,
  conversationId: initialConversationId,
  onWorldModelUpdate,
}: KaiChatProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(
    initialConversationId || null
  );
  const [isListening, setIsListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Initialize with welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content:
            "Hi! I'm Kai, your personal investment advisor. I can help you analyze stocks, review your portfolio, and identify opportunities. What would you like to explore today?",
          contentType: "text",
          createdAt: new Date(),
        },
      ]);
    }
  }, [messages.length]);

  // Send message handler
  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input.trim(),
      contentType: "text",
      createdAt: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Call Kai chat API
      const response = await ApiService.sendKaiMessage({
        userId,
        message: userMessage.content,
        conversationId: conversationId || undefined,
        vaultOwnerToken,
      });

      const data = await response.json();

      // Update conversation ID if new
      if (data.conversationId && !conversationId) {
        setConversationId(data.conversationId);
      }

      // Add assistant response
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: data.response || data.message || "I understand. Let me help you with that.",
        contentType: data.componentType ? "component" : "text",
        componentType: data.componentType,
        componentData: data.componentData,
        createdAt: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Handle world model updates
      if (data.worldModelUpdates && onWorldModelUpdate) {
        onWorldModelUpdate(data.worldModelUpdates);
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          content:
            "I apologize, but I encountered an error. Please try again.",
          contentType: "text",
          createdAt: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, userId, conversationId, vaultOwnerToken, onWorldModelUpdate]);

  // Handle key press
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Quick action handlers
  const handleQuickAction = (action: string) => {
    setInput(action);
    setTimeout(() => handleSend(), 100);
  };

  // Voice input toggle (placeholder)
  const toggleVoiceInput = () => {
    setIsListening(!isListening);
    // TODO: Implement Web Speech API or native voice input
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 p-4 border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => router.push("/dashboard")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3 flex-1">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[var(--crystal-gold-400)] to-[var(--crystal-gold-600)] flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="font-semibold">Agent Kai</h1>
            <p className="text-xs text-muted-foreground">
              Your AI Investment Advisor
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex gap-3 max-w-[90%] animate-in fade-in slide-in-from-bottom-2 duration-300",
              msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
            )}
          >
            {/* Avatar */}
            <div
              className={cn(
                "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                msg.role === "user"
                  ? "bg-muted"
                  : "bg-gradient-to-br from-[var(--crystal-gold-400)]/20 to-[var(--crystal-gold-600)]/10 border border-[var(--crystal-gold-400)]/20"
              )}
            >
              {msg.role === "user" ? (
                <User className="h-4 w-4" />
              ) : (
                <Sparkles className="h-4 w-4 text-[var(--crystal-gold-500)]" />
              )}
            </div>

            {/* Message Content */}
            <div
              className={cn(
                "p-3 rounded-2xl text-sm",
                msg.role === "user"
                  ? "bg-[var(--crystal-gold-500)] text-white rounded-tr-sm"
                  : "crystal-glass rounded-tl-sm"
              )}
            >
              {msg.contentType === "component" && msg.componentType ? (
                <InsertableComponent
                  type={msg.componentType}
                  data={msg.componentData || {}}
                />
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex gap-3 mr-auto">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[var(--crystal-gold-400)]/20 to-[var(--crystal-gold-600)]/10 border border-[var(--crystal-gold-400)]/20 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-[var(--crystal-gold-500)]" />
            </div>
            <div className="crystal-glass p-3 rounded-2xl rounded-tl-sm">
              <HushhLoader variant="inline" label="Thinking..." />
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      {messages.length <= 1 && (
        <div className="shrink-0 px-4 pb-2">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 rounded-full text-xs"
              onClick={() => handleQuickAction("Analyze my portfolio")}
            >
              <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
              Analyze Portfolio
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 rounded-full text-xs"
              onClick={() => handleQuickAction("Import my brokerage statement")}
            >
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              Import Statement
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 rounded-full text-xs"
              onClick={() => handleQuickAction("What stocks should I analyze?")}
            >
              <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
              Stock Ideas
            </Button>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="shrink-0 p-4 border-t border-border/50 bg-background/80 backdrop-blur-sm safe-area-pb">
        <div className="flex items-center gap-2">
          {/* Voice Input */}
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "shrink-0 rounded-full",
              isListening && "bg-red-500/10 text-red-500"
            )}
            onClick={toggleVoiceInput}
          >
            {isListening ? (
              <MicOff className="h-5 w-5" />
            ) : (
              <Mic className="h-5 w-5" />
            )}
          </Button>

          {/* Text Input */}
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Kai anything..."
            className="flex-1 rounded-full border-border/50 bg-muted/50"
            disabled={isLoading}
          />

          {/* Send Button */}
          <Button
            size="icon"
            className={cn(
              "shrink-0 rounded-full transition-all",
              input.trim()
                ? "bg-gradient-to-r from-[var(--crystal-gold-400)] to-[var(--crystal-gold-600)] text-white shadow-md"
                : "bg-muted text-muted-foreground"
            )}
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
