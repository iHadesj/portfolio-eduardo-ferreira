import type { CSSProperties } from "react";
import { Reveal } from "@/components/ui/reveal";
import { RichText } from "@/components/ui/rich-text";
import { AvailabilityPill } from "@/components/ui/availability-pill";
import { Portrait } from "@/components/sections/portrait";
import { ScrollSection } from "@/components/layout/scroll-flow";
import { Kinetic } from "@/components/motion/kinetic";
import { siteConfig } from "@/lib/site-config";
import type { Dictionary } from "@/lib/i18n/dictionaries";

const COMMAND = "cat why.txt";

/**
 * Opens on why.txt — the README of the GitHub profile, quoted as a file in
 * Edu's own words: English on every locale (marked `lang="en"`), its first
 * line the section heading. It is the page's manifesto, so it gets the
 * screen to itself: the frame holds while it is scrolled through and its
 * words light up as they are read (motion/scrub-scenes.ts). The story
 * follows in the page's language, next to the portrait and the facts.
 */
export function About({ dict }: { dict: Dictionary }) {
  const { availability, why } = siteConfig;
  const [headline = "", ...lines] = why;
  const path = `~/${dict.about.eyebrow}`;

  return (
    <ScrollSection
      id="sobre"
      className="about-section container-hades section-pad scroll-mt-24"
    >
      <div className="manifesto">
        <div className="manifesto__frame">
          <Reveal variant="heading" className="about-why">
            <p className="text-label text-smoke font-mono lowercase">
              <span aria-hidden className="section-mark" />
              <span
                className="type-in"
                style={{ "--n": path.length } as CSSProperties}
              >
                {path}
              </span>
            </p>
            <p className="sr-only">{dict.about.whyLabel}</p>
            <p aria-hidden className="about-why__command">
              <span className="text-term-green">$</span>{" "}
              <span
                className="type-in"
                style={
                  { "--n": COMMAND.length, "--at": "0.4s" } as CSSProperties
                }
              >
                {COMMAND}
              </span>
            </p>
            <h2
              lang="en"
              className="font-display text-h2 text-bone"
              style={{ "--k-at": "0.75s" } as CSSProperties}
            >
              <Kinetic text={headline} />
            </h2>
            <div lang="en" className="about-why__lines">
              {lines.map((line) => (
                <p key={line}>
                  <Kinetic text={line} mode="read" />
                </p>
              ))}
            </div>
          </Reveal>
        </div>
      </div>

      <div className="about-composition">
        <div className="about-copy">
          <Reveal className="about-story">
            {dict.about.paragraphs.map((paragraph, index) => (
              <p key={index} className="about-story__step">
                <RichText value={paragraph} />
              </p>
            ))}
          </Reveal>
        </div>

        <Reveal variant="wipe" className="about-identity">
          <div className="about-portrait-frame">
            <Portrait
              alt={dict.about.portraitAlt}
              pendingLabel={dict.about.portraitPending}
            />
          </div>

          <dl className="about-facts">
            {dict.about.facts.map((row, i) => (
              <div
                key={row.key}
                data-step
                className="about-fact"
                style={{ "--i": i } as CSSProperties}
              >
                <dt>{row.key}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
            <div
              data-step
              className="about-fact about-fact--status"
              style={{ "--i": dict.about.facts.length } as CSSProperties}
            >
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
