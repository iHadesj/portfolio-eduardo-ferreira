import Image from "next/image";
import { ArrowUpRight, Braces, Code, Coffee } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TransitionLink } from "@/components/ui/transition-link";
import { GitHubIcon } from "@/components/icons";
import type { LocalizedProject } from "@/lib/projects";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { fill } from "@/lib/i18n/format";
import { projectPath } from "@/lib/i18n/routes";
import { projectCoverName, projectTitleName } from "@/lib/view-transition";
import { cn } from "@/lib/utils";

/** Glyph for covers of projects without screenshot (rodam no console/IDE). */
function coverGlyph(stack: string[]) {
  const glyphClass = "text-molten/60 size-12";
  if (stack.includes("Java"))
    return <Coffee aria-hidden className={glyphClass} strokeWidth={1.25} />;
  if (stack.includes("JavaScript"))
    return <Braces aria-hidden className={glyphClass} strokeWidth={1.25} />;
  return <Code aria-hidden className={glyphClass} strokeWidth={1.25} />;
}

/**
 * Wide card with the "card link" pattern: the title link stretches over the
 * whole card (::after inset-0); the secondary links sit above via relative z-10.
 *
 * The cover and the title carry `view-transition-name`s that the case study
 * header repeats, so navigating morphs this card into that page instead of
 * cutting to it. Names are per-slug, which keeps them unique in both documents.
 */
export function ProjectCard({
  project,
  locale,
  dict,
  flip = false,
}: {
  project: LocalizedProject;
  locale: Locale;
  dict: Dictionary;
  /** Puts the cover on the right from md up (alternating rows). */
  flip?: boolean;
}) {
  const href = projectPath(locale, project.slug);
  const coverAlt =
    project.coverAlt ?? fill(dict.projects.coverAlt, { title: project.title });

  return (
    <article
      className={cn(
        "project-card group border-ash bg-basalt hover:border-molten/40 hover:glow-molten relative grid gap-6 border p-5 transition-colors duration-200 md:p-6",
        flip
          ? "project-card--flip md:grid-cols-[1fr_minmax(0,20rem)]"
          : "md:grid-cols-[minmax(0,20rem)_1fr]",
      )}
    >
      <div
        className={cn(
          "border-ash/70 relative aspect-[16/10] overflow-hidden rounded-md border",
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
            className="object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div
            className="absolute inset-0 grid place-items-center transition-transform duration-300 group-hover:scale-[1.03]"
            style={{
              background:
                "radial-gradient(circle at 30% 25%, color-mix(in oklab, var(--color-molten) 16%, transparent), transparent 60%), linear-gradient(160deg, #1b1622, #0f0b15)",
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
        <Badge
          variant={project.status === "in-progress" ? "ember" : "default"}
          className="self-start"
        >
          {dict.projects.statuses[project.status]}
        </Badge>

        <h3
          className="font-display text-h3 text-bone"
          style={{ viewTransitionName: projectTitleName(project.slug) }}
        >
          <TransitionLink
            href={href}
            data-cursor="hover"
            className="after:absolute after:inset-0"
          >
            {project.title}
          </TransitionLink>
        </h3>

        <p className="text-smoke text-sm">{project.problem}</p>

        <ul className="text-smoke flex flex-col gap-1.5 text-sm">
          {project.highlights.map((highlight) => (
            <li key={highlight} className="flex gap-2">
              <span aria-hidden className="text-molten">
                →
              </span>
              <span>{highlight}</span>
            </li>
          ))}
        </ul>

        <div className="mt-1 flex flex-wrap gap-2">
          {project.stack.map((tech) => (
            <Badge key={tech}>{tech}</Badge>
          ))}
        </div>

        <div className="relative z-10 mt-2 flex items-center gap-4 text-sm">
          <TransitionLink
            href={href}
            data-cursor="hover"
            className="link-underline text-molten hover:bg-[length:100%_1px]"
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
              data-cursor="hover"
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
              data-cursor="hover"
              className="text-smoke hover:text-bone transition-colors"
            >
              <ArrowUpRight size={18} strokeWidth={1.5} />
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}
