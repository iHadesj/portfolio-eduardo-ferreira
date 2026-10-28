import { ScrollThread } from "@/components/layout/scroll-thread";
import { cn } from "@/lib/utils";

interface ScrollFlowProps {
  children: React.ReactNode;
  id?: string;
  className?: string;
}

/**
 * Gives the home page one continuous visual rhythm. The content remains
 * regular document flow; the thread is absolutely positioned behind the
 * sections, so anchors, keyboard navigation and native layout keep working.
 * (Reading progress lives on the status line's top edge.) Only the thread
 * is a client component, and only on md+; the sections' motion is the
 * director's (components/motion).
 */
export function ScrollFlow({ children, id, className }: ScrollFlowProps) {
  return (
    <main
      id={id}
      data-scroll-flow
      className={cn("relative isolate overflow-clip", className)}
    >
      <div className="relative z-[2]">
        <ScrollThread />
        {children}
      </div>
    </main>
  );
}

/**
 * A home page section: what the thread finds and weaves between
 * (`data-scroll-section`).
 */
export function ScrollSection({
  className,
  ...props
}: React.ComponentProps<"section">) {
  return (
    <section
      data-scroll-section
      className={cn("scroll-flow-section", className)}
      {...props}
    />
  );
}
