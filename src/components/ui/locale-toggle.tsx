"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { defaultLocale, type Locale } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/locale-provider";
import { switchLocalePath } from "@/lib/i18n/routes";

/**
 * Swaps locale while staying on the same page. The label and code come from the
 * active dictionary but describe the locale being *offered* — importing the
 * other dictionary here would ship both languages to the browser.
 *
 * A real `<Link>` rather than a client-side swap: the locale is a route
 * segment, so navigation is the only thing that re-renders the server tree with
 * the right dictionary, metadata and `<html lang>`.
 */
export function LocaleToggle({ className }: { className?: string }) {
  const { locale, dict } = useI18n();
  const pathname = usePathname();
  const target: Locale = locale === defaultLocale ? "en" : defaultLocale;

  return (
    <Link
      href={switchLocalePath(pathname, target)}
      hrefLang={target}
      aria-label={dict.common.switchLanguage}
      title={dict.common.switchLanguage}
      className={cn(
        "rounded-sm border-ash text-smoke hover:border-signal hover:text-bone inline-flex h-9 items-center justify-center border px-3 font-mono text-xs tracking-[0.08em] uppercase transition-colors duration-200",
        className,
      )}
    >
      {dict.common.otherLocaleShort}
    </Link>
  );
}
