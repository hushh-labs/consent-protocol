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
 * - Optional JSON-to-human-readable formatting
 *
 * @example
 * <StreamingTextDisplay
 *   text={streamedText}
 *   isStreaming={true}
 *   className="h-[300px]"
 * />
 *
 * @example
 * // With human-readable formatting for JSON streams
 * <StreamingTextDisplay
 *   text={jsonStream}
 *   isStreaming={true}
 *   formatAsHuman={true}
 *   className="h-[300px]"
 * />
 */

"use client";

import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { cn } from "./cn";
import { StreamingCursor } from "./streaming-cursor";
import {
  createParserContext,
  formatJsonChunk,
  tryFormatComplete,
  type ParserContext,
} from "@/lib/utils/json-to-human";

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
  /** Transform JSON to human-readable format */
  formatAsHuman?: boolean;
  /** Callback when formatting is complete with parsed data */
  onFormatComplete?: (formattedText: string) => void;
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
  formatAsHuman = false,
  onFormatComplete,
}: StreamingTextDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Track if user has manually scrolled up - start as false (auto-scroll enabled)
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  // Track if user has interacted with scroll at all
  const hasUserScrolledRef = useRef(false);
  const parserContextRef = useRef<ParserContext>(createParserContext());
  const lastTextLengthRef = useRef(0);
  // Track previous scroll height to detect programmatic vs user scroll
  const lastScrollHeightRef = useRef(0);

  // Format text if formatAsHuman is enabled
  const displayText = useMemo(() => {
    if (!formatAsHuman || !text) {
      return text;
    }

    // Check if we have new content to process
    const newContent = text.slice(lastTextLengthRef.current);
    if (newContent) {
      const result = formatJsonChunk(newContent, parserContextRef.current);
      lastTextLengthRef.current = text.length;
      
      // If streaming is done, try to format the complete JSON
      if (!isStreaming) {
        const completeFormatted = tryFormatComplete(parserContextRef.current);
        if (completeFormatted) {
          onFormatComplete?.(completeFormatted);
          return completeFormatted;
        }
      }
      
      return result.text;
    }

    // If streaming just stopped, try to format complete
    if (!isStreaming) {
      const completeFormatted = tryFormatComplete(parserContextRef.current);
      if (completeFormatted) {
        onFormatComplete?.(completeFormatted);
        return completeFormatted;
      }
    }

    return parserContextRef.current.lastOutput || text;
  }, [text, isStreaming, formatAsHuman, onFormatComplete]);

  // Reset parser context and scroll state when text is cleared
  useEffect(() => {
    if (!text || text.length === 0) {
      parserContextRef.current = createParserContext();
      lastTextLengthRef.current = 0;
      // Reset scroll state when starting fresh
      setUserScrolledUp(false);
      hasUserScrolledRef.current = false;
      lastScrollHeightRef.current = 0;
    }
  }, [text]);

  // Check if scrolled to bottom
  const checkIfAtBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return true;

    const { scrollTop, scrollHeight, clientHeight } = container;
    // Use a more generous threshold for "at bottom" detection
    return scrollHeight - scrollTop - clientHeight < scrollThreshold;
  }, [scrollThreshold]);

  // Handle user scroll - only track actual user interactions
  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const atBottom = checkIfAtBottom();
    const currentScrollHeight = container.scrollHeight;
    
    // Detect if this is a user scroll vs programmatic scroll
    // If scrollHeight changed, it's likely content was added and we auto-scrolled
    const isContentGrowth = currentScrollHeight !== lastScrollHeightRef.current;
    lastScrollHeightRef.current = currentScrollHeight;
    
    // Only consider it a user scroll if content didn't just grow
    if (!isContentGrowth) {
      hasUserScrolledRef.current = true;
      
      // If user scrolled up (away from bottom), stop auto-scrolling
      if (!atBottom) {
        setUserScrolledUp(true);
      }
    }
    
    // If user scrolled back to bottom, resume auto-scrolling
    if (atBottom && userScrolledUp && hasUserScrolledRef.current) {
      setUserScrolledUp(false);
    }
  }, [checkIfAtBottom, userScrolledUp]);

  // Auto-scroll when text changes (if user hasn't scrolled up)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    // Don't auto-scroll if user has scrolled up
    if (userScrolledUp) return;

    // Use requestAnimationFrame to ensure DOM has updated
    requestAnimationFrame(() => {
      // Double-check container still exists
      if (!containerRef.current) return;
      
      // Update scroll height tracking before scrolling
      lastScrollHeightRef.current = containerRef.current.scrollHeight;
      
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: smoothScroll ? "smooth" : "auto",
      });
    });
  }, [displayText, smoothScroll, userScrolledUp]);

  // Attach scroll listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  // Initial scroll to bottom when streaming starts
  useEffect(() => {
    if (isStreaming && !userScrolledUp) {
      const container = containerRef.current;
      if (container) {
        requestAnimationFrame(() => {
          if (containerRef.current) {
            lastScrollHeightRef.current = containerRef.current.scrollHeight;
            containerRef.current.scrollTo({
              top: containerRef.current.scrollHeight,
              behavior: "auto", // Instant scroll on initial
            });
          }
        });
      }
    }
  }, [isStreaming, userScrolledUp]);

  const isEmpty = !displayText || displayText.length === 0;

  // Handle scroll to bottom button click
  const handleScrollToBottom = useCallback(() => {
    setUserScrolledUp(false);
    const container = containerRef.current;
    if (container) {
      lastScrollHeightRef.current = container.scrollHeight;
      container.scrollTo({
        top: container.scrollHeight,
        behavior: "smooth",
      });
    }
  }, []);

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
          {displayText}
          {showCursor && (isStreaming || isEmpty) && (
            <StreamingCursor isStreaming={isStreaming} color={cursorColor} />
          )}
        </p>
      )}

      {/* Scroll to bottom button (shows when user scrolled up during streaming) */}
      {userScrolledUp && isStreaming && (
        <button
          onClick={handleScrollToBottom}
          className={cn(
            "sticky bottom-2 left-1/2 -translate-x-1/2 z-10",
            "px-4 py-2 rounded-full",
            "bg-primary text-primary-foreground text-xs font-medium",
            "shadow-lg hover:shadow-xl transition-all",
            "animate-in fade-in slide-in-from-bottom-2",
            "flex items-center gap-1.5"
          )}
        >
          <svg
            className="w-3 h-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
          Scroll to bottom
        </button>
      )}
    </div>
  );
}
