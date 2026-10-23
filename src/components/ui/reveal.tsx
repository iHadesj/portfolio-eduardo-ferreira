import { cn } from "@/lib/utils";

/**
 * Scroll-into-view reveal, as pure CSS (`.reveal` in globals.css): a short,
 * dry rise driven by `animation-timeline: view()`, so it runs on the
 * compositor and ships no JavaScript. Browsers without scroll-driven
 * animations, and reduced motion, simply show the content.
 *
 * It used to be a Motion component with a blur-in: on a 3× phone screen the
 * animated `filter: blur()` on two dozen blocks was the single most expensive
 * thing the page painted.
 */
export function Reveal({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("reveal", className)} {...props} />;
}
