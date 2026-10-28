import { SectionHeading } from "@/components/ui/section-heading";
import { CopyEmail } from "@/components/sections/copy-email";
import { ContactForm } from "@/components/sections/contact-form";
import { ScrollSection } from "@/components/layout/scroll-flow";
import { Reveal } from "@/components/ui/reveal";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/** Copies of the line per track: enough to outrun the widest screen. */
const REPEAT = 4;

/**
 * The closing scene. A line in display type runs across the whole width,
 * always moving, and leans and speeds up with the scroll
 * (motion/scrub-scenes.ts); the heading, the e-mail and the form come in
 * under it. The marquee is decoration — the heading says the same thing
 * — so it is hidden from assistive tech.
 */
export function Contact({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  return (
    <ScrollSection
      id="contato"
      className="container-hades section-pad scroll-mt-24"
    >
      <div aria-hidden className="marquee-xl">
        {[0, 1].map((track) => (
          <div key={track} className="marquee-xl__track">
            {Array.from({ length: REPEAT }, (_, i) => (
              <span key={i} className="marquee-xl__item">
                {dict.contact.marquee}
                <span className="marquee-xl__mark" />
              </span>
            ))}
          </div>
        ))}
      </div>

      <SectionHeading
        eyebrow={dict.contact.eyebrow}
        title={dict.contact.title}
        description={dict.contact.description}
      />

      <Reveal className="mt-10 flex flex-col gap-12 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-3">
          <p className="text-smoke text-sm">{dict.contact.preferEmail}</p>
          <CopyEmail />
          <p className="text-smoke text-sm">{dict.contact.replyTime}</p>
        </div>

        <ContactForm locale={locale} />
      </Reveal>
    </ScrollSection>
  );
}
