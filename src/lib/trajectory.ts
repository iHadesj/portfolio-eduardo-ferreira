/**
 * The trajectory as a git history, drawn by sections/experience.tsx. Each
 * lane is one thing that ran — often at the same time — and the commits on
 * them are the case studies, on the lane they grew on. Dates are data, so
 * they live here; the words live in the dictionary (`experience.items`,
 * matched by lane id).
 */

export const LANES = ["projetos", "ebac", "vtt", "estacio"] as const;
export type Lane = (typeof LANES)[number];

interface Branch {
  lane: Lane;
  /** When the lane opened: YYYY or YYYY-MM, only as precise as known. */
  from: string;
  /** When it merged back (YYYY-MM), or null while it still runs. */
  to: string | null;
  /** The lane it branched off; null for the first one. */
  parent: Lane | null;
  into: Lane | null;
}

export const BRANCHES: readonly Branch[] = [
  {
    lane: "ebac",
    from: "2023-09",
    to: "2024-10",
    parent: null,
    into: "projetos",
  },
  { lane: "projetos", from: "2024", to: null, parent: "ebac", into: null },
  {
    lane: "vtt",
    from: "2025-02",
    to: "2026-10",
    parent: "projetos",
    into: "projetos",
  },
  {
    lane: "estacio",
    from: "2025-02",
    to: null,
    parent: "projetos",
    into: null,
  },
];

/** Case studies that grew on a lane other than `projetos`. */
const GREW_ON: Partial<Record<string, Lane>> = {
  "api-java-postgresql": "ebac",
};

/**
 * Which row of a lane tells its story (role, bullets, stack): the newest
 * one it owns, so the internship and the course read near their lanes' tips
 * instead of at the bottom, under every commit that came after.
 */
export const STORY_AT: Record<Lane, GraphRow["kind"]> = {
  projetos: "head",
  vtt: "merge",
  estacio: "branch",
  ebac: "merge",
};

export type GraphRow =
  | { kind: "head"; lane: Lane; date: null }
  | { kind: "commit"; lane: Lane; date: string; slug: string }
  | { kind: "merge"; lane: Lane; from: Lane; date: string }
  | { kind: "branch"; lane: Lane; parent: Lane | null; date: string };

/** Sort key: dates padded to YYYY-MM-DD, a bare year sorting first. */
const sortKey = (row: GraphRow) =>
  row.date === null ? "9999" : (row.date + "-00-00").slice(0, 10);

/** Newest first, like `git log`. Equal dates keep the lane order. */
export function buildGraph(
  projects: readonly { slug: string; date: string }[],
): GraphRow[] {
  const rows: GraphRow[] = [{ kind: "head", lane: "projetos", date: null }];
  for (const project of projects) {
    rows.push({
      kind: "commit",
      lane: GREW_ON[project.slug] ?? "projetos",
      date: project.date.slice(0, 10),
      slug: project.slug,
    });
  }
  for (const branch of BRANCHES) {
    rows.push({
      kind: "branch",
      lane: branch.lane,
      parent: branch.parent,
      date: branch.from,
    });
    if (branch.to && branch.into) {
      rows.push({
        kind: "merge",
        lane: branch.into,
        from: branch.lane,
        date: branch.to,
      });
    }
  }
  const order = (row: GraphRow) =>
    LANES.indexOf(row.kind === "merge" ? row.from : row.lane);
  return rows.sort((a, b) => {
    const byDate = sortKey(b).localeCompare(sortKey(a));
    return byDate !== 0 ? byDate : order(a) - order(b);
  });
}

/** Rows a lane spans: from its newest (top) to its oldest (bottom). */
export interface Span {
  /** -1 when the lane still runs past the newest row. */
  top: number;
  bottom: number;
}

export function laneSpans(rows: readonly GraphRow[]): Record<Lane, Span> {
  const spans = {} as Record<Lane, Span>;
  for (const lane of LANES) {
    const touches = rows
      .map((row, index) =>
        row.lane === lane || (row.kind === "merge" && row.from === lane)
          ? index
          : -1,
      )
      .filter((index) => index >= 0);
    // A lane still running with no head of its own runs off the top.
    const runs = BRANCHES.find((branch) => branch.lane === lane)?.to === null;
    const headed = rows.some((row) => row.kind === "head" && row.lane === lane);
    spans[lane] = {
      top: runs && !headed ? -1 : (touches[0] ?? 0),
      bottom: touches[touches.length - 1] ?? 0,
    };
  }
  return spans;
}

/** A short, stable hash for a row — decoration in the shape of a sha. */
export function shortHash(seed: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0").slice(0, 7);
}
