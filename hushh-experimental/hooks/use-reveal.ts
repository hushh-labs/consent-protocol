// =============================================================================
// useReveal - Scroll-triggered reveal animations (GSAP + Morphy Motion)
// =============================================================================

import { useEffect, useRef } from "react";
import { motionVariants } from "@/lib/morphy-ux/motion";
import {
  scrollReveal,
  scrollStaggerReveal,
  createFloatingParticles,
} from "@/lib/morphy-ux/gsap";

type RevealVariant = keyof typeof motionVariants;

export const useReveal = <T extends HTMLElement = HTMLElement>(
  variant: RevealVariant = "enterFromBottom"
) => {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const from = motionVariants[variant];
    const to = { y: 0, opacity: 1 } as const;
    scrollReveal(el, from, to);
  }, [variant]);

  return ref;
};

export const useStaggerReveal = <T extends HTMLElement = HTMLElement>(
  itemSelector: string,
  variant: RevealVariant = "enterFromBottom",
  staggerMs = 60
) => {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const from = motionVariants[variant];
    const to = { y: 0, opacity: 1 } as const;
    scrollStaggerReveal(el, itemSelector, from, to, staggerMs);
  }, [itemSelector, variant, staggerMs]);

  return ref;
};

export const useFloatingParticles = <T extends HTMLElement = HTMLElement>(
  count = 8
) => {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current as unknown as HTMLElement | null;
    if (!el) return;
    el.style.opacity = "0";
    createFloatingParticles(el, count);
  }, [count]);
  return ref;
};
