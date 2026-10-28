import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/section-heading";
import { CodeSnippet } from "@/components/ui/code-snippet";
import type { Decision } from "@/lib/projects";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { fill } from "@/lib/i18n/format";

/**
 * The structured half of a case study.
 *
 * Prose can explain what was built; this is the part that shows judgement —
 * every entry names the alternative that lost and, where there was one, the
 * price the winner carried. Rendering it as a ledger rather than a paragraph
 * makes it scannable in the ten seconds a reviewer actually spends here, and
 * makes a decision with no stated trade-off visibly thinner than its
 * neighbours. A decision that quotes its code shows it under the ledger;
 * the home cards link here (`#decisoes`).
 */
export function DecisionLog({
  decisions,
  dict,
}: {
  decisions: Decision[];
  dict: Dictionary;
}) {
  if (decisions.length === 0) return null;

  const t = dict.projectPage;

  return (
    <section id="decisoes" className="mt-16 scroll-mt-24">
      <SectionHeading
        as="h3"
        eyebrow={t.decisionsEyebrow}
        title={t.decisionsTitle}
        description={t.decisionsDescription}
      />

      <ol className="decision-log">
        {decisions.map((decision, index) => (
          // The <li> is only the list slot; `.decision` is the card, so the
          // reveal animates the visible box rather than an invisible wrapper.
          <li key={`${decision.choice}-${index}`}>
            <Reveal className="decision">
              <span aria-hidden className="decision__index">
                {String(index + 1).padStart(2, "0")}
              </span>

              <dl className="decision__body">
                <div className="decision__row decision__row--choice">
                  <dt className="decision__term">{t.chose}</dt>
                  <dd className="decision__value">{decision.choice}</dd>
                </div>

                {decision.instead ? (
                  <div className="decision__row decision__row--instead">
                    <dt className="decision__term">{t.instead}</dt>
                    <dd className="decision__value">{decision.instead}</dd>
                  </div>
                ) : null}

                <div className="decision__row">
                  <dt className="decision__term">{t.because}</dt>
                  <dd className="decision__value">{decision.because}</dd>
                </div>

                {decision.cost ? (
                  <div className="decision__row decision__row--cost">
                    <dt className="decision__term">{t.cost}</dt>
                    <dd className="decision__value">{decision.cost}</dd>
                  </div>
                ) : null}
              </dl>

              {decision.snippet ? (
                <div className="decision__code">
                  <CodeSnippet
                    snippet={decision.snippet}
                    label={fill(t.snippetAria, {
                      file: decision.snippet.file,
                    })}
                  />
                </div>
              ) : null}
            </Reveal>
          </li>
        ))}
      </ol>
    </section>
  );
}
