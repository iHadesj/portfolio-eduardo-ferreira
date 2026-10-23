"use client";

import { useI18n } from "@/lib/i18n/locale-provider";

/** First focusable element — jumps screen-reader / keyboard users to content. */
export function SkipLink() {
  const { dict } = useI18n();

  return (
    <a
      href="#conteudo"
      className="focus-visible:border-signal focus-visible:bg-basalt focus-visible:text-bone sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-4 focus-visible:left-4 focus-visible:z-[var(--z-toast)] focus-visible:rounded-md focus-visible:border focus-visible:px-4 focus-visible:py-2 focus-visible:font-mono focus-visible:text-sm"
    >
      {dict.nav.skipToContent}
    </a>
  );
}
