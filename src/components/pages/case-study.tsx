import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, ArrowUpRight, Languages } from "lucide-react";
import { getProject, localizeProject, localizedProjects } from "@/lib/projects";
import { MDXContent } from "@/components/mdx/mdx-content";
import { DecisionLog } from "@/components/sections/decision-log";
import { Badge } from "@/components/ui/badge";
import { GitHubIcon } from "@/components/icons";
import { htmlLang, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { fill } from "@/lib/i18n/format";
import { localePath, projectPath } from "@/lib/i18n/routes";
import { projectCoverName, projectTitleName } from "@/lib/view-transition";

const proseClass = [
  "prose prose-invert max-w-[68ch]",
  "prose-headings:font-display prose-headings:text-bone",
  "prose-h2:text-h3 prose-h2:mt-12 prose-h2:mb-3",
  "prose-p:text-smoke prose-li:text-smoke prose-strong:text-bone",
  "prose-a:text-molten prose-a:no-underline hover:prose-a:underline",
  "prose-code:text-styx prose-code:font-mono prose-code:before:content-none prose-code:after:content-none",
  "prose-blockquote:border-l-molten prose-blockquote:text-smoke prose-blockquote:not-italic",
].join(" ");

export function CaseStudyPage({
  locale,
  slug,
}: {
  locale: Locale;
  slug: string;
}) {
  const source = getProject(slug);
  if (!source) notFound();

  const project = localizeProject(source, locale);
  const dict = getDictionary(locale);
  const t = dict.projectPage;

  // Siblings are read in the active locale so prev/next show translated titles.
  const siblings = localizedProjects(locale);
  const index = siblings.findIndex((item) => item.slug === slug);
  const previous = index > 0 ? siblings[index - 1] : undefined;
  const next = index < siblings.length - 1 ? siblings[index + 1] : undefined;

  const coverAlt =
    project.coverAlt ?? fill(dict.projects.coverAlt, { title: project.title });
  const showTranslationNotice =
    !project.bodyMatchesLocale && t.translationNotice.length > 0;

  return (
    <main id="conteudo" className="container-hades section-pad">
      <Link
        href={localePath(locale, "/#projetos")}
        data-cursor="hover"
        className="text-smoke hover:text-molten mb-10 inline-flex items-center gap-2 text-sm transition-colors"
      >
        <ArrowLeft size={16} strokeWidth={1.5} /> {t.back}
      </Link>

      <header className="border-ash flex flex-col gap-5 border-b pb-10">
        <Badge
          variant={project.status === "in-progress" ? "ember" : "default"}
          className="self-start"
        >
          {dict.projects.statuses[project.status]}
        </Badge>
        {/* Paired with the card that was clicked — the browser morphs one into
            the other instead of cutting between pages. */}
        <h1
          className="font-display text-hero text-bone"
          style={{ viewTransitionName: projectTitleName(slug) }}
        >
          {project.title}
        </h1>
        <p className="prose-measure text-lead text-smoke">{project.summary}</p>

        {project.metrics.length > 0 ? (
          <dl className="flex flex-wrap gap-3">
            {project.metrics.map((metric) => (
              <div
                key={metric.label}
                className="border-ash bg-basalt rounded-md border px-4 py-3"
              >
                <dt className="text-label text-smoke font-mono uppercase">
                  {metric.label}
                </dt>
                <dd className="font-display text-bone text-lg">
                  {metric.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}

        <div className="flex flex-wrap items-center gap-4 text-sm">
          {project.repo ? (
            <a
              href={project.repo}
              target="_blank"
              rel="noopener noreferrer"
              data-cursor="hover"
              className="text-smoke hover:text-bone inline-flex items-center gap-1.5 transition-colors"
            >
              <GitHubIcon className="size-[18px]" /> {t.repo}
            </a>
          ) : null}
          {project.demo ? (
            <a
              href={project.demo}
              target="_blank"
              rel="noopener noreferrer"
              data-cursor="hover"
              className="text-smoke hover:text-bone inline-flex items-center gap-1.5 transition-colors"
            >
              <ArrowUpRight size={16} strokeWidth={1.5} /> {t.demo}
            </a>
          ) : null}
        </div>
      </header>

      {project.cover ? (
        <div
          className="border-ash relative mt-10 aspect-[16/9] overflow-hidden rounded-lg border"
          style={{ viewTransitionName: projectCoverName(slug) }}
        >
          <Image
            src={project.cover}
            alt={coverAlt}
            fill
            priority
            sizes="(min-width: 1024px) 60rem, 100vw"
            className="object-cover object-top"
          />
        </div>
      ) : null}

      <DecisionLog decisions={project.decisions} dict={dict} />

      {showTranslationNotice ? (
        <p className="border-ash bg-basalt text-smoke mt-16 flex items-start gap-3 rounded-md border border-dashed p-4 text-sm">
          <Languages
            aria-hidden
            size={18}
            strokeWidth={1.5}
            className="text-molten mt-0.5 shrink-0"
          />
          {t.translationNotice}
        </p>
      ) : null}

      {/* The long-form body is authored in Portuguese in every locale. */}
      <article className={`mt-10 ${proseClass}`} lang={htmlLang.pt}>
        <MDXContent code={project.content} />
      </article>

      <nav className="border-ash mt-16 flex justify-between gap-4 border-t pt-8 text-sm">
        {previous ? (
          <Link
            href={projectPath(locale, previous.slug)}
            data-cursor="hover"
            className="text-smoke hover:text-molten inline-flex items-center gap-2 transition-colors"
          >
            <ArrowLeft size={16} strokeWidth={1.5} /> {previous.title}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link
            href={projectPath(locale, next.slug)}
            data-cursor="hover"
            className="text-smoke hover:text-molten inline-flex items-center gap-2 text-right transition-colors"
          >
            {next.title} <ArrowRight size={16} strokeWidth={1.5} />
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </main>
  );
}
