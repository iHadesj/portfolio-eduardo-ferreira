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
import { ScrollThread } from "@/components/layout/scroll-thread";
import { useMediaQuery } from "@/hooks/use-media-query";
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
 * remains regular document flow; the ambient light is fixed and the thread
 * that doubles as the progress indicator is absolutely positioned behind the
 * sections, so anchors, keyboard navigation and native layout keep working.
 */
export function ScrollFlow({ children, id, className }: ScrollFlowProps) {
  const rootRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
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

      {/* Phones keep a hairline progress bar; from md up the thread itself
          shows how far down the page the reader is. */}
      {!reduced ? (
        <motion.div
          aria-hidden
          className="bg-molten fixed inset-x-0 top-16 z-[49] h-px origin-left md:hidden"
          style={{ scaleX: progress }}
        />
      ) : null}

      <div ref={contentRef} className="relative z-[2]">
        <ScrollThread hostRef={contentRef} />
        {children}
      </div>
    </main>
  );
}

interface ScrollSectionProps extends HTMLMotionProps<"section"> {
  /** Maximum vertical drift, in pixels, across the section's viewport pass. */
  flowStrength?: number;
  /**
   * Which side the section swings in from (-1 left, 1 right, 0 straight).
   * Alternating it between sections turns the descent into a gentle zigzag
   * that follows the thread instead of a stack of boxes sliding up.
   */
  lean?: -1 | 0 | 1;
}

/** A section that eases into and out of the viewport without leaving flow. */
export function ScrollSection({
  children,
  className,
  flowStrength = 26,
  lean = 0,
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
  // An arc rather than a rail: in from one side, through the centre while it
  // is being read, and out toward the other. On a phone 34px is a tenth of
  // the screen, so the arc stays but the swing shrinks.
  const narrow = !useMediaQuery("(min-width: 48rem)");
  const swing = narrow ? 0.3 : 1;
  const x = useTransform(
    progress,
    [0, 0.3, 0.5, 0.75, 1],
    [lean * 34, lean * 6, 0, lean * -4, lean * -22].map((v) => v * swing),
  );
  // A slight lean back as it rises into view, like paper over a curved desk.
  const rotateX = useTransform(progress, [0, 0.32, 0.5, 1], [7, 1.2, 0, -3]);
  const hasScrollMotion = mounted && !reduced && nearby;

  return (
    <motion.section
      ref={sectionRef}
      data-scroll-section
      className={cn("scroll-flow-section", className)}
      style={{
        ...style,
        ...(hasScrollMotion
          ? lean === 0
            ? { y, opacity }
            : { y, x, opacity, rotateX, transformPerspective: 1600 }
          : {}),
      }}
      {...props}
    >
      {children}
    </motion.section>
  );
}
