import { projects as raw, type Project } from "#site/content";
import { defaultLocale, type Locale } from "@/lib/i18n/config";

export type { Project };

export type Decision = Project["decisions"][number];
export type Metric = Project["metrics"][number];
export type ProjectStatus = Project["status"];

/** Case studies sorted by `order` (Levva → StudyQuest → LIFE/MAINTENANCE → Um abraço, Bernardo → Raiz Pilates → Rota Dev → API → DevTrack → Portfolio → Change). */
export const projects: Project[] = [...raw].sort((a, b) => a.order - b.order);

export function getProject(slug: string): Project | undefined {
  return projects.find((project) => project.slug === slug);
}

/**
 * A case study with one locale already resolved — the only shape components
 * should see. Everything that has an `en` translation is swapped; everything
 * else (dates, stack names, links, the MDX body) is locale-independent or
 * intentionally left in Portuguese.
 */
export interface LocalizedProject {
  slug: string;
  title: string;
  summary: string;
  problem: string;
  cover?: string;
  coverAlt?: string;
  date: string;
  stack: string[];
  repo?: string;
  demo?: string;
  status: ProjectStatus;
  highlights: string[];
  metrics: Metric[];
  decisions: Decision[];
  content: string;
  /**
   * False when the long-form MDX body is not available in `locale` — the page
   * shows `projectPage.translationNotice` above it. The scannable half
   * (summary, highlights, metrics, decision log) is always translated.
   */
  bodyMatchesLocale: boolean;
}

export function localizeProject(
  project: Project,
  locale: Locale,
): LocalizedProject {
  // PT is the authoring locale: the top-level fields already are the
  // translation. Any other locale reads its overrides, falling back per-field
  // so a partially translated file still renders instead of breaking.
  const t = locale === defaultLocale ? undefined : project.en;

  return {
    slug: project.slug,
    title: t?.title ?? project.title,
    summary: t?.summary ?? project.summary,
    problem: t?.problem ?? project.problem,
    cover: project.cover,
    coverAlt: t?.coverAlt ?? project.coverAlt,
    date: project.date,
    stack: project.stack,
    repo: project.repo,
    demo: project.demo,
    status: project.status,
    highlights: t?.highlights?.length ? t.highlights : project.highlights,
    metrics: t?.metrics?.length ? t.metrics : project.metrics,
    decisions: t?.decisions?.length ? t.decisions : project.decisions,
    content: project.content,
    bodyMatchesLocale: locale === defaultLocale,
  };
}

export function localizedProjects(locale: Locale): LocalizedProject[] {
  return projects.map((project) => localizeProject(project, locale));
}
