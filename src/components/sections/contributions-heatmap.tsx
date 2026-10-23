import { cn } from "@/lib/utils";
import type { ContributionsData } from "@/lib/github";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { fill } from "@/lib/i18n/format";

const LEVEL_BG = [
  "bg-ash/40",
  "bg-signal/30",
  "bg-signal/55",
  "bg-signal/80",
  "bg-signal",
];

export function ContributionsHeatmap({
  data,
  dict,
  intl,
}: {
  data: ContributionsData;
  dict: Dictionary;
  intl: "pt-BR" | "en-US";
}) {
  const weeks: ContributionsData["days"][] = [];
  for (let i = 0; i < data.days.length; i += 7) {
    weeks.push(data.days.slice(i, i + 7));
  }

  const total = new Intl.NumberFormat(intl).format(data.total);
  // `day.date` is a bare YYYY-MM-DD calendar day from GitHub. Parsing it as UTC
  // *and* formatting in UTC keeps the label on that exact day — without the
  // timeZone the server's own offset can render it as the day before.
  const dayFormat = new Intl.DateTimeFormat(intl, {
    dateStyle: "long",
    timeZone: "UTC",
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-3">
        <span className="font-display text-3xl text-bone">{total}</span>
        <span className="text-smoke text-sm">
          {dict.github.contributionsSuffix}
        </span>
      </div>

      <div
        role="img"
        aria-label={fill(dict.github.contributionsAria, { total })}
        className="grid grid-flow-col grid-rows-[repeat(7,10px)] gap-[3px] overflow-x-auto pb-1"
      >
        {weeks.map((week) =>
          week.map((day) => (
            <span
              key={day.date}
              title={fill(dict.github.contributionsDay, {
                count: day.count,
                date: dayFormat.format(new Date(`${day.date}T00:00:00Z`)),
              })}
              className={cn(
                "size-[10px] rounded-[2px]",
                LEVEL_BG[day.level] ?? "bg-ash/40",
              )}
            />
          )),
        )}
      </div>
    </div>
  );
}
