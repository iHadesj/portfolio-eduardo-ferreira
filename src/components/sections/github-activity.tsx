import { SectionHeading } from "@/components/ui/section-heading";
import {
  fetchContributions,
  fetchRepos,
  RECENT_WINDOW_MONTHS,
  recentWindowCutoff,
  type ReposPage,
} from "@/lib/github";
import { GithubFeed } from "./github-feed";
import { ContributionsHeatmap } from "./contributions-heatmap";
import { ScrollSection } from "@/components/layout/scroll-flow";
import type { Locale } from "@/lib/i18n/config";
import { intlLocale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/**
 * Server component: fetches page 1 + the heatmap directly via lib/github, so the
 * section never renders empty and the feed hydrates with initialData (no CLS).
 */
export async function GithubActivity({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  let initial: ReposPage = { items: [], nextPage: null };
  try {
    initial = await fetchRepos(1, 9);
  } catch {
    // Graceful: the feed shows its error/empty state without breaking the page.
  }
  const contributions = await fetchContributions();
  // A página é ISR (revalidate 3600), então o corte fica no máximo 1h defasado —
  // irrelevante numa janela de 18 meses, e vale a determinismo na hidratação.
  const cutoff = recentWindowCutoff();

  return (
    <ScrollSection
      lean={1}
      id="github"
      className="container-hades section-pad scroll-mt-24"
      flowStrength={18}
    >
      <SectionHeading
        eyebrow={dict.github.eyebrow}
        title={dict.github.title}
        description={dict.github.description}
      />

      {contributions ? (
        <div className="mt-10">
          <ContributionsHeatmap
            data={contributions}
            dict={dict}
            intl={intlLocale[locale]}
          />
        </div>
      ) : null}

      <div className="mt-10">
        <GithubFeed
          initialData={initial}
          cutoff={cutoff}
          windowMonths={RECENT_WINDOW_MONTHS}
          intl={intlLocale[locale]}
        />
      </div>
    </ScrollSection>
  );
}
