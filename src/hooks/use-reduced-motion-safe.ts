"use client";

import { useReducedMotion } from "motion/react";
import { useMounted } from "@/hooks/use-mounted";

/**
 * prefers-reduced-motion as a boolean — safe to branch on *during render*.
 *
 * motion's `useReducedMotion` already knows the real value on the very first
 * client render, while the server rendered with `false`. Any consumer that
 * returns different markup for reduced motion (Marquee, Lenis)
 * therefore hydrated against mismatched HTML — React error #418.
 *
 * Gating on `useMounted` keeps the hydration render identical to the server's,
 * then re-renders with the true value one tick later. Nothing animates in that
 * tick: the global `prefers-reduced-motion` block in globals.css neutralises
 * animation and transition durations regardless of what React rendered.
 *
 * Consumed by Lenis, the 3D hero, marquee, scramble, magnetic and the cursor
 * — the kill-switch of §2.7.
 */
export function useReducedMotionSafe(): boolean {
  const mounted = useMounted();
  const reduced = useReducedMotion() ?? false;
  return mounted && reduced;
}
