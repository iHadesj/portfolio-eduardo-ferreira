import { defineConfig, defineCollection, s } from "velite";

/**
 * One entry of the decision log — the structured half of a case study.
 *
 * Prose already explains *what* was built; these four fields force the part
 * that actually separates portfolios: the alternative that was dropped and the
 * price the choice carried. `instead` and `cost` are optional because a few
 * decisions genuinely have no rival or no downside — but leaving them empty is
 * a visible gap in the rendered log, which is the point.
 */
/**
 * The lines a decision comes down to, quoted verbatim from the project's own
 * repository: the proof under the claim. `mark` holds the 1-based lines that
 * carry the decision; `url` points at them on GitHub. Code reads the same in
 * every language, so only the PT entry carries it (see `lib/projects.ts`).
 */
const snippet = s.object({
  file: s.string(),
  url: s.string().url(),
  lang: s.string(),
  mark: s.array(s.number()).default([]),
  code: s.string(),
});

const decision = s.object({
  choice: s.string(),
  instead: s.string().optional(),
  because: s.string(),
  cost: s.string().optional(),
  snippet: snippet.optional(),
});

const metric = s.object({ label: s.string(), value: s.string() });

/**
 * Case studies. Frontmatter is validated by this schema at build time — an
 * invalid file fails the build with a readable error (§F5 acceptance).
 *
 * `en` carries the scannable half of the study (title, summary, highlights,
 * metrics, decision log) so the English page is complete above the fold. The
 * long-form MDX body stays Portuguese; `projectPage.translationNotice` says so
 * on the page. Merging happens in `lib/projects.ts`, never in components.
 */
const projects = defineCollection({
  name: "Project",
  pattern: "projects/**/*.mdx",
  schema: s
    .object({
      title: s.string(),
      slug: s.slug("projects"),
      summary: s.string().max(200),
      problem: s.string(),
      date: s.isodate(),
      cover: s.string().optional(),
      coverAlt: s.string().optional(),
      stack: s.array(s.string()),
      repo: s.string().url().optional(),
      demo: s.string().url().optional(),
      featured: s.boolean().default(false),
      order: s.number().default(99),
      highlights: s.array(s.string()).max(4).default([]),
      metrics: s.array(metric).default([]),
      decisions: s.array(decision).max(6).default([]),
      status: s.enum(["shipped", "in-progress", "archived"]),
      en: s
        .object({
          title: s.string(),
          summary: s.string().max(200),
          problem: s.string(),
          coverAlt: s.string().optional(),
          highlights: s.array(s.string()).max(4).default([]),
          metrics: s.array(metric).default([]),
          decisions: s.array(decision).max(6).default([]),
        })
        .optional(),
      content: s.mdx(),
    })
    .transform((data) => ({ ...data, url: `/projetos/${data.slug}` })),
});

export default defineConfig({
  root: "content",
  output: {
    data: ".velite",
    assets: "public/static",
    base: "/static/",
    name: "[name]-[hash:6].[ext]",
    clean: true,
  },
  collections: { projects },
});
