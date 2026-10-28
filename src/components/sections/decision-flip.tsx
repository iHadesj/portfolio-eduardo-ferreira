import { CodeSnippet } from "@/components/ui/code-snippet";
import { TransitionLink } from "@/components/ui/transition-link";
import type { Decision } from "@/lib/projects";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { fill } from "@/lib/i18n/format";
import { projectPath } from "@/lib/i18n/routes";

type Side = "chose" | "dropped" | "code";

/**
 * The decision a project card leads with: what was picked and what it cost,
 * with the alternative that lost — and, when the case study quotes it, the
 * code the decision comes down to — one tap away. Read like a diff: `+` for
 * the choice, `−` for what it replaced.
 *
 * The sides are a native radio group and CSS shows the checked one
 * (`.decision-flip` in globals.css): no JavaScript, arrow keys move between
 * sides, and a browser without `:has()` shows every side, stacked. The two
 * prose sides share one grid cell, so flipping never changes the card's
 * height; only the code side, which is taller, takes its own.
 */
export function DecisionFlip({
  slug,
  decision,
  total,
  locale,
  dict,
}: {
  slug: string;
  decision: Decision;
  /** Decisions in the whole case study, this one included. */
  total: number;
  locale: Locale;
  dict: Dictionary;
}) {
  const t = dict.projects.decision;
  const terms = dict.projectPage;
  const sides: Side[] = ["chose"];
  if (decision.instead) sides.push("dropped");
  if (decision.snippet) sides.push("code");
  const group = `decision-${slug}`;

  return (
    <div className="decision-flip">
      <div className="decision-flip__top">
        <p id={`${group}-legend`} className="decision-flip__legend">
          {fill(t.legend, { total })}
        </p>
        {sides.length > 1 ? (
          <div
            role="radiogroup"
            aria-labelledby={`${group}-legend`}
            className="decision-flip__tabs"
          >
            {sides.map((side, index) => (
              <label key={side} className="decision-flip__tab">
                <input
                  type="radio"
                  name={group}
                  value={side}
                  defaultChecked={index === 0}
                />
                {t.sides[side]}
              </label>
            ))}
          </div>
        ) : null}
      </div>

      <div className="decision-flip__faces">
        <div className="decision-flip__face" data-side="chose">
          <p className="decision-flip__headline">
            <span aria-hidden className="decision-flip__sign">
              +
            </span>
            {decision.choice}
          </p>
          <p className="decision-flip__detail">
            <span className="decision-flip__term">
              {decision.cost ? terms.cost : terms.because}
            </span>{" "}
            {decision.cost ?? decision.because}
          </p>
        </div>

        {decision.instead ? (
          <div className="decision-flip__face" data-side="dropped">
            <p className="decision-flip__headline decision-flip__headline--dropped">
              <span aria-hidden className="decision-flip__sign">
                −
              </span>
              {decision.instead}
            </p>
            <p className="decision-flip__detail">
              <span className="decision-flip__term">{terms.because}</span>{" "}
              {decision.because}
            </p>
          </div>
        ) : null}
      </div>

      {decision.snippet ? (
        <div className="decision-flip__code">
          <CodeSnippet
            snippet={decision.snippet}
            label={fill(terms.snippetAria, { file: decision.snippet.file })}
          />
        </div>
      ) : null}

      {total > 1 ? (
        <TransitionLink
          href={`${projectPath(locale, slug)}#decisoes`}
          className="decision-flip__more"
        >
          {fill(t.all, { total })}
        </TransitionLink>
      ) : null}
    </div>
  );
}
