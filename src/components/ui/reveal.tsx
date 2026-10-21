"use client";

import { motion, type HTMLMotionProps } from "motion/react";
import { easeOutExpo } from "@/lib/motion-presets";
import { useReducedMotionSafe } from "@/hooks/use-reduced-motion-safe";

type RevealFrom = "below" | "left" | "right" | "bloom";

interface RevealProps extends HTMLMotionProps<"div"> {
  delay?: number;
  duration?: number;
  distance?: number;
  /**
   * Where the element arrives from. Nothing slides in on a ruler: "below"
   * rises with a slight tilt that straightens out, "left"/"right" swing in
   * on an arc, and "bloom" opens from a rounded window (for media and cards).
   */
  from?: RevealFrom;
}

const START: Record<
  RevealFrom,
  (distance: number) => Record<string, number | string>
> = {
  below: (distance) => ({ x: 0, y: distance, rotate: -1.4 }),
  left: (distance) => ({ x: -distance * 1.5, y: distance * 0.7, rotate: -2.6 }),
  right: (distance) => ({ x: distance * 1.5, y: distance * 0.7, rotate: 2.6 }),
  bloom: (distance) => ({
    x: 0,
    y: distance * 0.5,
    rotate: 0,
    clipPath: "inset(14% 10% 22% 10% round 48px)",
  }),
};

const ORIGIN: Record<RevealFrom, string> = {
  below: "0% 100%",
  left: "0% 100%",
  right: "100% 100%",
  bloom: "50% 60%",
};

/**
 * Scroll-into-view reveal, once. Under reduced motion only the fade remains:
 * no travel, no tilt, no mask.
 */
export function Reveal({
  delay = 0,
  duration = 0.7,
  distance = 32,
  from = "below",
  children,
  style,
  ...props
}: RevealProps) {
  const reduced = useReducedMotionSafe();
  const start = reduced ? {} : START[from](distance);
  const spring = {
    type: "spring" as const,
    stiffness: 95,
    damping: 21,
    mass: 0.6,
    delay,
  };

  return (
    <motion.div
      initial={{
        opacity: 0,
        filter: reduced ? "none" : "blur(7px)",
        ...start,
      }}
      whileInView={{
        opacity: 1,
        filter: "blur(0px)",
        x: 0,
        y: 0,
        rotate: 0,
        // Ends outside the box so it never trims a glow or a focus ring.
        ...(from === "bloom" && !reduced
          ? { clipPath: "inset(-12% -12% -12% -12% round 0px)" }
          : {}),
      }}
      viewport={{ once: true, amount: 0.16, margin: "0px 0px -7%" }}
      transition={{
        opacity: { duration: duration * 0.8, ease: easeOutExpo, delay },
        filter: { duration: duration * 0.75, ease: easeOutExpo, delay },
        clipPath: { duration: duration * 1.25, ease: easeOutExpo, delay },
        x: reduced ? { duration: 0 } : spring,
        y: reduced ? { duration: 0 } : spring,
        rotate: reduced ? { duration: 0 } : spring,
      }}
      style={{ transformOrigin: ORIGIN[from], ...style }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
