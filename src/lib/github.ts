import { env } from "@/lib/env";

export interface RepoDTO {
  name: string;
  description: string | null;
  url: string;
  stars: number;
  forks: number;
  language: string | null;
  topics: string[];
  pushedAt: string;
}

export interface ReposPage {
  items: RepoDTO[];
  nextPage: number | null;
}

/** Janela "recente" do feed: 18 meses (1 ano e meio) desde o último push. */
export const RECENT_WINDOW_MONTHS = 18;

/**
 * ISO do limite da janela recente. Calculado no servidor e passado ao feed como
 * prop: o corte decide *quais* cards existem, então prerender e hidratação
 * precisam do mesmo valor. `now` é injetável para testes.
 */
export function recentWindowCutoff(now: Date = new Date()): string {
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - RECENT_WINDOW_MONTHS);
  return cutoff.toISOString();
}

export interface ContributionDay {
  date: string;
  count: number;
  level: number;
}

export interface ContributionsData {
  total: number;
  days: ContributionDay[];
}

interface GitHubRepo {
  name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  topics?: string[];
  pushed_at: string;
  fork: boolean;
  archived: boolean;
}

function mapRepo(repo: GitHubRepo): RepoDTO {
  return {
    name: repo.name,
    description: repo.description,
    url: repo.html_url,
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    language: repo.language,
    topics: repo.topics ?? [],
    pushedAt: repo.pushed_at,
  };
}

/**
 * Paginated repos, sorted by last push. Sends the token only if present
 * (without it: 60 req/h per IP — enough thanks to 1h caching). Throws on an
 * upstream error so the route can answer 502 and the client can show its error
 * state; the RSC initial fetch wraps this in try/catch.
 */
export async function fetchRepos(page = 1, perPage = 9): Promise<ReposPage> {
  const url = `https://api.github.com/users/${env.GITHUB_USERNAME}/repos?sort=pushed&per_page=${perPage}&page=${page}`;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
  };
  if (env.GITHUB_TOKEN) headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;

  const res = await fetch(url, { headers, next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`GitHub repos responded ${res.status}`);

  const data = (await res.json()) as GitHubRepo[];
  const items = data.filter((r) => !r.fork && !r.archived).map(mapRepo);
  const nextPage = data.length === perPage ? page + 1 : null;
  return { items, nextPage };
}

/** Contributions heatmap via a community API. Returns null on any failure so
 *  the UI can simply hide the heatmap. */
export async function fetchContributions(
  username = env.GITHUB_USERNAME,
): Promise<ContributionsData | null> {
  try {
    const res = await fetch(
      `https://github-contributions-api.jogruber.de/v4/${username}?y=last`,
      { next: { revalidate: 21600 } },
    );
    if (!res.ok) throw new Error(`contributions responded ${res.status}`);
    const data = (await res.json()) as { contributions: ContributionDay[] };
    const days = data.contributions ?? [];
    const total = days.reduce((sum, day) => sum + day.count, 0);
    return { total, days };
  } catch (error) {
    console.error("[github] fetchContributions:", error);
    return null;
  }
}
