import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal } from "@/components/ui/reveal";
import { RichText } from "@/components/ui/rich-text";
import { AvailabilityPill } from "@/components/ui/availability-pill";
import { Portrait } from "@/components/sections/portrait";
import { ScrollSection } from "@/components/layout/scroll-flow";
import { siteConfig } from "@/lib/site-config";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function About({ dict }: { dict: Dictionary }) {
  const { availability } = siteConfig;

  return (
    <ScrollSection
      lean={1}
      id="sobre"
      className="about-section container-hades section-pad scroll-mt-24"
    >
      <div className="about-composition">
        <div className="about-copy">
          <SectionHeading
            eyebrow={dict.about.eyebrow}
            title={dict.about.title}
          />

          <Reveal className="about-story">
            {dict.about.paragraphs.map((paragraph, index) => (
              <p key={index} className="about-story__step">
                <RichText value={paragraph} />
              </p>
            ))}
          </Reveal>
        </div>

        <Reveal delay={0.1} className="about-identity">
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
