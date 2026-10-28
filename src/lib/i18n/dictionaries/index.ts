import type { Locale } from "@/lib/i18n/config";
import { pt, type Dictionary, type Rich, type RichNode } from "./pt";
import { en } from "./en";

export type { Dictionary, Rich, RichNode };

const dictionaries: Record<Locale, Dictionary> = { pt, en };

/**
 * Full dictionary — server components only. Importing it from a client
 * component would ship every string of both sections and the case studies to
 * the browser; use `getClientDictionary` for anything under `"use client"`.
 */
export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

/**
 * The subset the interactive shell actually needs. Passed once through
 * `<LocaleProvider>` so client components read it from context instead of
 * threading props through the whole tree — and so the RSC payload carries only
 * these strings, not the entire dictionary.
 */
export function getClientDictionary(locale: Locale) {
  const dict = dictionaries[locale];
  return {
    common: dict.common,
    nav: dict.nav,
    commandMenu: dict.commandMenu,
    contactForm: dict.contact.form,
    easterEggs: dict.easterEggs,
    anomalies: dict.anomalies,
    shell: dict.shell,
    // The footer is rendered from inside `SiteChrome`, which is a client
    // module — so its copy has to travel with the client slice.
    footer: dict.footer,
    // `not-found.tsx` receives no route params, so the 404 reads its copy from
    // context instead — that is the only place the active locale still exists.
    notFound: dict.notFound,
  };
}

export type ClientDictionary = ReturnType<typeof getClientDictionary>;
