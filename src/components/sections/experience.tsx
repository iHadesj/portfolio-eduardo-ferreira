import { SectionHeading } from "@/components/ui/section-heading";
import { Badge } from "@/components/ui/badge";
import { TransitionLink } from "@/components/ui/transition-link";
import { ScrollSection } from "@/components/layout/scroll-flow";
import { localizedProjects } from "@/lib/projects";
import {
  LANES,
  STORY_AT,
  buildGraph,
  laneSpans,
  shortHash,
  type GraphRow,
  type Lane,
  type Span,
} from "@/lib/trajectory";
import { intlLocale, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { fill } from "@/lib/i18n/format";
import { projectPath } from "@/lib/i18n/routes";

/* Graph geometry, in px: lanes 14 apart, the node 14 down a 28-tall top. */
const X0 = 7;
const GAP = 14;
const NODE_Y = 14;
const TOP = 28;
const WIDTH = X0 * 2 + (LANES.length - 1) * GAP;

const laneX = (lane: Lane) => X0 + LANES.indexOf(lane) * GAP;

const curve = (x1: number, y1: number, x2: number, y2: number) => {
  const mid = (y1 + y2) / 2;
  return `M${x1} ${y1} C${x1} ${mid} ${x2} ${mid} ${x2} ${y2}`;
};

/** "out 2026" / "Oct 2026"; a bare year stays a year. */
function monthYear(date: string, intl: string): string {
  const [year, month] = date.split("-").map(Number);
  if (!year || !month) return date;
  const name = new Intl.DateTimeFormat(intl, {
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
  return `${name.replace(".", "")} ${year}`;
}

/**
 * One row's slice of the graph: a fixed top holding the node and any curve
 * into or out of it, and a line running on below for every lane still alive,
 * so the row can grow (open its story) without breaking the graph.
 */
function RowGraph({
  row,
  index,
  spans,
}: {
  row: GraphRow;
  index: number;
  spans: Record<Lane, Span>;
}) {
  const edges: { d: string; lane: Lane }[] = [];
  const below: Lane[] = [];

  for (const lane of LANES) {
    const { top, bottom } = spans[lane];
    if (index < top || index > bottom) continue;
    const x = laneX(lane);

    if (index !== top && index !== bottom) {
      edges.push({ d: `M${x} 0 V${TOP}`, lane });
      below.push(lane);
      continue;
    }
    if (index === top && row.kind === "merge" && row.from === lane) {
      // The merged lane rises into the node of the lane it joins.
      edges.push({ d: curve(x, TOP, laneX(row.lane), NODE_Y), lane });
      if (index !== bottom) below.push(lane);
      continue;
    }
    if (index !== top) edges.push({ d: `M${x} 0 V${NODE_Y}`, lane });
    if (index === bottom) {
      // A lane's first commit leans back onto the lane it branched off.
      if (row.kind === "branch" && row.parent) {
        edges.push({ d: curve(x, NODE_Y, laneX(row.parent), TOP), lane });
      }
    } else {
      edges.push({ d: `M${x} ${NODE_Y} V${TOP}`, lane });
      below.push(lane);
    }
  }

  const ring = row.kind === "merge" || row.kind === "head";

  return (
    <div aria-hidden className="graph-cell">
      <svg
        className="graph-top"
        width={WIDTH}
        height={TOP}
        viewBox={`0 0 ${WIDTH} ${TOP}`}
      >
        {edges.map((edge, i) => (
          <path
            key={i}
            d={edge.d}
            pathLength={1}
            className="graph-edge"
            data-lane={edge.lane}
          />
        ))}
        <circle
          cx={laneX(row.lane)}
          cy={NODE_Y}
          r={ring ? 4.5 : 3.5}
          className="graph-node"
          data-lane={row.lane}
          data-ring={ring ? "" : undefined}
        />
      </svg>
      {below.map((lane) => (
        <span
          key={lane}
          className="graph-line"
          data-lane={lane}
          style={{ left: laneX(lane) }}
        />
      ))}
    </div>
  );
}

/**
 * The trajectory as `git log --graph`: the course, the degree, the internship
 * and the personal projects are branches running side by side — which a
 * single vertical timeline hides — and every case study is a commit on the
 * lane it grew on, linking to it. Each lane tells its story (role, bullets,
 * stack) at its newest row, open by default and collapsible. Server-rendered
 * SVG and CSS: a read head drawn down it by the scroll lights each row it
 * passes (`data-lit`), and without it — reduced motion, no JavaScript — the
 * graph simply shows drawn.
 */
export function Experience({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const t = dict.experience;
  const g = t.graph;
  const intl = intlLocale[locale];
  const projects = localizedProjects(locale);
  const titles = new Map(projects.map((p) => [p.slug, p.title]));
  const rows = buildGraph(projects);
  const spans = laneSpans(rows);

  return (
    <ScrollSection
      id="trajetoria"
      className="container-hades section-pad scroll-mt-24"
    >
      <SectionHeading
        eyebrow={t.eyebrow}
        title={t.title}
        description={t.description}
      />
      <p aria-hidden className="graph-command">
        <span className="text-term-green">$</span> {g.command}
      </p>

      {/* The read head runs down the graph with the scroll and draws each
          commit as it passes (motion/scrub-scenes.ts). */}
      <div className="graph-wrap">
        <span aria-hidden className="graph-playhead" />
        <ol className="graph">
          {rows.map((row, index) => {
            const storyLane = row.kind === "merge" ? row.from : row.lane;
            const story =
              STORY_AT[storyLane] === row.kind
                ? t.items.find((item) => item.id === storyLane)
                : undefined;
            const lane = g.lanes[storyLane];
            const ref =
              row.kind === "head"
                ? fill(g.head, { lane })
                : row.kind === "merge"
                  ? fill(g.merge, { lane })
                  : row.kind === "branch"
                    ? fill(row.parent ? g.branch : g.init, { lane })
                    : null;
            const date = row.date ? monthYear(row.date, intl) : g.now;
            const hash = shortHash(
              `${row.kind}:${storyLane}:${row.kind === "commit" ? row.slug : (row.date ?? "")}`,
            );

            const head = (
              <span className="graph-head">
                <span aria-hidden className="graph-hash" data-lane={storyLane}>
                  {hash}
                </span>
                {ref ? (
                  <span className="graph-ref" data-lane={storyLane}>
                    {`(${ref})`}
                  </span>
                ) : null}
                {row.kind === "commit" ? (
                  <TransitionLink href={projectPath(locale, row.slug)}>
                    {fill(g.commit, {
                      title: titles.get(row.slug) ?? row.slug,
                    })}
                  </TransitionLink>
                ) : null}
              </span>
            );

            return (
              <li key={hash} className="graph-row">
                <RowGraph row={row} index={index} spans={spans} />
                <div className="graph-text">
                  {story ? (
                    <details open className="graph-story" data-lane={storyLane}>
                      <summary>
                        {head}
                        <h3 className="graph-role">
                          {story.role}
                          {story.org ? (
                            <span className="text-smoke"> · {story.org}</span>
                          ) : null}
                        </h3>
                        <span className="graph-date">{story.period}</span>
                      </summary>
                      <div className="graph-story__body">
                        <ul className="graph-story__bullets">
                          {story.bullets.map((bullet, i) => (
                            <li key={i}>{bullet}</li>
                          ))}
                        </ul>
                        <div className="flex flex-wrap gap-2">
                          {story.stack.map((tech) => (
                            <Badge key={tech}>{tech}</Badge>
                          ))}
                        </div>
                      </div>
                    </details>
                  ) : (
                    <>
                      {head}
                      <span className="graph-date">{date}</span>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </ScrollSection>
  );
}
