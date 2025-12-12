"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// Agent modes
const agentModes = [
  { id: "orchestrator", name: "Hushh", icon: "🤫", color: "#DC143C", endpoint: "/" },
  { id: "optimizer", name: "Kai", icon: "💰", color: "#C7A035", endpoint: "/kai" },
  { id: "curator", name: "Nav", icon: "🎯", color: "#BF5AF2", endpoint: "/nav" },
  { id: "professional", name: "Kushal", icon: "💼", color: "#007AFF", endpoint: "/kushal" },
];

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  mode?: string;
}

export default function JarvisPage() {
  const [activeMode, setActiveMode] = useState("orchestrator");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hello! I'm your Hushh agent. How can I help you today?",
      mode: "orchestrator",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage.content,
          mode: activeMode,
          sessionId: "demo-session",
        }),
      });

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.response || "I'm processing your request...",
        mode: activeMode,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "Connection issue. Please try again.",
          mode: activeMode,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const currentMode = agentModes.find((m) => m.id === activeMode);

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="nav-glass px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl">🤫</span>
          <span className="font-semibold text-primary">hushh</span>
        </Link>

        {/* Mode Selector */}
        <div className="flex items-center gap-3">
          {agentModes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => setActiveMode(mode.id)}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                activeMode === mode.id
                  ? "ring-2 ring-offset-2"
                  : "opacity-50 hover:opacity-80"
              }`}
              style={{
                background: activeMode === mode.id ? `${mode.color}20` : "transparent",
                // @ts-expect-error Tailwind CSS variable
                "--tw-ring-color": mode.color,
              }}
              title={mode.name}
            >
              <span className="text-xl">{mode.icon}</span>
            </button>
          ))}
        </div>

        <div className="text-sm font-medium" style={{ color: currentMode?.color }}>
          {currentMode?.name}
        </div>
      </header>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <Card
                variant="none"
                effect="glass"
                className={`max-w-[80%] ${
                  message.role === "user" ? "bg-gradient-to-r from-[#DC143C] to-[#C7A035] text-white" : ""
                }`}
              >
                {message.role === "assistant" && (
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">
                      {agentModes.find((m) => m.id === message.mode)?.icon || "🤫"}
                    </span>
                    <span className="text-xs font-medium text-secondary">
                      {agentModes.find((m) => m.id === message.mode)?.name || "Hushh"}
                    </span>
                  </div>
                )}
                <p className="text-body">{message.content}</p>
              </Card>
            </motion.div>
          ))}

          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <Card variant="none" effect="glass" className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{currentMode?.icon}</span>
                  <span className="animate-pulse">Thinking...</span>
                </div>
              </Card>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="nav-glass px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder={`Message ${currentMode?.name}...`}
            disabled={isLoading}
            className="flex-1 px-4 py-3 rounded-full glass border-0 focus:outline-none focus:ring-2 disabled:opacity-50"
            style={{ 
              // @ts-expect-error Tailwind CSS variable
              "--tw-ring-color": currentMode?.color 
            }}
          />
          <Button
            variant="gradient"
            effect="glass"
            showRipple
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
          >
            {isLoading ? "..." : "Send"}
          </Button>
        </div>
      </div>
    </main>
  );
}
