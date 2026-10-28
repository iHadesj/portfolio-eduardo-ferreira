import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal } from "@/components/ui/reveal";
import { ProjectCard } from "@/components/sections/project-card";
import { TransitionLink } from "@/components/ui/transition-link";
import { localizedProjects } from "@/lib/projects";
import { projectStatuses } from "@/lib/status";
import { siteConfig } from "@/lib/site-config";
import { ScrollSection } from "@/components/layout/scroll-flow";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { projectPath } from "@/lib/i18n/routes";
import { fill } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";

/**
 * How many case studies get a full card. The rest are listed one per line:
 * on a phone ten full cards were most of the page's height (and DOM), and a
 * recruiter decides on the first few anyway.
 */
const FULL_CARDS = 4;

export async function Projects({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const projects = localizedProjects(locale);
  const statuses = await projectStatuses();
  const featured = projects.slice(0, FULL_CARDS);
  const rest = projects.slice(FULL_CARDS);
  const decisions = projects.reduce(
    (sum, project) => sum + project.decisions.length,
    0,
  );

  return (
    <ScrollSection
      id="projetos"
      className="container-hades section-pad scroll-mt-24"
      flowStrength={18}
    >
      <SectionHeading
        eyebrow={dict.projects.eyebrow}
        title={dict.projects.title}
        description={fill(dict.projects.description, {
          decisions,
          projects: projects.length,
        })}
      />

      {/* A zigzag instead of a column: on large screens each card leans to
          one side and swaps its cover to the outer edge, so the eye travels
          left-right down the list like the thread does. */}
      <div className="mt-10 flex flex-col gap-6 lg:gap-10">
        {featured.map((project, index) => {
          const flip = index % 2 === 1;
          return (
            <Reveal
              key={project.slug}
              className={cn(
                "reveal--card",
                flip ? "lg:ml-auto lg:w-[88%]" : "lg:mr-auto lg:w-[88%]",
              )}
            >
              <ProjectCard
                project={project}
                locale={locale}
                dict={dict}
                flip={flip}
                status={statuses[project.slug]}
              />
            </Reveal>
          );
        })}
      </div>

      {rest.length > 0 ? (
        <Reveal className="mt-12">
          <p className="text-smoke font-mono text-sm">
            {`${dict.projects.indexLabel}/`}
          </p>
          <ul className="project-index">
            {rest.map((project) => (
              <li key={project.slug}>
                <TransitionLink href={projectPath(locale, project.slug)}>
                  <span className="project-index__title">{project.title}</span>
                  <span className="project-index__summary">
                    {project.summary}
                  </span>
                  {project.decisions[0] ? (
                    <span className="project-index__decision">
                      {project.decisions[0].choice}
                    </span>
                  ) : null}
                  <span className="project-index__status">
                    {dict.projects.statuses[project.status]}
                  </span>
                </TransitionLink>
              </li>
            ))}
          </ul>
        </Reveal>
      ) : null}

      <div className="mt-8">
        <a
          href={siteConfig.links.github}
          target="_blank"
          rel="noopener noreferrer"
          className="link-underline text-smoke text-sm hover:bg-[length:100%_1px]"
        >
          {dict.projects.moreOnGithub}
        </a>
      </div>
    </ScrollSection>
  );
}
