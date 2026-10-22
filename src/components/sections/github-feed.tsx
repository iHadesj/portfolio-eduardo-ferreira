"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { RepoCard } from "./repo-card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ReposPage } from "@/lib/github";
import { useI18n } from "@/lib/i18n/locale-provider";
import { fill } from "@/lib/i18n/format";

const ARCHIVE_GRID_ID = "github-feed-archive";

async function fetchReposPage(page: number): Promise<ReposPage> {
  const res = await fetch(`/api/github/repos?page=${page}&per_page=9`);
  // Developer-facing only — the UI renders `githubFeed.error` instead.
  if (!res.ok) throw new Error(`GitHub upstream responded ${res.status}`);
  return res.json() as Promise<ReposPage>;
}

/**
 * `cutoff`: ISO do limite da janela recente, calculado no servidor
 * (`recentWindowCutoff`). Por padrão o feed só mostra repos com push depois
 * dele; o resto fica atrás de um clique e volta a carregar 9 em 9, manualmente.
 * `windowMonths` também vem do servidor: importar o valor de `@/lib/github`
 * aqui arrastaria `env.ts` (e o zod inteiro) para o bundle do cliente.
 */
export function GithubFeed({
  initialData,
  cutoff,
  windowMonths,
  intl,
}: {
  initialData: ReposPage;
  cutoff: string;
  windowMonths: number;
  intl: "pt-BR" | "en-US";
}) {
  const { dict } = useI18n();
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    refetch,
    isError,
  } = useInfiniteQuery({
    queryKey: ["repos"],
    queryFn: ({ pageParam }) => fetchReposPage(pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialData: { pages: [initialData], pageParams: [1] },
    staleTime: 60 * 60 * 1000,
  });

  const sentinelRef = useRef<HTMLDivElement>(null);
  const [showArchive, setShowArchive] = useState(false);

  const repos = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data],
  );

  // Upstream sorts by last push (desc), so a single boundary splits the
  // accumulated list. Compared as timestamps, not strings: GitHub sends
  // `...:00Z` while toISOString() sends `...:00.000Z`.
  const boundary = useMemo(() => {
    const cutoffMs = Date.parse(cutoff);
    const index = repos.findIndex((r) => Date.parse(r.pushedAt) < cutoffMs);
    return index === -1 ? repos.length : index;
  }, [repos, cutoff]);

  const recent = repos.slice(0, boundary);
  const older = repos.slice(boundary);

  // Recent window exhausted: an out-of-window repo showed up, or upstream ended.
  const reachedCutoff = older.length > 0 || !hasNextPage;
  const autoLoad = !reachedCutoff;

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage || !autoLoad) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { rootMargin: "600px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, autoLoad]);

  // initialData is empty AND the query errored → upstream is down.
  if (status === "error" && repos.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-lg border border-ash bg-basalt p-10 text-center">
        <p className="text-smoke">{dict.githubFeed.error}</p>
        <button
          type="button"
          onClick={() => void refetch()}
          data-cursor="hover"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        >
          {dict.githubFeed.retry}
        </button>
      </div>
    );
  }

  // One button, one DOM position: revealing the archive swaps its label instead
  // of unmounting it, so keyboard focus survives the transition.
  const isArchiveToggle = !autoLoad && !showArchive;
  const action = isArchiveToggle
    ? {
        label: dict.githubFeed.showArchive,
        onClick: () => setShowArchive(true),
        visible: older.length > 0 || hasNextPage,
        disabled: false,
      }
    : {
        label: isFetchingNextPage
          ? dict.githubFeed.loading
          : dict.githubFeed.loadMore,
        onClick: () => void fetchNextPage(),
        visible: hasNextPage,
        disabled: isFetchingNextPage,
      };

  return (
    <div className="flex flex-col gap-6">
      {recent.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recent.map((repo) => (
            <RepoCard key={repo.url} repo={repo} intl={intl} />
          ))}
        </div>
      ) : (
        <p className="text-smoke text-center font-mono text-xs">
          {fill(dict.githubFeed.emptyWindow, {
            months: windowMonths,
          })}
        </p>
      )}

      {/* Always mounted so `aria-controls` on the toggle resolves to a real
          node; `hidden` is what the toggle flips. No display utility here on
          purpose — an author `display` would outrank the UA `[hidden]` rule,
          hence the margin-based spacing inside. */}
      <div id={ARCHIVE_GRID_ID} hidden={!showArchive}>
        {older.length > 0 ? (
          <p className="text-smoke mb-6 font-mono text-xs tracking-widest uppercase">
            {dict.githubFeed.archiveLabel}
          </p>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {older.map((repo) => (
            <RepoCard key={repo.url} repo={repo} intl={intl} />
          ))}
        </div>
      </div>

      {action.visible ? (
        <div ref={sentinelRef} className="flex justify-center">
          <button
            type="button"
            onClick={action.onClick}
            disabled={action.disabled}
            aria-expanded={isArchiveToggle ? false : undefined}
            aria-controls={isArchiveToggle ? ARCHIVE_GRID_ID : undefined}
            data-cursor="hover"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            {action.label}
          </button>
        </div>
      ) : (
        <p className="text-smoke text-center font-mono text-xs">
          {isError ? dict.githubFeed.loadError : dict.githubFeed.endOfArchive}
        </p>
      )}
    </div>
  );
}
