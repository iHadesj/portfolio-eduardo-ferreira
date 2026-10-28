"use client";

import Link from "next/link";
import { Mail } from "lucide-react";
import { navItems, siteConfig } from "@/lib/site-config";
import { GitHubIcon, LinkedInIcon } from "@/components/icons";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/locale-provider";
import { fill } from "@/lib/i18n/format";
import { sectionPath } from "@/lib/i18n/routes";

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

export function Footer() {
  const { locale, dict } = useI18n();
  const { toast } = useToast();
  const year = new Date().getFullYear();
  // The site answers curl with a text résumé (lib/terminal.ts).
  const host = new URL(siteConfig.url).host;

  return (
    <footer className="border-ash border-t">
      <div className="container-hades grid gap-10 py-14 md:grid-cols-3">
        <div className="flex flex-col gap-3">
          <span className="font-display text-bone text-2xl">EF</span>
          <p className="prose-measure text-smoke text-sm">
            {dict.footer.blurb}
          </p>
        </div>

        <nav aria-label={dict.nav.footer} className="flex flex-col gap-2">
          {navItems.map((item) => (
            <Link
              key={item.id}
              // Absolute, not a bare `#hash`: the footer also renders on case
              // study pages, where these sections do not exist.
              href={sectionPath(locale, item.href)}
              className="text-smoke hover:text-signal w-fit text-sm transition-colors"
            >
              {item.label[locale]}
            </Link>
          ))}
        </nav>

        <div className="flex items-start gap-3">
          {socials.map(({ label, href, Icon, external }) => (
            <a
              key={label}
              href={href}
              aria-label={label}
              target={external ? "_blank" : undefined}
              rel={external ? "noopener noreferrer" : undefined}
              className="rounded-sm border-ash text-smoke hover:border-signal hover:text-bone inline-flex size-10 items-center justify-center border transition-colors"
            >
              <Icon className="size-[18px]" />
            </a>
          ))}
        </div>
      </div>

      <div className="container-hades border-ash text-smoke flex flex-col gap-2 border-t py-6 font-mono text-xs sm:flex-row sm:items-center sm:justify-between">
        <p suppressHydrationWarning>{fill(dict.footer.copyright, { year })}</p>
        <button
          type="button"
          aria-label={fill(dict.footer.curlCopy, { host })}
          onClick={() => {
            void navigator.clipboard?.writeText(`curl ${host}`);
            toast(dict.footer.curlCopied);
          }}
          className="hover:text-bone w-fit text-left transition-colors"
        >
          <span className="text-smoke/70">{`${dict.footer.curlHint}: `}</span>
          <span className="text-term-green">$</span> curl {host}
        </button>
        <Link
          href={siteConfig.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-signal w-fit transition-colors"
        >
          {dict.footer.viewSource}
        </Link>
      </div>
    </footer>
  );
}
