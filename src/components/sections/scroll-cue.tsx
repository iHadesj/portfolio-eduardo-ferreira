"use client";

import { useState } from "react";
import { motion, useMotionValueEvent, useScroll } from "motion/react";
import { useReducedMotionSafe } from "@/hooks/use-reduced-motion-safe";
import { useI18n } from "@/lib/i18n/locale-provider";

/** Vertical line with a descending pulse. Hides on reduced motion / first scroll. */
export function ScrollCue() {
  const reduced = useReducedMotionSafe();
  const { dict } = useI18n();
  const { scrollY } = useScroll();
  const [hidden, setHidden] = useState(false);

  useMotionValueEvent(scrollY, "change", (y) => setHidden(y > 40));

  if (reduced || hidden) return null;

  return (
    <div
      aria-hidden
      className="hidden sm:flex sm:flex-col sm:items-center sm:gap-2"
    >
      <div className="bg-ash relative h-12 w-px overflow-hidden">
        <motion.div
          className="bg-signal absolute inset-x-0 top-0 h-3"
          animate={{ y: ["-100%", "400%"] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
      <span className="text-smoke font-mono text-[0.625rem] tracking-widest uppercase">
        {dict.scrollCue}
      </span>
    </div>
  );
}
