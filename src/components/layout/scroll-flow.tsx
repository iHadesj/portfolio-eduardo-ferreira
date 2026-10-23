import type { CSSProperties } from "react";
import { ScrollThread } from "@/components/layout/scroll-thread";
import { cn } from "@/lib/utils";

interface ScrollFlowProps {
  children: React.ReactNode;
  id?: string;
  className?: string;
}

/**
 * Gives the home page one continuous, scroll-linked visual rhythm. The content
 * remains regular document flow; the thread that doubles as the progress
 * indicator is absolutely positioned behind the sections, so anchors,
 * keyboard navigation and native layout keep working.
 *
 * Everything here is CSS driven by scroll timelines (see `.scroll-flow-*` in
 * globals.css): it runs on the compositor, ships no JavaScript and needs no
 * hydration. Only the thread is a client component, and only on md+.
 */
export function ScrollFlow({ children, id, className }: ScrollFlowProps) {
  return (
    <main
      id={id}
      data-scroll-flow
      className={cn("relative isolate overflow-clip", className)}
    >
      {/* Phones keep a hairline progress bar; from md up the thread itself
          shows how far down the page the reader is. */}
      <div aria-hidden className="scroll-flow-progress md:hidden" />

      <div className="relative z-[2]">
        <ScrollThread />
        {children}
      </div>
    </main>
  );
}

interface ScrollSectionProps extends React.ComponentProps<"section"> {
  /** Maximum vertical drift, in pixels, across the section's viewport pass. */
  flowStrength?: number;
}

/**
 * A section that eases into and out of the viewport without leaving flow:
 * a slight rise and fade on every screen, plus — from md up — an arc in from
 * one side and a lean back like paper over a curved desk. Sides alternate by
 * position in the page, so the descent zigzags with the thread whatever the
 * section order.
 */
export function ScrollSection({
  className,
  flowStrength = 26,
  style,
  ...props
}: ScrollSectionProps) {
  return (
    <section
      data-scroll-section
      className={cn("scroll-flow-section", className)}
      style={{ "--flow": `${flowStrength}px`, ...style } as CSSProperties}
      {...props}
    />
  );
}
