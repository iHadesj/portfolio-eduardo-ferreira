/**
 * The site's hidden interactions, as a collection to find: the hero's
 * collapse, orbiting the black hole, the underworld, the secret in ⌘K,
 * the shell, its `sudo` and reading why.txt in it. Each component that owns
 * one calls `discover(id)` when the reader finds it; the anomaly log
 * (components/anomaly-log.tsx) listens and reports progress.
 *
 * What was found is a per-reader convenience kept in localStorage — when
 * storage is blocked it lasts for the page's lifetime, nothing breaks.
 */

export const ANOMALIES = [
  "collapse",
  "orbit",
  "underworld",
  "secret",
  "terminal",
  "sudo",
  "why",
] as const;

export type AnomalyId = (typeof ANOMALIES)[number];

export const ANOMALY_EVENT = "anomaly:found";

export interface AnomalyFound {
  id: AnomalyId;
  /** How many have been found, this one included. */
  count: number;
}

const KEY = "hades:anomalies";
/** Fallback (and cache) for when storage is unavailable. */
const memory = new Set<AnomalyId>();
let loaded = false;

const isAnomaly = (value: unknown): value is AnomalyId =>
  typeof value === "string" && (ANOMALIES as readonly string[]).includes(value);

export function foundAnomalies(): AnomalyId[] {
  if (!loaded && typeof window !== "undefined") {
    loaded = true;
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
      if (Array.isArray(stored)) {
        for (const id of stored) if (isAnomaly(id)) memory.add(id);
      }
    } catch {
      // Blocked or corrupt storage: start from what this page has seen.
    }
  }
  return ANOMALIES.filter((id) => memory.has(id));
}

/** Mark `id` found; announces it the first time only. */
export function discover(id: AnomalyId): void {
  if (typeof window === "undefined") return;
  const found = foundAnomalies();
  if (found.includes(id)) return;
  memory.add(id);
  try {
    localStorage.setItem(KEY, JSON.stringify([...memory]));
  } catch {
    // Kept in memory for this page.
  }
  window.dispatchEvent(
    new CustomEvent<AnomalyFound>(ANOMALY_EVENT, {
      detail: { id, count: found.length + 1 },
    }),
  );
}
