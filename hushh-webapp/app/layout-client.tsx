"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useStatusBar } from "@/lib/hooks/use-status-bar";
import { getGsap, prefersReducedMotion } from "@/lib/morphy-ux/gsap";
import { motionDurations } from "@/lib/morphy-ux/motion";

interface RootLayoutClientProps {
  children: ReactNode;
  fontClasses: string;
}

/**
 * Client-side wrapper for body element
 * Enables client-side features in root layout
 *
 * MANDATORY: Implements seamless opacity crossfade transitions at root level.
 * All route changes go through this transition system automatically.
 *
 * Note: RootLoader and RouteProgressBar are now in providers.tsx inside
 * PageLoadingProvider so they can access the loading context.
 */
export function RootLayoutClient({
  children,
  fontClasses,
}: RootLayoutClientProps) {
  useStatusBar();
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hasMountedRef = useRef(false);
  const previousPathnameRef = useRef<string | null>(null);
  const previousChildrenRef = useRef<ReactNode>(null);
  const [displayChildren, setDisplayChildren] = useState<ReactNode>(children);
  const [isTransitioning, setIsTransitioning] = useState(false);
  /** Previous children rendered for fade-out; kept in state so we don't read refs during render */
  const [previousChildrenForTransition, setPreviousChildrenForTransition] =
    useState<ReactNode>(null);
  const oldPageRef = useRef<HTMLDivElement | null>(null);
  const newPageRef = useRef<HTMLDivElement | null>(null);
  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize on mount
  useEffect(() => {
    if (!hasMountedRef.current) {
      previousChildrenRef.current = children;
      previousPathnameRef.current = pathname;
      hasMountedRef.current = true;
      setDisplayChildren(children);
    }
  }, []);

  // Handle route change with seamless opacity transition
  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplayChildren(children);
      previousChildrenRef.current = children;
      previousPathnameRef.current = pathname;
      return;
    }

    if (!hasMountedRef.current) {
      setDisplayChildren(children);
      previousChildrenRef.current = children;
      previousPathnameRef.current = pathname;
      return;
    }

    // Check if pathname actually changed
    if (previousPathnameRef.current === pathname) {
      // Pathname unchanged, update children if they changed (e.g., state update)
      if (previousChildrenRef.current !== children && !isTransitioning) {
        setDisplayChildren(children);
        previousChildrenRef.current = children;
      }
      return;
    }

    // Pathname changed - start transition
    const oldPathname = previousPathnameRef.current;
    previousPathnameRef.current = pathname;
    setIsTransitioning(true);

    // Store current display children as old page before updating (ref for logic, state for render)
    const oldChildren = displayChildren;
    previousChildrenRef.current = oldChildren;
    setPreviousChildrenForTransition(oldChildren);

    // Update display children to new page immediately (will be hidden initially)
    setDisplayChildren(children);

    // Start transition after a brief delay to allow DOM to update
    const startTransition = () => {
      // Clear any pending timeout
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
        transitionTimeoutRef.current = null;
      }

      // Small delay to ensure DOM refs are ready
      transitionTimeoutRef.current = setTimeout(() => {
        void getGsap().then((gsap) => {
          if (!gsap || !oldPageRef.current || !newPageRef.current) {
            setDisplayChildren(children);
            setIsTransitioning(false);
            return;
          }

          const oldPage = oldPageRef.current;
          const newPage = newPageRef.current;

          // Ensure new page is visible but transparent
          // IMPORTANT: Don't set display:block - it breaks flex layout
          newPage.style.opacity = "0";
          newPage.style.pointerEvents = "none";

          // Fade out old page and fade in new page simultaneously
          gsap.to(oldPage, {
            opacity: 0,
            duration: motionDurations.sm / 1000,
            ease: "power2.in",
            onComplete: () => {
              // Hide old page after fade
              if (oldPage) {
                oldPage.style.display = "none";
              }
              setPreviousChildrenForTransition(null);
              setIsTransitioning(false);
            },
          });

          gsap.to(newPage, {
            opacity: 1,
            duration: motionDurations.sm / 1000,
            ease: "power2.out",
            onComplete: () => {
              if (newPage) {
                newPage.style.pointerEvents = "auto";
                // CRITICAL: Clear any inline styles that might break flex layout
                newPage.style.removeProperty("display");
              }
            },
          });
        });
      }, 50);
    };

    // Start transition immediately (loading state is handled by RootLoader in providers)
    startTransition();

    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
      // Clean up any inline styles on unmount/re-render to prevent stale styles
      if (newPageRef.current) {
        newPageRef.current.style.removeProperty("opacity");
        newPageRef.current.style.removeProperty("display");
        newPageRef.current.style.removeProperty("pointerEvents");
      }
    };
  }, [pathname, children]);

  return (
    <body
      suppressHydrationWarning
      className={`${fontClasses} font-sans antialiased h-screen flex flex-col overflow-hidden`}
      style={{
        fontFamily: "var(--font-figtree), var(--font-quicksand), sans-serif",
      }}
    >
      {/* Fixed App Background - Oversized to prevent mobile gaps */}
      <div className="fixed top-[-10vh] left-0 w-full h-[120vh] -z-20 morphy-app-bg pointer-events-none" />
      {/* Subtle radial glow overlay */}
      <div className="fixed inset-0 pointer-events-none morphy-app-bg-radial z-1" />

      {/* Two-page overlay system for seamless transitions */}
      <div ref={containerRef} className="flex-1 flex flex-col min-h-0 relative">
        {/* Old page (fading out) */}
        {isTransitioning && previousChildrenForTransition != null && (
          <div
            ref={oldPageRef}
            className="absolute inset-0 flex-1 flex flex-col"
            style={{ opacity: 1, pointerEvents: "none" }}
          >
            {previousChildrenForTransition}
          </div>
        )}

        {/* New page (fading in) */}
        <div
          ref={newPageRef}
          className="flex-1 flex flex-col min-h-0"
          style={{
            opacity: isTransitioning ? 0 : 1,
          }}
        >
          {displayChildren}
        </div>
      </div>
    </body>
  );
}
