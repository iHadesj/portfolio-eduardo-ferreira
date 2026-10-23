"use client";

import { Star } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import type { RepoDTO } from "@/lib/github";
import { useI18n } from "@/lib/i18n/locale-provider";

export function RepoCard({
  repo,
  intl,
}: {
  repo: RepoDTO;
  intl: "pt-BR" | "en-US";
}) {
  const { dict } = useI18n();

  return (
    <a
      href={repo.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group hover:border-signal/40 hover:glow-signal flex flex-col gap-3 rounded-lg border border-ash bg-basalt p-5 transition-colors duration-200"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-bone group-hover:text-signal font-mono text-sm transition-colors">
          {repo.name}
        </h3>
        {repo.stars > 0 ? (
          <span className="text-smoke inline-flex items-center gap-1 text-xs">
            <Star size={12} strokeWidth={1.5} />
            {repo.stars}
          </span>
        ) : null}
      </div>

      <p className="text-smoke line-clamp-2 min-h-[2.5em] text-sm">
        {repo.description ?? dict.githubFeed.noDescription}
      </p>

      <div className="text-smoke mt-auto flex items-center justify-between gap-3 text-xs">
        <span className="inline-flex items-center gap-1.5">
          {repo.language ? (
            <>
              <span aria-hidden className="bg-smoke size-1.5" />
              {repo.language}
            </>
          ) : null}
        </span>
        {/* The page is prerendered, so this label is baked at build time and
            recomputed at hydration — "há 45 minutos" vs "há 47 minutos" is a
            real text mismatch (React #418). The difference is intentional and
            harmless for a live timestamp, which is exactly what
            suppressHydrationWarning is for; the client value wins and stays
            accurate. `dateTime` keeps the machine-readable instant. */}
        <time dateTime={repo.pushedAt} suppressHydrationWarning>
          {formatRelativeTime(repo.pushedAt, intl)}
        </time>
      </div>
    </a>
  );
}
