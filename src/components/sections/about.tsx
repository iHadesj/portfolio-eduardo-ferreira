import { Reveal } from "@/components/ui/reveal";
import { RichText } from "@/components/ui/rich-text";
import { AvailabilityPill } from "@/components/ui/availability-pill";
import { Portrait } from "@/components/sections/portrait";
import { ScrollSection } from "@/components/layout/scroll-flow";
import { siteConfig } from "@/lib/site-config";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/**
 * Opens on why.txt — the README of the GitHub profile, quoted as a file in
 * Edu's own words: English on every locale (marked `lang="en"`), its first
 * line the section heading. The story follows in the page's language, next
 * to the portrait and the facts.
 */
export function About({ dict }: { dict: Dictionary }) {
  const { availability, why } = siteConfig;
  const [headline, ...lines] = why;

  return (
    <ScrollSection
      id="sobre"
      className="about-section container-hades section-pad scroll-mt-24"
    >
      <div className="about-composition">
        <div className="about-copy">
          <Reveal className="about-why">
            <p className="text-label text-smoke font-mono lowercase">
              <span aria-hidden className="section-mark" />
              {`~/${dict.about.eyebrow}`}
            </p>
            <p className="sr-only">{dict.about.whyLabel}</p>
            <p aria-hidden className="about-why__command">
              <span className="text-term-green">$</span> cat why.txt
            </p>
            <h2 lang="en" className="font-display text-h2 text-bone">
              {headline}
            </h2>
            <div lang="en" className="about-why__lines">
              {lines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </Reveal>

          <Reveal className="about-story">
            {dict.about.paragraphs.map((paragraph, index) => (
              <p key={index} className="about-story__step">
                <RichText value={paragraph} />
              </p>
            ))}
          </Reveal>
        </div>

        <Reveal className="about-identity">
          <div className="about-portrait-frame">
            <Portrait
              alt={dict.about.portraitAlt}
              pendingLabel={dict.about.portraitPending}
            />
          </div>

          <dl className="about-facts">
            {dict.about.facts.map((row) => (
              <div key={row.key} className="about-fact">
                <dt>{row.key}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
            <div className="about-fact about-fact--status">
              <dt>{dict.about.statusLabel}</dt>
              <dd>
                <AvailabilityPill
                  open={availability.open}
                  label={
                    availability.open
                      ? dict.hero.availabilityOpen
                      : dict.hero.availabilityClosed
                  }
                  ariaLabel={dict.hero.availabilityAria}
                />
              </dd>
            </div>
          </dl>
        </Reveal>
      </div>
    </ScrollSection>
  );
}
