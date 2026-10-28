import type { CSSProperties } from "react";
import Image from "next/image";
import { ArrowUpRight, Braces, Code, Coffee } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TransitionLink } from "@/components/ui/transition-link";
import { DecisionFlip } from "@/components/sections/decision-flip";
import { ServiceLine } from "@/components/sections/status-board";
import { GitHubIcon } from "@/components/icons";
import { Kinetic } from "@/components/motion/kinetic";
import type { LocalizedProject } from "@/lib/projects";
import type { ServiceStatus } from "@/lib/status";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { fill } from "@/lib/i18n/format";
import { projectPath } from "@/lib/i18n/routes";
import { projectCoverName, projectTitleName } from "@/lib/view-transition";
import { cn } from "@/lib/utils";

/** Glyph for covers of projects without screenshot (rodam no console/IDE). */
function coverGlyph(stack: string[]) {
  const glyphClass = "text-signal/60 size-12";
  if (stack.includes("Java"))
    return <Coffee aria-hidden className={glyphClass} strokeWidth={1.25} />;
  if (stack.includes("JavaScript"))
    return <Braces aria-hidden className={glyphClass} strokeWidth={1.25} />;
  return <Code aria-hidden className={glyphClass} strokeWidth={1.25} />;
}

/**
 * Wide card with the "card link" pattern: the title link stretches over the
 * whole card (::after inset-0); the secondary links and the decision sit
 * above via relative z-10.
 *
 * It leads with the case study's first decision rather than a feature list:
 * stacks and features read the same in every portfolio, what was given up
 * for them does not. The cover stays monochrome until hovered where there is
 * hover; on touch screens, which never hover, it is in colour from the start.
 *
 * The cover and the title carry `view-transition-name`s that the case study
 * header repeats, so navigating morphs this card into that page instead of
 * cutting to it. Names are per-slug, which keeps them unique in both documents.
 *
 * Dealt in as a scene (`variant="card"` on its wrapper): the cover opens,
 * the title's words come up, then the rest in the order marked `data-part`
 * / `--at`. In the stack, `.stack-shade` is what darkens it as the next
 * card slides over.
 */
export function ProjectCard({
  project,
  locale,
  dict,
  flip = false,
  status,
}: {
  project: LocalizedProject;
  locale: Locale;
  dict: Dictionary;
  /** Puts the cover on the right from md up (alternating rows). */
  flip?: boolean;
  /** What the status board saw: demo answer and last commit. */
  status?: ServiceStatus;
}) {
  const href = projectPath(locale, project.slug);
  const coverAlt =
    project.coverAlt ?? fill(dict.projects.coverAlt, { title: project.title });
  const lead = project.decisions[0];
  const at = (seconds: number) => ({ "--at": `${seconds}s` }) as CSSProperties;

  return (
    <article
      className={cn(
        "project-card group border-ash/60 bg-basalt/80 hover:border-signal/40 hover:glow-signal relative grid gap-6 rounded-lg border p-6 transition-colors duration-200 md:p-7",
        flip
          ? "project-card--flip md:grid-cols-[1fr_minmax(0,20rem)]"
          : "md:grid-cols-[minmax(0,20rem)_1fr]",
      )}
    >
      <div
        className={cn(
          "project-card__cover border-ash/70 relative aspect-[16/10] overflow-hidden rounded-md border",
          flip && "md:order-2",
        )}
        style={{ viewTransitionName: projectCoverName(project.slug) }}
      >
        {project.cover ? (
          <Image
            src={project.cover}
            alt={coverAlt}
            fill
            sizes="(min-width: 768px) 20rem, 100vw"
            className="project-card__cover-img scale-[1.1] object-cover object-top transition duration-300 group-hover:scale-[1.14] group-hover:grayscale-0 [@media(hover:hover)]:grayscale"
          />
        ) : (
          <div
            className="absolute inset-0 grid place-items-center transition-transform duration-300 group-hover:scale-[1.03]"
            style={{
              background:
                "radial-gradient(circle at 30% 25%, color-mix(in oklab, var(--color-signal) 12%, transparent), transparent 60%), linear-gradient(160deg, var(--color-basalt), var(--color-abyss))",
            }}
          >
            {coverGlyph(project.stack)}
          </div>
        )}
        {project.cover ? null : (
          <span className="text-smoke absolute bottom-3 left-3 font-mono text-xs">
            {project.slug}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div
          data-part
          className="flex flex-wrap items-center gap-x-3 gap-y-1.5"
          style={at(0.2)}
        >
          <Badge
            variant={
              project.status === "in-progress"
                ? "pending"
                : project.status === "shipped"
                  ? "ok"
                  : "default"
            }
          >
            {dict.projects.statuses[project.status]}
          </Badge>
          {status ? (
            <ServiceLine status={status} locale={locale} dict={dict} />
          ) : null}
        </div>

        <h3
          className="font-display text-h3 text-bone"
          style={{ viewTransitionName: projectTitleName(project.slug) }}
        >
          <TransitionLink href={href} className="after:absolute after:inset-0">
            <Kinetic text={project.title} />
          </TransitionLink>
        </h3>

        <p data-part className="text-smoke text-sm" style={at(0.38)}>
          {project.problem}
        </p>

        {lead ? (
          <div data-part style={at(0.48)}>
            <DecisionFlip
              slug={project.slug}
              decision={lead}
              total={project.decisions.length}
              locale={locale}
              dict={dict}
            />
          </div>
        ) : null}

        <div data-part className="mt-1 flex flex-wrap gap-2" style={at(0.6)}>
          {project.stack.map((tech) => (
            <Badge key={tech}>{tech}</Badge>
          ))}
        </div>

        <div
          data-part
          className="relative z-10 mt-2 flex items-center gap-4 text-sm"
          style={at(0.68)}
        >
          <TransitionLink
            href={href}
            className="link-underline text-signal hover:bg-[length:100%_1px]"
          >
            {dict.projects.caseStudy}
          </TransitionLink>
          {project.repo ? (
            <a
              href={project.repo}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={fill(dict.projects.repoAria, {
                title: project.title,
              })}
              className="text-smoke hover:text-bone transition-colors"
            >
              <GitHubIcon className="size-[18px]" />
            </a>
          ) : null}
          {project.demo ? (
            <a
              href={project.demo}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={fill(dict.projects.demoAria, {
                title: project.title,
              })}
              className="text-smoke hover:text-bone transition-colors"
            >
              <ArrowUpRight size={18} strokeWidth={1.5} />
            </a>
          ) : null}
        </div>
      </div>
      <span aria-hidden className="stack-shade" />
    </article>
  );
}
