// components/kai/kai-chat.tsx

/**
 * Unified Kai Chat Component
 *
 * Features:
 * - Persistent conversation history
 * - Insertable UI components
 * - Voice input support
 * - Streaming responses with debate visualization
 * - Portfolio import with skip option
 */

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/lib/morphy-ux/morphy";
import { Input } from "@/components/ui/input";
import { HushhLoader } from "@/components/ui/hushh-loader";
import {
  Send,
  Mic,
  MicOff,
  ArrowLeft,
  User,
  TrendingUp,
  Upload,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ApiService } from "@/lib/services/api-service";
import { getInitialChatState as fetchInitialChatState } from "@/lib/services/kai-service";
import { InsertableComponent } from "./insertable-components";
import { HushhLogoIcon, HushhLogoAvatar } from "@/components/ui/hushh-logo-icon";

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

interface InitialChatState {
  isNewUser: boolean;
  hasPortfolio: boolean;
  hasFinancialData: boolean;
  welcomeType: "new" | "returning_no_portfolio" | "returning" | string;
  totalAttributes: number;
  availableDomains: string[];
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

  // Proactive welcome - fetch initial state and show appropriate message
  useEffect(() => {
    const fetchInitialStateAndWelcome = async () => {
      if (messages.length > 0) return; // Already have messages
      
      try {
        // Fetch initial chat state from backend via service layer (tri-flow compliant)
        const state = await fetchInitialChatState(userId) as InitialChatState;
        
        // Determine welcome message based on user state
        let welcomeMessage: ChatMessage;
        
        if (state.isNewUser || state.welcomeType === "new") {
          // New user - proactive portfolio import prompt
          welcomeMessage = {
            id: "welcome-new",
            role: "assistant",
            content:
              "Hi! I'm Kai, your personal investment advisor. " +
              "To give you personalized insights, let's start by importing your brokerage statement. " +
              "This will help me understand your portfolio and identify opportunities.",
            contentType: "component",
            componentType: "portfolio_import",
            componentData: { 
              prompt: "Import your portfolio to begin", 
              show_skip: true,
              is_onboarding: true
            },
            createdAt: new Date(),
          };
        } else if (!state.hasPortfolio || state.welcomeType === "returning_no_portfolio") {
          // Returning user without portfolio
          welcomeMessage = {
            id: "welcome-no-portfolio",
            role: "assistant",
            content:
              "Welcome back! I noticed you haven't imported your portfolio yet. " +
              "Would you like to do that now for personalized investment advice?",
            contentType: "component",
            componentType: "portfolio_import",
            componentData: { 
              prompt: "Import portfolio", 
              show_skip: true 
            },
            createdAt: new Date(),
          };
        } else {
          // Returning user with portfolio - personalized welcome
          const domainCount = state.availableDomains.length;
          welcomeMessage = {
            id: "welcome-returning",
            role: "assistant",
            content:
              `Welcome back! I have your portfolio and ${state.totalAttributes} data points across ${domainCount} categories. ` +
              "What would you like to explore today? I can analyze stocks, review your holdings, or help identify opportunities.",
            contentType: "text",
            createdAt: new Date(),
          };
        }
        
        setMessages([welcomeMessage]);
        
      } catch (error) {
        console.error("Error fetching initial chat state:", error);
        // Fallback to generic welcome
        setMessages([
          {
            id: "welcome-fallback",
            role: "assistant",
            content:
              "Hi! I'm Kai, your personal investment advisor. I can help you analyze stocks, review your portfolio, and identify opportunities. What would you like to explore today?",
            contentType: "text",
            createdAt: new Date(),
          },
        ]);
      }
    };
    
    fetchInitialStateAndWelcome();
  }, [userId, messages.length]);

