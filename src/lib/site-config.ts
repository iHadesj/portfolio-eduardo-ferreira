// Relative, not the `@/` alias: `next.config.ts` imports this module through
// Next's own config loader, which does not resolve tsconfig paths.
import type { Locale } from "./i18n/config";

/**
 * Single source of truth for identity, links and navigation.
 *
 * Copy lives in `lib/i18n/dictionaries` — this file holds only what is *about
 * Edu* rather than about the page: names, URLs, availability. TODO_EDU markers
 * are resolved in Fase 11 (public e-mail, domain).
 */

export interface NavItem {
  id: string;
  href: string;
  label: Record<Locale, string>;
}

export const siteConfig = {
  name: "Edu Ferreira",
  handle: "iHadesj",
  // Public-facing contact e-mail. Doubles as the default CONTACT_EMAIL inbox
  // for the contact form (see src/lib/env.ts).
  email: "edualexandre2017@outlook.com",
  // Canonical production URL (the old placeholder, edu-ferreira-zeta, no
  // longer resolves). Also the host the curl résumé tells people to use.
  url: "https://edu-ferreira.vercel.app",
  // CV PDF served straight from /public.
  cvUrl: "/Curriculo-Eduardo-Ferreira-2026.pdf",
  // Name the browser saves the download as.
  cvFileName: "Curriculo-Eduardo-Ferreira-2026.pdf",
  // Repository (for the footer "view source" link). TODO_EDU: confirm name.
  sourceUrl: "https://github.com/iHadesj/portfolio-eduardo-ferreira",
  /** The core stack, in the hero and the text résumé. Proper nouns: the
   *  same in every locale. */
  stack: [
    "React",
    "Next.js",
    "TypeScript",
    "Java",
    "Spring",
    "PostgreSQL",
    "Three.js",
  ],
  role: {
    pt: "Desenvolvedor Fullstack — Java & React/TypeScript",
    en: "Fullstack Developer — Java & React/TypeScript",
  } satisfies Record<Locale, string>,

  /**
   * Drives the hero availability pill and the About "status" row. Flip to
   * false the day you stop taking work — it is the first thing a recruiter
   * looks for, so a stale `true` is worse than no badge at all.
   */
  availability: { open: true as boolean },

  /**
   * Portrait for the About section, duotoned to the active theme at render
   * time (see `.portrait-*` in globals.css) so it never fights the palette.
   */
  portrait: "/minha-foto.webp" as string | null,

  /**
   * why.txt — the README of the GitHub profile, one entry per line. Quoted,
   * never translated: it is the same file in every locale (the About opens
   * on it, the shell `cat`s it, the curl résumé prints it).
   */
  why: [
    "code got cheap. reading it never did.",
    "the crowd hands its thinking to a prompt and ships whatever comes back.",
    "i stay in the editor, line by line, learning how things are meant to stand.",
    "to me code was always a kind of art, and art was never meant to be outsourced.",
    "every repo here is my taste in syntax. the judgment is mine too.",
  ],

  links: {
    github: "https://github.com/iHadesj",
    linkedin: "https://www.linkedin.com/in/eduardoalexandre-java/",
    // `mailto:` is required — these values are used directly as anchor hrefs.
    email: "mailto:edualexandre2017@outlook.com",
  },
} as const;

export const navItems: NavItem[] = [
  {
    id: "projetos",
    href: "#projetos",
    label: { pt: "projetos", en: "projects" },
  },
  { id: "trajetoria", href: "#trajetoria", label: { pt: "xp", en: "xp" } },
  { id: "sobre", href: "#sobre", label: { pt: "sobre", en: "about" } },
  { id: "status", href: "#status", label: { pt: "status", en: "status" } },
  {
    id: "contato",
    href: "#contato",
    label: { pt: "contato", en: "contact" },
  },
];
