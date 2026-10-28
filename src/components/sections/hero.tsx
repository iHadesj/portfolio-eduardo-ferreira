import type { CSSProperties } from "react";
import { buttonVariants } from "@/components/ui/button";
import { SmoothLink } from "@/components/ui/smooth-link";
import { TransitionLink } from "@/components/ui/transition-link";
import { AvailabilityPill } from "@/components/ui/availability-pill";
import { BlackHoleStage } from "@/components/three/black-hole-stage";
import { BlackHolePoster } from "@/components/three/black-hole-poster";
import { siteConfig } from "@/lib/site-config";
import { ScrollSection } from "@/components/layout/scroll-flow";
import { Kinetic } from "@/components/motion/kinetic";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { projectPath } from "@/lib/i18n/routes";

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

/** When a piece of the opening plays, from the moment it starts. */
const at = (seconds: number) =>
  ({ "--at": `${seconds.toFixed(2)}s` }) as CSSProperties;

/** The name, one letter per box, so the black hole can pull them apart —
    the last wave of the collapse — and the opening can raise them one
    after another (`--i`). */
function NameLetters({ name }: { name: string }) {
  let index = 0;
  return name.split(" ").map((word, w) => (
    <span key={word}>
      {w > 0 ? " " : null}
      {[...word].map((letter, i) => (
        <span
          key={i}
          data-pull="3"
          data-pull-decode
          className="hero-letter inline-block"
          style={{ "--i": index++ } as CSSProperties}
        >
          {letter}
        </span>
      ))}
    </span>
  ));
}

/**
 * The first screen is a terminal readout, not a poster: who, what it is and
 * the two ways forward come first — on a phone the name, the role and both
 * buttons fit the first screen under the black hole — then the stack and
 * what shipped, rendered on the server with no JS in the way. The black
 * hole sits beside the copy (above it on phones) and goes live after idle;
 * held down, it pulls
 * the pieces marked `data-pull` into it (see three/gravity.ts) in waves:
 * metadata first (bare `data-pull`), then the content (`"2"`), the name
 * last (`"3"`). Text is torn into characters; `data-pull-box` pieces fall
 * in whole. Then the hero reboots like a terminal: a log prints in the
 * column marked `data-gravity-console`, and `whoami` is typed into the
 * prompt (`data-pull-command`, its `data-pull-instant` part shown at once)
 * before the rest prints back as its output.
 *
 * It opens like a title sequence (CSS only, globals.css "Opening"): the
 * black hole ignites from a point, `whoami` is typed, the name rises letter
 * by letter, then the role word by word, the buttons and the readout. Each
 * piece says when it plays (`data-intro-part`, `--at`); all of it waits
 * while the first visit's boot runs.
 */
export function Hero({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  const { availability } = siteConfig;
  const t = dict.hero;

  return (
    <ScrollSection
      id="hero"
      data-gravity-root
      data-measure
      className="relative isolate"
    >
      <div className="container-hades relative grid grid-cols-1 items-center gap-4 pt-18 pb-8 sm:gap-6 sm:pt-24 sm:pb-12 lg:min-h-[calc(100dvh-7rem)] lg:grid-cols-12 lg:gap-8">
        <div
          data-gravity-console
          className="relative z-10 flex min-w-0 flex-col gap-5 lg:col-span-6"
        >
          <p
            data-pull
            data-pull-decode
            data-pull-command
            data-intro-part="type"
            className="text-smoke w-fit font-mono text-sm"
            style={
              {
                ...at(0.15),
                "--n": `hades@grajau:~$ ${t.prompt}`.length,
              } as CSSProperties
            }
          >
            <span aria-hidden data-pull-instant>
              <span className="text-term-green">hades@grajau</span>:
              <span className="text-term-blue">~</span>${" "}
            </span>
            {t.prompt}
          </p>

          <div className="flex flex-col gap-3">
            <h1
              aria-label="Edu Ferreira"
              className="hero-name font-display text-hero text-bone whitespace-nowrap"
            >
              <NameLetters name="Edu Ferreira" />
              <span
                aria-hidden
                data-pull="3"
                className="hero-caret inline-block"
              >
                _
              </span>
            </h1>
            <p
              data-pull="2"
              className="hero-role text-bone/90 font-body sm:text-lead max-w-[44ch] text-base"
              style={at(0.6)}
            >
              <Kinetic text={t.role} />
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span
                data-pull
                data-pull-box
                data-intro-part="fade"
                className="inline-flex"
                style={at(0.85)}
              >
                <AvailabilityPill
                  open={availability.open}
                  label={
                    availability.open
                      ? t.availabilityOpen
                      : t.availabilityClosed
                  }
                  ariaLabel={t.availabilityAria}
                />
              </span>
              <span
                data-pull
                data-pull-decode
                data-intro-part="fade"
                className="text-smoke font-mono text-xs"
                style={at(0.92)}
              >
                {t.location}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <SmoothLink
              data-pull="2"
              data-pull-box
              data-pull-decode
              data-intro-part="pop"
              href="#projetos"
              className={buttonVariants({ variant: "primary", size: "md" })}
              style={at(0.95)}
            >
              {`> ${t.ctaProjects}`}
            </SmoothLink>
            <a
              data-pull="2"
              data-pull-box
              data-pull-decode
              data-intro-part="pop"
              style={at(1.03)}
              href={siteConfig.cvUrl}
              download={siteConfig.cvFileName}
              type="application/pdf"
              aria-label={t.ctaCvAria}
              className={buttonVariants({ variant: "ghost", size: "md" })}
            >
              {`> ${t.ctaCv}`}
            </a>
            <ul className="text-smoke flex items-center gap-3 font-mono text-xs sm:ml-2">
              {socials.map(({ label, href, external }, i) => (
                <li
                  key={label}
                  data-pull
                  data-pull-decode
                  data-intro-part="fade"
                  style={at(1.1 + i * 0.06)}
                >
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

          <div className="relative">
            {/* The rule is its own piece, so the collapse takes it too. */}
            <span
              aria-hidden
              data-pull
              data-pull-box
              data-intro-part="rule"
              className="hero-readout__rule"
              style={at(1.05)}
            />
            <dl className="hero-readout">
              <div>
                <dt
                  data-pull
                  data-pull-decode
                  data-intro-part="fade"
                  style={at(1.15)}
                >
                  {t.stackLabel}
                </dt>
                <dd>
                  <ul className="hero-readout__stack">
                    {siteConfig.stack.map((name, i) => (
                      <li
                        key={name}
                        data-pull
                        data-pull-decode
                        data-intro-part="fade"
                        style={at(1.2 + i * 0.04)}
                      >
                        {name}
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
              <div>
                <dt
                  data-pull
                  data-pull-decode
                  data-intro-part="fade"
                  style={at(1.3)}
                >
                  {t.deliveriesLabel}
                </dt>
                <dd>
                  <ul className="hero-readout__deliveries">
                    {t.deliveries.map((item, i) => {
                      const href = deliveryHref(item.id, locale);
                      return (
                        <li
                          key={item.id}
                          data-pull="2"
                          data-pull-decode
                          data-intro-part="fade"
                          style={at(1.35 + i * 0.06)}
                        >
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
          </div>
        </div>

        {/* Phones: the black hole crowns the copy. Wide screens: beside it. */}
        <BlackHoleStage
          className="-order-1 lg:order-none lg:col-span-6"
          copy={t.hole}
        >
          <BlackHolePoster />
        </BlackHoleStage>
      </div>
    </ScrollSection>
  );
}
