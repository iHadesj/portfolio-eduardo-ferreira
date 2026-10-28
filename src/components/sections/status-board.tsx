import type { CSSProperties } from "react";
import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal } from "@/components/ui/reveal";
import { TransitionLink } from "@/components/ui/transition-link";
import { ContributionsHeatmap } from "@/components/sections/contributions-heatmap";
import { ScrollSection } from "@/components/layout/scroll-flow";
import { fetchContributions } from "@/lib/github";
import { localizedProjects } from "@/lib/projects";
import {
  projectStatuses,
  relativeTime,
  type ServiceStatus,
} from "@/lib/status";
import { intlLocale, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { fill } from "@/lib/i18n/format";
import { projectPath } from "@/lib/i18n/routes";

type StatusCopy = Dictionary["status"];

/** What the probe saw: "no ar · 200 · 142 ms". */
function stateText(status: ServiceStatus, t: StatusCopy): string {
  if (status.state === "none") return t.states.none;
  if (status.state === "down") {
    return `${t.states.down} · ${status.http ?? t.noAnswer}`;
  }
  return `${t.states.up} · ${status.http} · ${status.ms} ms`;
}

/**
 * The card's one-line version: "● 200 · 142 ms · commit há 4 dias". The dot
 * says the same as the numbers, for the eye; the numbers say it for
 * everyone else.
 */
export function ServiceLine({
  status,
  locale,
  dict,
}: {
  status: ServiceStatus;
  locale: Locale;
  dict: Dictionary;
}) {
  const t = dict.status;
  const parts: string[] = [];
  if (status.state === "up") parts.push(`${status.http} · ${status.ms} ms`);
  if (status.state === "down") parts.push(t.states.down);
  if (status.commit) {
    parts.push(
      fill(t.commitAgo, {
        when: relativeTime(status.commit.date, intlLocale[locale]),
      }),
    );
  }
  if (parts.length === 0) return null;

  return (
    <p className="service-line" data-state={status.state}>
      <span aria-hidden className="service__dot" />
      <span className="sr-only">{t.lineLabel} </span>
      {parts.join(" · ")}
    </p>
  );
}

/**
 * Every case study as a running unit, `systemctl status`-style: whether its
 * demo answers right now and how fast, and its last commit. Replaces the
 * old repository feed, which mostly said "No description." — this is the
 * same GitHub, read for what it proves. Checked by the server (lib/status),
 * so it ships no JavaScript; the contribution calendar closes the section.
 */
export async function StatusBoard({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const t = dict.status;
  const intl = intlLocale[locale];
  const [statuses, contributions] = await Promise.all([
    projectStatuses(),
    fetchContributions(),
  ]);
  const checked = new Intl.DateTimeFormat(intl, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date());

  return (
    <ScrollSection
      id="status"
      className="container-hades section-pad scroll-mt-24"
    >
      <SectionHeading
        eyebrow={t.eyebrow}
        title={t.title}
        description={t.description}
      />
      <p className="status-board__checked">
        {fill(t.checked, { time: checked })}
      </p>

      <Reveal variant="log">
        <ul className="status-board">
          {localizedProjects(locale).map((project, i) => {
            const status = statuses[project.slug];
            if (!status) return null;
            return (
              <li
                key={project.slug}
                data-step
                className="service"
                data-state={status.state}
                style={{ "--i": i } as CSSProperties}
              >
                <TransitionLink
                  href={projectPath(locale, project.slug)}
                  className="service__unit"
                >
                  <span aria-hidden className="service__dot" />
                  <span className="service__name">{`${project.slug}.service`}</span>
                  <span className="service__title">{project.title}</span>
                </TransitionLink>
                <dl className="service__rows">
                  <div>
                    <dt>{t.rows.state}</dt>
                    <dd>{stateText(status, t)}</dd>
                  </div>
                  <div>
                    <dt>{t.rows.commit}</dt>
                    <dd>
                      {status.commit ? (
                        <>
                          {relativeTime(status.commit.date, intl)}
                          {" · "}
                          <a
                            href={status.commit.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {status.commit.message}
                          </a>
                        </>
                      ) : (
                        t.noCommit
                      )}
                    </dd>
                  </div>
                </dl>
              </li>
            );
          })}
        </ul>
      </Reveal>

      {contributions ? (
        <Reveal variant="scan" className="mt-14">
          <ContributionsHeatmap data={contributions} dict={dict} intl={intl} />
        </Reveal>
      ) : null}
    </ScrollSection>
  );
}
