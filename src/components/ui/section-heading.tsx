import { cn } from "@/lib/utils";
import { Reveal } from "@/components/ui/reveal";

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

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  className,
  as: Heading = "h2",
}: SectionHeadingProps) {
  return (
    <Reveal
      className={cn(
        "flex flex-col gap-3",
        align === "center" && "items-center text-center",
        className,
      )}
    >
      <p className="text-label text-smoke font-mono lowercase">
        {`~/${eyebrow}`}
      </p>
      <Heading
        className={cn(
          "font-display text-bone",
          Heading === "h2" ? "text-h2" : "text-h3",
        )}
      >
        {title}
      </Heading>
      {description ? (
        <p className="prose-measure font-body text-lead text-smoke">
          {description}
        </p>
      ) : null}
    </Reveal>
  );
}
