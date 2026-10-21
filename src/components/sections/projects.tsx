import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal } from "@/components/ui/reveal";
import { ProjectCard } from "@/components/sections/project-card";
import { SmoothLink } from "@/components/ui/smooth-link";
import { localizedProjects } from "@/lib/projects";
import { ScrollSection } from "@/components/layout/scroll-flow";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function Projects({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const projects = localizedProjects(locale);

  return (
    <ScrollSection
      lean={1}
      id="projetos"
      className="container-hades section-pad scroll-mt-24"
      flowStrength={18}
    >
      <SectionHeading
        eyebrow={dict.projects.eyebrow}
        title={dict.projects.title}
        description={dict.projects.description}
      />

      {/* A zigzag instead of a column: on large screens each card leans to
          one side and swaps its cover to the outer edge, so the eye travels
          left-right down the list like the thread does. */}
      <div className="mt-10 flex flex-col gap-6 lg:gap-10">
        {projects.map((project, index) => {
          const flip = index % 2 === 1;
          return (
            <Reveal
              key={project.slug}
              from={flip ? "right" : "left"}
              delay={0.04}
              className={
                flip ? "lg:ml-auto lg:w-[88%]" : "lg:mr-auto lg:w-[88%]"
              }
            >
              <ProjectCard
                project={project}
                locale={locale}
                dict={dict}
                flip={flip}
              />
            </Reveal>
          );
        })}
      </div>

      <div className="mt-8">
        <SmoothLink
          href="#github"
          data-cursor="hover"
          className="link-underline text-smoke text-sm hover:bg-[length:100%_1px]"
        >
          {dict.projects.moreOnGithub}
        </SmoothLink>
      </div>
    </ScrollSection>
  );
}
