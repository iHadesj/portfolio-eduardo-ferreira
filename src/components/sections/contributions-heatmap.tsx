import type { CSSProperties } from "react";
import type { ContributionsData } from "@/lib/github";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { fill } from "@/lib/i18n/format";

/** Contribution level 0–4 → glyph, sparse to dense. */
const LEVEL_GLYPH = ["·", ":", "+", "#", "@"];

/**
 * The contribution calendar as seven lines of text — one per weekday, one
 * column per week. It used to be ~370 styled spans (one per day, each with a
 * tooltip); as a single `<pre>` it is one node to lay out, and it reads like
 * the rest of the terminal. The cell size follows the container width
 * (`.heatmap-ascii` in globals.css), so it never scrolls sideways on a phone.
 */
export function ContributionsHeatmap({
  data,
  dict,
  intl,
}: {
  data: ContributionsData;
  dict: Dictionary;
  intl: "pt-BR" | "en-US";
}) {
  const weeks = Math.ceil(data.days.length / 7);
  const rows: string[] = [];
  for (let weekday = 0; weekday < 7; weekday += 1) {
    let line = "";
    for (let week = 0; week < weeks; week += 1) {
      const day = data.days[week * 7 + weekday];
      line += day ? (LEVEL_GLYPH[day.level] ?? LEVEL_GLYPH[0]) : " ";
    }
    rows.push(line);
  }

  const total = new Intl.NumberFormat(intl).format(data.total);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-3">
        {/* Counts up from zero as it comes into view (motion/scrub-scenes). */}
        <span
          data-count={data.total}
          className="font-display text-bone text-3xl tabular-nums"
        >
          {total}
        </span>
        <span className="text-smoke text-sm">
          {dict.status.contributionsSuffix}
        </span>
      </div>

      <div className="heatmap-ascii">
        <pre
          role="img"
          aria-label={fill(dict.status.contributionsAria, { total })}
          style={{ "--cols": weeks } as CSSProperties}
        >
          {rows.join("\n")}
        </pre>
      </div>
    </div>
  );
}
