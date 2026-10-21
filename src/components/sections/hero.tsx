import { Download, Mail } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Magnetic } from "@/components/ui/magnetic";
import { SmoothLink } from "@/components/ui/smooth-link";
import { AvailabilityPill } from "@/components/ui/availability-pill";
import { Hero3D } from "@/components/three/hero-3d";
import { ScrollCue } from "@/components/sections/scroll-cue";
import { GitHubIcon, LinkedInIcon } from "@/components/icons";
import { siteConfig } from "@/lib/site-config";
import { cn } from "@/lib/utils";
import { ScrollSection } from "@/components/layout/scroll-flow";
import type { Dictionary } from "@/lib/i18n/dictionaries";

const socials = [
  {
    label: "GitHub",
    href: siteConfig.links.github,
    Icon: GitHubIcon,
    external: true,
  },
  {
    label: "LinkedIn",
    href: siteConfig.links.linkedin,
    Icon: LinkedInIcon,
    external: true,
  },
  // mailto: — no new tab, no rel needed.
  {
    label: "E-mail",
    href: siteConfig.links.email,
    Icon: Mail,
    external: false,
  },
];

export function Hero({ dict }: { dict: Dictionary }) {
  const { availability } = siteConfig;

  return (
    <ScrollSection id="hero" className="relative isolate" flowStrength={18}>
      <div
        aria-hidden
        className="hero-reactive-aura pointer-events-none absolute inset-0 z-[-1]"
      />
      <div
        aria-hidden
        className="hero-reactive-caustics pointer-events-none absolute inset-0 z-[-1]"
      />
      <div className="container-hades relative grid min-h-dvh grid-cols-1 content-start items-start gap-3 pt-24 pb-12 sm:gap-8 sm:pb-20 lg:grid-cols-12 lg:content-normal lg:items-center lg:gap-6">
        <div className="relative flex flex-col gap-5 sm:gap-6 lg:col-span-7">
          {/* Availability sits with the eyebrow, not below the CTAs: it is the
              first question a recruiter has, and this is the first line they
              read. */}
          <div className="relative z-[30] flex flex-wrap items-center gap-x-3 gap-y-2">
            <p className="text-molten font-mono text-[0.65rem] leading-[1.45] tracking-[0.07em] uppercase sm:text-label">
              {dict.hero.eyebrow}
            </p>
            <AvailabilityPill
              open={availability.open}
              label={
                availability.open
                  ? dict.hero.availabilityOpen
                  : dict.hero.availabilityClosed
              }
              ariaLabel={dict.hero.availabilityAria}
            />
          </div>

          <h1 className="font-display text-bone">
            <span className="hero-depth-title relative z-[30] block text-[length:clamp(2.35rem,11vw,2.85rem)] leading-[0.94] font-semibold tracking-[-0.025em] whitespace-nowrap sm:text-hero">
              <span className="hero-title-base block">
                <span className="[word-spacing:0.08em]">Edu Ferreira</span>
              </span>
              <span
                aria-hidden
                className="hero-title-light pointer-events-none absolute inset-0 block [word-spacing:0.08em]"
              >
                Edu Ferreira
              </span>
            </span>
            <span className="text-smoke relative z-[30] mt-2.5 block max-w-[18ch] text-[1.3rem] leading-[1.08] sm:mt-3 sm:text-[length:clamp(1.5rem,3.5vw,2.5rem)] sm:leading-[1.1]">
              {dict.hero.taglineLead}{" "}
              <span className="text-gradient-molten">
                {dict.hero.taglineAccent}
              </span>
            </span>
          </h1>

          <p className="text-smoke relative z-[30] max-w-[34ch] font-body text-[0.975rem] leading-[1.65] sm:max-w-[65ch] sm:text-lead lg:max-w-[38ch]">
            {dict.hero.description}
          </p>

          <div className="relative z-[30] flex flex-wrap items-center gap-3 pt-1 sm:gap-4 sm:pt-2">
            <Magnetic className="inline-flex">
              <SmoothLink
                href="#projetos"
                className={cn(
                  buttonVariants({ variant: "primary", size: "lg" }),
                  "hero-light-cta h-11 px-5 text-sm sm:h-12 sm:px-6 sm:text-base",
                )}
              >
                {dict.hero.ctaProjects}
              </SmoothLink>
            </Magnetic>
            <a
              href={siteConfig.cvUrl}
              download={siteConfig.cvFileName}
              type="application/pdf"
              aria-label={dict.hero.ctaCvAria}
              data-cursor="hover"
              className={cn(
                buttonVariants({ variant: "ghost", size: "lg" }),
                "hero-light-cta h-11 px-5 text-sm sm:h-12 sm:px-6 sm:text-base",
              )}
            >
              <Download className="size-4 sm:size-[18px]" strokeWidth={1.5} />
              {dict.hero.ctaCv}
            </a>
          </div>

          <ul className="relative z-[30] flex items-center gap-2.5 pt-1 sm:gap-3 sm:pt-2">
            {socials.map(({ label, href, Icon, external }) => (
              <li key={label}>
                <Magnetic className="inline-flex">
                  <a
                    href={href}
                    aria-label={label}
                    target={external ? "_blank" : undefined}
                    rel={external ? "noopener noreferrer" : undefined}
                    data-cursor="hover"
                    className="hero-light-social rounded-pill border-ash text-smoke hover:border-molten hover:text-bone inline-flex size-9 items-center justify-center border transition-colors sm:size-10"
                  >
                    <Icon className="size-4 sm:size-[18px]" />
                  </a>
                </Magnetic>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-20 mt-3 sm:mt-0 lg:col-span-5 lg:overflow-visible">
          <Hero3D className="mx-auto aspect-square w-full max-w-[26rem] sm:max-w-md lg:w-[148%] lg:max-w-none lg:-translate-x-[30%]" />
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
        <ScrollCue />
      </div>
    </ScrollSection>
  );
}