  // Handle component actions (portfolio upload, skip, analyze loser, etc.)
  const handleComponentAction = useCallback(async (action: string, payload: unknown) => {
    const data = payload as Record<string, unknown>;
    
    if (action === "upload_portfolio" && data.file instanceof File) {
      setIsLoading(true);
      
      try {
        const response = await ApiService.importPortfolio({
          userId,
          file: data.file,
          vaultOwnerToken,
        });
        
        const result = await response.json();
        
        if (result.success) {
          // Add success message with loser report
          const newMessages: ChatMessage[] = [
            {
              id: `assistant-${Date.now()}`,
              role: "assistant",
              content: `Great! I've analyzed your portfolio with ${result.holdings_count} holdings. Here's what I found:`,
              contentType: "component",
              componentType: "loser_report",
              componentData: { losers: result.losers, interactive: true },
              createdAt: new Date(),
            },
          ];
          
          // If there are losers, add analysis prompt
          if (result.losers && result.losers.length > 0) {
            newMessages.push({
              id: `assistant-prompt-${Date.now()}`,
              role: "assistant",
              content: "Would you like me to analyze any of these positions?",
              contentType: "component",
              componentType: "loser_analysis_prompt",
              componentData: { losers: result.losers },
              createdAt: new Date(),
            });
          }
          
          setMessages((prev) => [...prev, ...newMessages]);
          
          // Notify parent of world model update
          if (onWorldModelUpdate && result.kpis_stored) {
            onWorldModelUpdate(result.kpis_stored);
          }
        } else {
          // Show error
          setMessages((prev) => [
            ...prev,
            {
              id: `error-${Date.now()}`,
              role: "assistant",
              content: result.error || "I had trouble processing that file. Please try a different format.",
              contentType: "text",
              createdAt: new Date(),
            },
          ]);
        }
      } catch (error) {
        console.error("Portfolio import error:", error);
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: "assistant",
            content: "I encountered an error importing your portfolio. Please try again.",
            contentType: "text",
            createdAt: new Date(),
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    } else if (action === "skip_portfolio") {
      // User skipped portfolio import
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: "No problem! You can import your portfolio anytime. In the meantime, I can help you analyze specific stocks, discuss investment strategies, or answer questions about the market. What interests you?",
          contentType: "text",
          createdAt: new Date(),
        },
      ]);
    } else if (action === "analyze_loser" && data.symbol) {
      // Analyze a specific loser
      setIsLoading(true);
      const symbol = data.symbol as string;
      
      // Add user message
      setMessages((prev) => [
        ...prev,
        {
          id: `user-${Date.now()}`,
          role: "user",
          content: `Analyze ${symbol}`,
          contentType: "text",
          createdAt: new Date(),
        },
      ]);
      
      try {
        const response = await ApiService.analyzeLoser({
          userId,
          symbol,
          conversationId: conversationId || undefined,
          vaultOwnerToken,
        });
        
        const result = await response.json();
        
        // Update conversation ID if new
        if (result.conversation_id && !conversationId) {
          setConversationId(result.conversation_id);
        }
        
        // Add analysis result
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: `Here's my analysis for ${symbol}:`,
            contentType: "component",
            componentType: "analysis_summary",
            componentData: {
              ticker: result.ticker,
              decision: result.decision,
              confidence: result.confidence,
              summary: result.summary,
              hasFullAnalysis: true,
            },
            createdAt: new Date(),
          },
        ]);
        
        // Notify parent of world model update
        if (onWorldModelUpdate && result.saved_to_world_model) {
          onWorldModelUpdate([
            { domain: "kai_decisions", key: `${symbol}_decision`, value: result.decision },
          ]);
        }
      } catch (error) {
        console.error("Analysis error:", error);
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: "assistant",
            content: `I encountered an error analyzing ${symbol}. Please try again.`,
            contentType: "text",
            createdAt: new Date(),
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    } else if (action === "analyze_all_losers" && data.symbols) {
      // Analyze all losers - set input for user to send
      const symbols = data.symbols as string[];
      setInput(`Analyze all my losers: ${symbols.join(", ")}`);
    } else if (action === "view_full_analysis" && data.ticker) {
      // Navigate to full analysis view
      const ticker = data.ticker as string;
      router.push(`/kai/analyze/${ticker}`);
    } else if (action === "review_losers") {
      // Trigger review losers flow - set input for user to send
      setInput("Show me my portfolio losers");
    } else if (action === "import_new") {
      // Show portfolio import component
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: "Let's update your portfolio with a new statement:",
          contentType: "component",
          componentType: "portfolio_import",
          componentData: { prompt: "Upload updated statement", show_skip: true },
          createdAt: new Date(),
        },
      ]);
    }
  }, [userId, vaultOwnerToken, conversationId, onWorldModelUpdate, router, input, isLoading, setInput, setIsLoading, setMessages, setConversationId]);

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
      if (data.conversation_id && !conversationId) {
        setConversationId(data.conversation_id);
      }

      // Add assistant response
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: data.response || data.message || "I understand. Let me help you with that.",
        contentType: data.component_type ? "component" : "text",
        componentType: data.component_type,
        componentData: data.component_data,
        createdAt: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Handle learned attributes
      if (data.learned_attributes && data.learned_attributes.length > 0 && onWorldModelUpdate) {
        onWorldModelUpdate(data.learned_attributes);
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
          variant="none"
          effect="glass"
          size="icon"
          className="shrink-0"
          onClick={() => router.push("/kai")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3 flex-1">
          <HushhLogoAvatar size="md" />
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
                  : "bg-gradient-to-br from-[var(--morphy-primary-start)]/20 to-[var(--morphy-primary-end)]/10 border border-[var(--morphy-primary-start)]/20"
              )}
            >
              {msg.role === "user" ? (
                <User className="h-4 w-4" />
              ) : (
                <HushhLogoIcon size={16} className="opacity-80" />
              )}
            </div>

            {/* Message Content */}
            <div
              className={cn(
                "p-3 rounded-2xl text-sm",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-tr-sm"
                  : "crystal-glass rounded-tl-sm"
              )}
            >
              {msg.contentType === "component" && msg.componentType ? (
                <InsertableComponent
                  type={msg.componentType}
                  data={msg.componentData || {}}
                  onAction={handleComponentAction}
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
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[var(--morphy-primary-start)]/20 to-[var(--morphy-primary-end)]/10 border border-[var(--morphy-primary-start)]/20 flex items-center justify-center">
              <HushhLogoIcon size={16} className="opacity-80" />
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
              variant="none"
              effect="glass"
              size="sm"
              className="shrink-0 rounded-full text-xs"
              onClick={() => handleQuickAction("Analyze my portfolio")}
            >
              <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
              Analyze Portfolio
            </Button>
            <Button
              variant="none"
              effect="glass"
              size="sm"
              className="shrink-0 rounded-full text-xs"
              onClick={() => handleQuickAction("Import my brokerage statement")}
            >
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              Import Statement
            </Button>
            <Button
              variant="none"
              effect="glass"
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
            variant="none"
            effect="glass"
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
            variant={input.trim() ? "gradient" : "none"}
            effect="fill"
            className={cn(
              "shrink-0 rounded-full transition-all",
              !input.trim() && "bg-muted text-muted-foreground"
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
