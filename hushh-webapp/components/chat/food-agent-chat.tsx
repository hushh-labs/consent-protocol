"use client";

/**
 * Food Agent Chat Component
 * 
 * Specialized chat interface for food preference collection.
 * Features:
 * - Multi-turn conversation with session state
 * - Consent flow with user confirmation
 * - Beautiful glassmorphic design
 * - Vault storage on completion
 */

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/lib/morphy-ux/morphy";
import { Input } from "@/components/ui/input";
import { 
  Send, 
  Bot, 
  User, 
  Loader2, 
  Sparkles,
  ShieldCheck,
  UtensilsCrossed,
  Check,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "agent";
  content: string;
  timestamp: Date;
  type?: "text" | "consent_request" | "success";
}

interface SessionState {
  step: string;
  collected: Record<string, unknown>;
}

interface FoodAgentChatProps {
  userId: string;
  onComplete?: (data: Record<string, unknown>) => void;
  className?: string;
}

export function FoodAgentChat({ 
  userId,
  onComplete,
  className 
}: FoodAgentChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionState, setSessionState] = useState<SessionState | null>(null);
  const [needsConsent, setNeedsConsent] = useState(false);
  const [collectedData, setCollectedData] = useState<Record<string, unknown>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Start conversation on mount
  useEffect(() => {
    handleSend("hi", true);
  }, []);

  const handleSend = async (messageOverride?: string, isInitial = false) => {
    const userMessage = messageOverride || input;
    if (!userMessage.trim() || isLoading) return;

    if (!isInitial) {
      setInput("");
      setMessages(prev => [...prev, { 
        role: "user", 
        content: userMessage, 
        timestamp: new Date() 
      }]);
    }
    
    setIsLoading(true);

    try {
      const response = await fetch("/api/agents/food-dining/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          userId,
          message: userMessage,
          sessionState 
        }),
      });

      const data = await response.json();
      
      // Update session state
      setSessionState(data.sessionState);
      setCollectedData(data.collectedData || {});
      setNeedsConsent(data.needsConsent || false);
      
      // Add agent response
      setMessages(prev => [...prev, { 
        role: "agent", 
        content: data.response, 
        timestamp: new Date(),
        type: data.needsConsent ? "consent_request" : data.isComplete ? "success" : "text"
      }]);

      // If complete, trigger callback
      if (data.isComplete && onComplete) {
        onComplete(data.collectedData);
      }

    } catch (error) {
      setMessages(prev => [...prev, { 
        role: "agent", 
        content: "Sorry, I encountered an error. Please try again.", 
        timestamp: new Date() 
      }]);
    }

    setIsLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleConsentAction = (approve: boolean) => {
    handleSend(approve ? "save" : "edit");
  };

  return (
    <Card 
      className={cn(
        "flex flex-col h-[700px] w-full max-w-2xl mx-auto overflow-hidden",
        "border-0 shadow-2xl",
        "bg-gradient-to-b from-orange-50/80 to-white/80 dark:from-orange-950/20 dark:to-black/80",
        "backdrop-blur-xl",
        className
      )}
      variant="none"
      effect="glass"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-orange-200/50 dark:border-orange-800/30 bg-gradient-to-r from-orange-100/50 to-amber-100/50 dark:from-orange-900/20 dark:to-amber-900/20">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg">
            <UtensilsCrossed className="h-6 w-6 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Food & Dining Assistant</h3>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Setting up your preferences
            </div>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
        {messages.map((msg, idx) => (
          <div 
            key={idx} 
            className={cn(
              "flex gap-3 max-w-[85%] animate-in fade-in slide-in-from-bottom-2 duration-300",
              msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
            )}
          >
            {/* Avatar */}
            <div className={cn(
              "h-8 w-8 rounded-full flex items-center justify-center shrink-0 mt-1",
              msg.role === "user" 
                ? "bg-gray-200 dark:bg-gray-800" 
                : "bg-gradient-to-br from-orange-500/20 to-amber-600/20 border border-orange-200 dark:border-orange-800"
            )}>
              {msg.role === "user" ? (
                <User className="h-4 w-4" />
              ) : (
                <Sparkles className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              )}
            </div>

            {/* Bubble */}
            <div className={cn(
              "p-4 rounded-2xl text-sm leading-relaxed shadow-sm",
              msg.role === "user"
                ? "bg-orange-500 text-white rounded-tr-none"
                : msg.type === "consent_request"
                    ? "bg-amber-50 dark:bg-amber-900/30 border-2 border-amber-300 dark:border-amber-700 rounded-tl-none"
                    : msg.type === "success"
                        ? "bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded-tl-none"
                        : "bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-tl-none"
            )}>
              {/* Render markdown-like content with line breaks */}
              {msg.content.split('\n').map((line, i) => (
                <span key={i}>
                  {line.startsWith('•') ? (
                    <span className="block pl-2">{line}</span>
                  ) : line.startsWith('---') ? (
                    <hr className="my-2 border-gray-200 dark:border-gray-700" />
                  ) : line.includes('**') ? (
                    <span dangerouslySetInnerHTML={{ 
                      __html: line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') 
                    }} />
                  ) : (
                    line
                  )}
                  {i < msg.content.split('\n').length - 1 && <br />}
                </span>
              ))}
            </div>
          </div>
        ))}
        
        {/* Loading indicator */}
        {isLoading && (
          <div className="flex gap-3 max-w-[85%] mr-auto animate-pulse">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-orange-500/20 to-amber-600/20 border border-orange-200 dark:border-orange-800 flex items-center justify-center shrink-0 mt-1">
              <Sparkles className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="p-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
              <span className="text-xs text-muted-foreground">Thinking...</span>
            </div>
          </div>
        )}
      </div>

      {/* Consent Action Buttons (shown when consent is needed) */}
      {needsConsent && !isLoading && (
        <div className="px-4 pb-2 flex gap-3 justify-center">
          <Button
            className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white"
            onClick={() => handleConsentAction(true)}
          >
            <Check className="h-4 w-4 mr-2" />
            Save & Consent
          </Button>
          <Button
            variant="outline"
            onClick={() => handleConsentAction(false)}
          >
            <X className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 bg-white/50 dark:bg-black/30 border-t border-orange-100/50 dark:border-orange-900/30 backdrop-blur-md">
        <div className="relative flex items-center">
          <Input 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your response..."
            className="pr-12 h-12 rounded-full border-orange-200 dark:border-orange-800/50 bg-white/80 dark:bg-black/50 shadow-inner focus-visible:ring-orange-500"
            disabled={isLoading}
          />
          <Button 
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            size="icon"
            className={cn(
              "absolute right-1.5 h-9 w-9 rounded-full transition-all",
              input.trim() 
                ? "bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white shadow-md scale-100" 
                : "bg-gray-200 dark:bg-gray-800 text-gray-400 scale-90 pointer-events-none"
            )}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-2 flex justify-center">
          <p className="text-[10px] text-muted-foreground text-center flex items-center gap-1.5">
            <ShieldCheck className="h-3 w-3 text-emerald-500" />
            Your preferences are encrypted & stored securely
          </p>
        </div>
      </div>
    </Card>
  );
}
