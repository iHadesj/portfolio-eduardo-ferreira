"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/locale-provider";
import { localePath } from "@/lib/i18n/routes";

/**
 * Shared body of every 404.
 *
 * Client component because `not-found.tsx` files receive no route params — the
 * locale context the layout established is the only place the active language
 * still exists at that point.
 */
export function NotFoundView() {
  const { locale, dict } = useI18n();

  return (
    <main
      id="conteudo"
      className="container-hades flex min-h-dvh flex-col items-center justify-center gap-6 text-center"
    >
      <p className="text-label text-signal font-mono uppercase">
        {dict.notFound.eyebrow}
      </p>
      <h1 className="font-display text-hero text-bone">
        {dict.notFound.title}
      </h1>
      <p className="prose-measure text-smoke">{dict.notFound.description}</p>
      <Link
        href={localePath(locale, "/")}
        className={cn(buttonVariants({ variant: "primary", size: "lg" }))}
      >
        {dict.notFound.cta}
      </Link>
    </main>
  );
}
