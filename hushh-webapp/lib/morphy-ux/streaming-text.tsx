/**
 * StreamingTextDisplay Component
 *
 * A container for displaying streaming text with auto-scroll and cursor.
 * Designed for ChatGPT/Perplexity-style streaming responses.
 *
 * Features:
 * - Auto-scroll as content grows (respects user scroll intent)
 * - Blinking cursor at end of text
 * - Smooth scroll behavior
 * - Markdown-safe whitespace handling
 *
 * @example
 * <StreamingTextDisplay
 *   text={streamedText}
 *   isStreaming={true}
 *   className="h-[300px]"
 * />
 */

"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { cn } from "./cn";
import { StreamingCursor } from "./streaming-cursor";

export interface StreamingTextDisplayProps {
  /** The text to display */
  text: string;
  /** Whether streaming is active */
  isStreaming: boolean;
  /** Show blinking cursor */
  showCursor?: boolean;
  /** Cursor color variant */
  cursorColor?: "primary" | "muted" | "accent" | "success" | "error";
  /** Additional CSS classes for container */
  className?: string;
  /** Additional CSS classes for text */
  textClassName?: string;
  /** Threshold from bottom to consider "at bottom" (px) */
  scrollThreshold?: number;
  /** Enable smooth scroll */
  smoothScroll?: boolean;
  /** Placeholder text when empty */
  placeholder?: string;
}

export function StreamingTextDisplay({
  text,
  isStreaming,
  showCursor = true,
  cursorColor = "primary",
  className,
  textClassName,
  scrollThreshold = 100,
  smoothScroll = true,
  placeholder = "Waiting for response...",
}: StreamingTextDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);

  // Check if scrolled to bottom
  const checkIfAtBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return true;

    const { scrollTop, scrollHeight, clientHeight } = container;
    return scrollHeight - scrollTop - clientHeight < scrollThreshold;
  }, [scrollThreshold]);

  // Handle user scroll
  const handleScroll = useCallback(() => {
    const atBottom = checkIfAtBottom();

    // If user scrolled up, stop auto-scrolling
    if (!atBottom) {
      setUserScrolledUp(true);
    }
    // If user scrolled back to bottom, resume auto-scrolling
    if (atBottom && userScrolledUp) {
      setUserScrolledUp(false);
    }
  }, [checkIfAtBottom, userScrolledUp]);

  // Auto-scroll when text changes (if user hasn't scrolled up)
  useEffect(() => {
    const container = containerRef.current;
    if (!container || userScrolledUp) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior: smoothScroll ? "smooth" : "auto",
    });
  }, [text, smoothScroll, userScrolledUp]);

  // Attach scroll listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  const isEmpty = !text || text.length === 0;

  return (
    <div
      ref={containerRef}
      className={cn(
        "overflow-y-auto overscroll-contain",
        "scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent",
        className
      )}
    >
      {isEmpty && !isStreaming ? (
        <p className="text-muted-foreground text-sm italic">{placeholder}</p>
      ) : (
        <p
          className={cn(
            "whitespace-pre-wrap leading-relaxed text-sm",
            textClassName
          )}
        >
          {text}
          {showCursor && (isStreaming || isEmpty) && (
            <StreamingCursor isStreaming={isStreaming} color={cursorColor} />
          )}
        </p>
      )}

      {/* Scroll to bottom button (shows when user scrolled up during streaming) */}
      {userScrolledUp && isStreaming && (
        <button
          onClick={() => {
            setUserScrolledUp(false);
            containerRef.current?.scrollTo({
              top: containerRef.current.scrollHeight,
              behavior: "smooth",
            });
          }}
          className={cn(
            "fixed bottom-4 right-4 z-10",
            "px-3 py-1.5 rounded-full",
            "bg-primary text-primary-foreground text-xs font-medium",
            "shadow-lg hover:shadow-xl transition-shadow",
            "animate-in fade-in slide-in-from-bottom-2"
          )}
        >
          ↓ Scroll to bottom
        </button>
      )}
    </div>
  );
}
