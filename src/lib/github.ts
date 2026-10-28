import { env } from "@/lib/env";

export interface ContributionDay {
  date: string;
  count: number;
  level: number;
}

export interface ContributionsData {
  total: number;
  days: ContributionDay[];
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
