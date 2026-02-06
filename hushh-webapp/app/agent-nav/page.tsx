"use client";

/**
 * Agent Nav - Navigation Assistant (Coming Soon)
 *
 * Nav (♀) — Creator & future founder
 * Your organized, insightful guide within Hushh.
 * Features a typing animation with power words.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useStepProgress } from "@/lib/progress/step-progress-context";

// Power words from Nav's persona
const POWER_WORDS = [
  "Organized",
  "Insightful",
  "Helpful",
  "Intuitive",
  "Thoughtful",
  "Proactive",
  "Creative",
];

export default function AgentNavPage() {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { registerSteps, completeStep, reset } = useStepProgress();
  const [currentWord, setCurrentWord] = useState("");
  const [wordIndex, setWordIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showCursor, setShowCursor] = useState(true);

  // Register 1 step: Auth check
  useEffect(() => {
    registerSteps(1);
    return () => reset();
  }, [registerSteps, reset]);

  // Step 1: Auth check complete
  useEffect(() => {
    if (!authLoading) {
      completeStep();
    }
  }, [authLoading, completeStep]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/");
    }
  }, [isAuthenticated, authLoading, router]);

  // Blinking cursor effect
  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setShowCursor((prev) => !prev);
    }, 530);
    return () => clearInterval(cursorInterval);
  }, []);

  // Typing animation effect simple logic
  useEffect(() => {
    const targetWord = POWER_WORDS[wordIndex];
    if (!targetWord) return;

    // Much faster speeds
    const delayTyping_char = 75;
    const delayErasing_text = 40;
    const delayTyping_text = 1500;

    let timer: NodeJS.Timeout;

    const handleTyping = () => {
      // Logic same as before
      if (isDeleting) {
        if (currentWord.length > 0) {
          setIsTyping(true);
          timer = setTimeout(() => {
            setCurrentWord((prev) => prev.slice(0, -1));
          }, delayErasing_text);
        } else {
          setIsTyping(false);
          setIsDeleting(false);
          setWordIndex((prev) => (prev + 1) % POWER_WORDS.length);
        }
      } else {
        if (currentWord.length < targetWord.length) {
          setIsTyping(true);
          timer = setTimeout(() => {
            setCurrentWord(targetWord.slice(0, currentWord.length + 1));
          }, delayTyping_char);
        } else {
          setIsTyping(false);
          timer = setTimeout(() => {
            setIsDeleting(true);
          }, delayTyping_text);
        }
      }
    };

    handleTyping();
    return () => clearTimeout(timer);
  }, [currentWord, isDeleting, wordIndex]);

  // Show nothing while checking auth
  if (authLoading || !isAuthenticated) {
    return null;
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6">
      {/* Search Logo - Massive */}
      {/* Search Logo - Massive & Fixed Size */}
      <div className="mb-8 shrink-0 select-none pointer-events-none">
        <div className="flex items-center justify-center w-[50px] h-[50px]">
          <Search className="w-full h-full text-foreground" strokeWidth={1} />
        </div>
      </div>

      {/* Combined Headline & Typing Animation - Jitter Free Layout */}
      <div className="w-full max-w-5xl flex flex-row items-baseline justify-center gap-3 mb-16 px-2 sm:px-4">
        {/* Right-aligned Static Text */}
        <div className="flex-1 flex justify-end text-right">
          <span className="hushh-gradient-text text-xl md:text-3xl font-bold whitespace-nowrap">
            Agent Nav is
          </span>
        </div>

        {/* Left-aligned Dynamic Text */}
        <div className="flex-1 flex justify-start text-left font-mono items-baseline">
          <style jsx>{`
            .blinking-cursor {
              animation: blinker 1s step-end infinite;
            }
            .blinking-cursor.typing {
              animation: none;
              opacity: 1;
            }
            @keyframes blinker {
              0% {
                opacity: 1;
              }
              50% {
                opacity: 0;
              }
            }
          `}</style>

          <span
            className="text-xl md:text-3xl text-muted-foreground"
            style={{
              fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace",
            }}
          >
            {currentWord}
          </span>
          <span
            className={`blinking-cursor inline-block w-[0.6em] h-[1em] bg-primary ml-2 ${
              isTyping ? "typing" : ""
            }`}
          />
        </div>
      </div>

      {/* Coming Soon Badge - no sparkle */}
      <div className="inline-flex items-center px-6 py-3 rounded-full bg-primary/10 text-primary font-medium mb-12">
        Coming Soon
      </div>

      {/* Tagline */}
      <p className="text-muted-foreground text-sm text-center">
        Your personal guide to navigating Hushh
      </p>
    </div>
  );
}
