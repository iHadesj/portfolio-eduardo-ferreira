import { buttonVariants } from "@/components/ui/button";
import { SmoothLink } from "@/components/ui/smooth-link";
import { TransitionLink } from "@/components/ui/transition-link";
import { AvailabilityPill } from "@/components/ui/availability-pill";
import { AsciiFace } from "@/components/face/ascii-face";
import { RibbonStage } from "@/components/three/ribbon-stage";
import { RibbonPoster } from "@/components/three/ribbon-poster";
import { siteConfig } from "@/lib/site-config";
import { ScrollSection } from "@/components/layout/scroll-flow";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { projectPath } from "@/lib/i18n/routes";

/** Stack names are proper nouns: the same in every locale. */
const STACK = [
  "React",
  "Next.js",
  "TypeScript",
  "Java",
  "Spring",
  "PostgreSQL",
  "Three.js",
] as const;

/** Case study behind each delivery id; anything else is the job itself. */
const DELIVERY_SLUG: Record<string, string> = {
  "api-java": "api-java-postgresql",
  levva: "levva-loja-e-sorte",
  bernardo: "um-abraco-bernardo",
};

/** Where each delivery points: a case study, or the experience timeline. */
function deliveryHref(id: string, locale: Locale): string {
  const slug = DELIVERY_SLUG[id];
  return slug ? projectPath(locale, slug) : "#trajetoria";
}

const socials = [
  { label: "github", href: siteConfig.links.github, external: true },
  { label: "linkedin", href: siteConfig.links.linkedin, external: true },
  // mailto: — no new tab, no rel needed.
  { label: "email", href: siteConfig.links.email, external: false },
];

/**
 * The first screen is a terminal readout, not a poster: who, what stack, what
 * shipped — everything a recruiter scans for — fits above the fold at
 * 1366×768 and 390×844, rendered on the server with no JS in the way. The
 * sculpture sits beside it and loads after idle.
 */
export function Hero({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  const { availability } = siteConfig;
  const t = dict.hero;

  return (
    <ScrollSection id="hero" className="relative isolate" flowStrength={18}>
      <div className="container-hades relative grid grid-cols-1 items-center gap-4 pt-18 sm:gap-6 sm:pt-24 lg:min-h-[calc(100dvh-7rem)] lg:grid-cols-12 lg:gap-8">
        <div className="relative z-10 flex min-w-0 flex-col gap-5 lg:col-span-6">
          <p className="text-smoke font-mono text-sm">
            <span aria-hidden>
              <span className="text-term-green">hades@grajau</span>:
              <span className="text-term-blue">~</span>${" "}
            </span>
            {t.prompt}
          </p>

          <div className="flex flex-col gap-3">
            <h1 className="font-display text-hero text-bone whitespace-nowrap">
              Edu Ferreira
              <span aria-hidden className="hero-caret">
                _
              </span>
            </h1>
            <p className="text-bone/90 font-body sm:text-lead max-w-[44ch] text-base">
              {t.role}
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <AvailabilityPill
                open={availability.open}
                label={
                  availability.open ? t.availabilityOpen : t.availabilityClosed
                }
                ariaLabel={t.availabilityAria}
              />
              <span className="text-smoke font-mono text-xs">{t.location}</span>
            </div>
          </div>

          <dl className="hero-readout">
            <div>
              <dt>{t.stackLabel}</dt>
              <dd>
                <ul className="hero-readout__stack">
                  {STACK.map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
              </dd>
            </div>
            <div>
              <dt>{t.deliveriesLabel}</dt>
              <dd>
                <ul className="hero-readout__deliveries">
                  {t.deliveries.map((item) => {
                    const href = deliveryHref(item.id, locale);
                    return (
                      <li key={item.id}>
                        {href.startsWith("#") ? (
                          <SmoothLink href={href}>{item.name}</SmoothLink>
                        ) : (
                          <TransitionLink href={href}>
                            {item.name}
                          </TransitionLink>
                        )}{" "}
                        <span>{item.detail}</span>
                      </li>
                    );
                  })}
                </ul>
              </dd>
            </div>
          </dl>

          <div className="flex flex-wrap items-center gap-3">
            <SmoothLink
              href="#projetos"
              className={buttonVariants({ variant: "primary", size: "md" })}
            >
              {`> ${t.ctaProjects}`}
            </SmoothLink>
            <a
              href={siteConfig.cvUrl}
              download={siteConfig.cvFileName}
              type="application/pdf"
              aria-label={t.ctaCvAria}
              className={buttonVariants({ variant: "ghost", size: "md" })}
            >
              {`> ${t.ctaCv}`}
            </a>
            <ul className="text-smoke flex items-center gap-3 font-mono text-xs sm:ml-2">
              {socials.map(({ label, href, external }) => (
                <li key={label}>
                  <a
                    href={href}
                    target={external ? "_blank" : undefined}
                    rel={external ? "noopener noreferrer" : undefined}
                    className="hover:text-bone transition-colors"
                  >
                    {`[${label}]`}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Phones: the face crowns the copy. Wide screens: beside it. */}
        <AsciiFace className="-order-1 lg:order-none lg:col-span-6" />
      </div>

      {/* The ∞ ribbon gets the full width right under the fold line, so on a
          desktop its top already peeks into the first screen. */}
      <div className="container-hades pt-10 pb-4 sm:pt-14 sm:pb-10 lg:pt-4">
        <RibbonStage
          hintMouse={t.ribbonHintMouse}
          hintTouch={t.ribbonHintTouch}
        >
          <RibbonPoster />
        </RibbonStage>
      </div>
    </ScrollSection>
  );
}
