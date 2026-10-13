"use client";

import { useRef } from "react";
import {
  motion,
  useInView,
  useScroll,
  useSpring,
  useTransform,
  type HTMLMotionProps,
} from "motion/react";
import { useMounted } from "@/hooks/use-mounted";
import { useReducedMotionSafe } from "@/hooks/use-reduced-motion-safe";
import { cn } from "@/lib/utils";

interface ScrollFlowProps {
  children: React.ReactNode;
  id?: string;
  className?: string;
}

/**
 * Gives the home page one continuous, scroll-linked visual rhythm. The content
 * remains regular document flow; only the ambient light and progress rail are
 * fixed, so anchors, keyboard navigation and native layout keep working.
 */
export function ScrollFlow({ children, id, className }: ScrollFlowProps) {
  const rootRef = useRef<HTMLElement>(null);
  const reduced = useReducedMotionSafe();
  const { scrollYProgress } = useScroll({
    target: rootRef,
    offset: ["start start", "end end"],
  });
  const progress = useSpring(scrollYProgress, {
    stiffness: 85,
    damping: 24,
    mass: 0.28,
    restDelta: 0.001,
  });

  const firstGlowX = useTransform(progress, [0, 1], ["-7vw", "10vw"]);
  const firstGlowY = useTransform(progress, [0, 1], ["-12vh", "58vh"]);
  const secondGlowX = useTransform(progress, [0, 1], ["9vw", "-8vw"]);
  const secondGlowY = useTransform(progress, [0, 1], ["58vh", "-18vh"]);
  const thirdGlowX = useTransform(progress, [0, 1], ["-6vw", "7vw"]);
  const thirdGlowY = useTransform(progress, [0, 1], ["46vh", "-24vh"]);
  /* The travelling glows must not resolve to nothing: the tail of the page
     (contact, footer) would otherwise land on a flat fill with no light at all. */
  const ambientOpacity = useTransform(
    progress,
    [0, 0.88, 1],
    [0.75, 0.62, 0.5],
  );
  /* A cold counterweight that only exists in the second half, so the descent
     shifts in temperature instead of simply dimming. */
  const thirdGlowOpacity = useTransform(
    progress,
    [0.32, 0.68, 1],
    [0, 0.85, 1],
  );

  return (
    <main
      ref={rootRef}
      id={id}
      data-scroll-flow
      className={cn("relative isolate overflow-clip", className)}
    >
      <motion.div
        aria-hidden
        className="scroll-flow-ambient pointer-events-none fixed inset-0 z-0 overflow-hidden"
        style={{ opacity: reduced ? 0.78 : ambientOpacity }}
      >
        <motion.div
          className="scroll-flow-glow-primary absolute -top-[18vw] -left-[24vw] size-[68vw] min-h-96 min-w-96 rounded-full"
          style={reduced ? undefined : { x: firstGlowX, y: firstGlowY }}
        />
        <motion.div
          className="scroll-flow-glow-secondary absolute right-[-28vw] bottom-[-16vw] size-[72vw] min-h-96 min-w-96 rounded-full"
          style={reduced ? undefined : { x: secondGlowX, y: secondGlowY }}
        />
        <motion.div
          className="scroll-flow-glow-tertiary absolute bottom-[-34vw] left-[8vw] size-[64vw] min-h-80 min-w-80 rounded-full"
          style={
            reduced
              ? { opacity: 0.85 }
              : { x: thirdGlowX, y: thirdGlowY, opacity: thirdGlowOpacity }
          }
        />
      </motion.div>

      {!reduced ? (
        <>
          <div
            aria-hidden
            className="border-ash/70 fixed top-1/2 right-5 z-40 hidden h-28 w-px -translate-y-1/2 overflow-hidden border-l md:block"
          >
            <motion.span
              className="bg-molten absolute inset-0 block origin-top"
              style={{ scaleY: progress }}
            />
          </div>
          <motion.div
            aria-hidden
            className="bg-molten fixed inset-x-0 top-16 z-[49] h-px origin-left md:hidden"
            style={{ scaleX: progress }}
          />
        </>
      ) : null}

      <div className="relative z-[2]">{children}</div>
    </main>
  );
}

interface ScrollSectionProps extends HTMLMotionProps<"section"> {
  /** Maximum vertical drift, in pixels, across the section's viewport pass. */
  flowStrength?: number;
}

/** A section that eases into and out of the viewport without leaving flow. */
export function ScrollSection({
  children,
  className,
  flowStrength = 26,
  style,
  ...props
}: ScrollSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const mounted = useMounted();
  const reduced = useReducedMotionSafe();
  const nearby = useInView(sectionRef, { margin: "100% 0px 100% 0px" });
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });
  const progress = useSpring(scrollYProgress, {
    stiffness: 115,
    damping: 30,
    mass: 0.22,
    restDelta: 0.001,
  });
  const y = useTransform(
    progress,
    [0, 0.18, 0.5, 0.82, 1],
    [flowStrength, 6, 0, -6, -flowStrength],
  );
  const opacity = useTransform(
    progress,
    [0, 0.14, 0.32, 0.72, 0.9, 1],
    [0.72, 0.94, 1, 1, 0.92, 0.76],
  );
  const hasScrollMotion = mounted && !reduced && nearby;

  return (
    <motion.section
      ref={sectionRef}
      data-scroll-section
      className={cn("scroll-flow-section", className)}
      style={{
        ...style,
        ...(hasScrollMotion ? { y, opacity } : {}),
      }}
      {...props}
    >
      {children}
    </motion.section>
  );
}
