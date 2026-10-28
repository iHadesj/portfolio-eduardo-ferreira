import { Hero } from "@/components/sections/hero";
import { About } from "@/components/sections/about";
import { Projects } from "@/components/sections/projects";
import { Experience } from "@/components/sections/experience";
import { StatusBoard } from "@/components/sections/status-board";
import { Contact } from "@/components/sections/contact";
import { ScrollFlow } from "@/components/layout/scroll-flow";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

/**
 * Home page body, shared by both locale route groups. The route files are thin
 * on purpose: they exist to pin a locale and nothing else.
 *
 * Order follows what proves the most first: the hero already answers who and
 * what stack, so the work comes next and the story comes last.
 *
 * The hero and the projects share a curtain: while the projects come up,
 * the hero holds still under them (motion/scrub-scenes.ts) — the wrapper is
 * what bounds that hold.
 */
export function HomePage({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);

  return (
    <ScrollFlow id="conteudo">
      <div className="hero-curtain">
        <Hero locale={locale} dict={dict} />
        <Projects locale={locale} dict={dict} />
      </div>
      <Experience locale={locale} dict={dict} />
      <About dict={dict} />
      <StatusBoard locale={locale} dict={dict} />
      <Contact locale={locale} dict={dict} />
    </ScrollFlow>
  );
}
