import { cache } from "react";
import { request } from "node:https";
import { env } from "@/lib/env";
import { projects } from "@/lib/projects";

/**
 * Live status of every case study: does its demo answer, how fast, and when
 * its repository last moved. The badge on a card says "shipped"; this says
 * whether it is up right now.
 *
 * The probe uses `node:https` on purpose: Next does not see it, so it neither
 * lands in the Data Cache (a cached HEAD would time a cache read, not the
 * site) nor turns the page dynamic. It runs whenever the page renders — at
 * build and on every ISR regeneration (the home routes revalidate every 10
 * minutes) — so the numbers on the page are at most that old. Commits come
 * from the GitHub API through the Data Cache, hourly, which keeps the token-
 * less rate limit out of reach.
 */

export type ServiceState = "up" | "down" | "none";

export interface ServiceCommit {
  /** First line of the commit message. */
  message: string;
  date: string;
  url: string;
}

export interface ServiceStatus {
  state: ServiceState;
  /** HTTP status the demo answered with; null when it has none or timed out. */
  http: number | null;
  /** Server → demo round trip, in ms. */
  ms: number | null;
  commit: ServiceCommit | null;
}

const PROBE_TIMEOUT = 4000;

interface Probe {
  http: number;
  ms: number;
}

function probe(url: string): Promise<Probe | null> {
  return new Promise((resolve) => {
    const started = performance.now();
    let settled = false;
    const done = (value: Probe | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    try {
      const req = request(
        url,
        {
          method: "HEAD",
          timeout: PROBE_TIMEOUT,
          headers: { "user-agent": "edu-ferreira-status/1.0" },
        },
        (res) => {
          done({
            http: res.statusCode ?? 0,
            ms: Math.round(performance.now() - started),
          });
          res.resume();
        },
      );
      req.on("timeout", () => {
        req.destroy();
        done(null);
      });
      req.on("error", () => done(null));
      req.end();
    } catch {
      done(null);
    }
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function lastCommit(repo: string): Promise<ServiceCommit | null> {
  const match = /github\.com\/([^/]+)\/([^/#?]+)/.exec(repo);
  if (!match) return null;
  const [, owner, name] = match;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
  };
  if (env.GITHUB_TOKEN) headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;

  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${name}/commits?per_page=1`,
      { headers, next: { revalidate: 3600 } },
    );
    if (!res.ok) return null;
    const data: unknown = await res.json();
    const first: unknown = Array.isArray(data) ? data[0] : undefined;
    if (!isRecord(first) || !isRecord(first.commit)) return null;
    const { message } = first.commit;
    const committer = first.commit.committer;
    const date = isRecord(committer) ? committer.date : undefined;
    if (
      typeof message !== "string" ||
      typeof date !== "string" ||
      typeof first.html_url !== "string"
    ) {
      return null;
    }
    return {
      message: message.split("\n")[0] ?? message,
      date,
      url: first.html_url,
    };
  } catch {
    return null;
  }
}

/**
 * Every case study's status, keyed by slug. Memoised per render, so the
 * project cards and the status board share one round of probes.
 */
export const projectStatuses = cache(
  async (): Promise<Record<string, ServiceStatus>> => {
    const entries = await Promise.all(
      projects.map(async (project): Promise<[string, ServiceStatus]> => {
        const [answer, commit] = await Promise.all([
          project.demo ? probe(project.demo) : Promise.resolve(null),
          project.repo ? lastCommit(project.repo) : Promise.resolve(null),
        ]);
        const state: ServiceState = !project.demo
          ? "none"
          : answer && answer.http >= 200 && answer.http < 400
            ? "up"
            : "down";
        return [
          project.slug,
          {
            state,
            http: answer?.http ?? null,
            ms: answer?.ms ?? null,
            commit,
          },
        ];
      }),
    );
    return Object.fromEntries(entries);
  },
);

const UNITS = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
] as const;

/** "há 4 dias" / "4 days ago", from the moment the page was rendered. */
export function relativeTime(iso: string, intl: string, now = Date.now()) {
  const seconds = (Date.parse(iso) - now) / 1000;
  const format = new Intl.RelativeTimeFormat(intl, { numeric: "auto" });
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) {
      return format.format(Math.round(seconds / size), unit);
    }
  }
  return format.format(0, "minute");
}
