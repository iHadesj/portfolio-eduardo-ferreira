import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { Reveal } from "@/components/ui/reveal";
import { Kinetic } from "@/components/motion/kinetic";

interface SectionHeadingProps {
  /** Eyebrow label WITHOUT the `~/` prefix — the component renders it as a
   *  path, the way the section would sit in a home directory. */
  eyebrow: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: "left" | "center";
  className?: string;
  /** Heading level for correct document outline (default h2). */
  as?: "h2" | "h3";
}

/**
 * Every section opens the same way, as one short sequence: the ring pops,
 * the path is typed out, the title's words come up from under the line and
 * a rule draws beneath them, then the description settles.
 */
export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  className,
  as: Heading = "h2",
}: SectionHeadingProps) {
  const path = `~/${eyebrow}`;

  return (
    <Reveal
      variant="heading"
      className={cn(
        "flex flex-col gap-3",
        align === "center" && "items-center text-center",
        className,
      )}
    >
      <p className="text-label text-smoke font-mono lowercase">
        <span aria-hidden className="section-mark" />
        <span
          className="type-in"
          style={{ "--n": path.length } as CSSProperties}
        >
          {path}
        </span>
      </p>
      <Heading
        className={cn(
          "font-display text-bone",
          Heading === "h2" ? "text-h2" : "text-h3",
        )}
      >
        {typeof title === "string" ? <Kinetic text={title} /> : title}
      </Heading>
      <span aria-hidden className="heading-rule" />
      {description ? (
        <p
          data-part
          className="prose-measure font-body text-lead text-smoke"
          style={{ "--at": "0.5s" } as CSSProperties}
        >
          {description}
        </p>
      ) : null}
    </Reveal>
  );
}
