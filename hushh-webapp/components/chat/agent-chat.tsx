"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/lib/morphy-ux/morphy";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Send, 
  Bot, 
  User, 
  Loader2, 
  Sparkles,
  ShieldCheck
} from "lucide-react";
import { cn } from "@/lib/utils";

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
}

export function AgentChat({ 
  agentId, 
  agentName, 
  initialMessage = "Hello! I'm ready to help you build your profile.",
  className 
}: AgentChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "agent",
      content: initialMessage,
      timestamp: new Date(),
    }
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

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input;
    setInput("");
    
    // Add User Message
    const newMessages: Message[] = [
      ...messages, 
      { role: "user", content: userMessage, timestamp: new Date() }
    ];
    setMessages(newMessages);
    setIsLoading(true);

    // Real API Call
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: userMessage,
          agentId 
        }),
      });

      const data = await response.json();
      
      // Handle System Events (Delegation) if present
      if (data.delegation) {
         setMessages(prev => [
            ...prev,
            { role: "agent", content: `Connecting to ${data.delegation.target_agent}...`, timestamp: new Date(), type: "system_event" }
         ]);
      }

      setMessages(prev => [
        ...prev,
        { role: "agent", content: data.content, timestamp: new Date(), isStreaming: false }
      ]);
    } catch (error) {
      setMessages(prev => [
        ...prev,
        { role: "agent", content: "Error: Failed to reach the agent. Please ensure the Python services are running.", timestamp: new Date(), isStreaming: false }
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

  return (
    <Card 
      className={cn("flex flex-col h-[600px] w-full max-w-4xl mx-auto overflow-hidden border-0 shadow-2xl bg-white/50 dark:bg-black/50 backdrop-blur-xl", className)}
      variant="none"
      effect="glass"
    >
      {/* Header */}
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
              Active • {agentId}
            </div>
          </div>
        </div>
        
        <div className="flex gap-2">
           <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
             <ShieldCheck className="h-4 w-4" />
           </Button>
        </div>
      </div>

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
            <div className={cn(
              "h-8 w-8 rounded-full flex items-center justify-center shrink-0 mt-1",
              msg.role === "user" 
                ? "bg-gray-200 dark:bg-gray-800" 
                : "bg-linear-to-br from-blue-500/20 to-purple-600/20 border border-blue-200 dark:border-blue-900"
            )}>
              {msg.role === "user" ? (
                <User className="h-4 w-4" />
              ) : (
                <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              )}
            </div>

            {/* Bubble */}
            <div className={cn(
              "p-4 rounded-2xl text-sm leading-relaxed shadow-sm",
              msg.role === "user"
                ? "bg-blue-600 text-white rounded-tr-none"
                : msg.type === "system_event"
                    ? "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-xs italic"
                    : "bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-tl-none"
            )}>
              {msg.content}
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
               <span className="text-xs text-muted-foreground">Thinking...</span>
             </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white/30 dark:bg-black/30 border-t border-gray-200/50 dark:border-gray-800/50 backdrop-blur-md">
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
             Private & Secure via Hushh Protocol
           </p>
        </div>
      </div>
    </Card>
  );
}
