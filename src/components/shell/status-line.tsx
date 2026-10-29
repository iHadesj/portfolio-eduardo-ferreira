"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useScrollSpy } from "@/hooks/use-scroll-spy";
import { useI18n } from "@/lib/i18n/locale-provider";
import { cue } from "@/lib/sound";
import { commandForLink, type ShellProject } from "./commands";

/* The prompt itself only loads the first time someone opens it. */
const Shell = dynamic(() => import("./shell").then((m) => m.Shell), {
  ssr: false,
});

const SECTIONS = ["projetos", "trajetoria", "sobre", "status", "contato"];
const ECHO_MS = 2600;

/**
 * A tmux-style status line at the foot of every page: where the reader is,
 * as a path that follows the scroll (`~/projetos`, `~/projetos/levva-…` on a
 * case study), and — for a moment after each click on the page — the command
 * that click amounts to (`cd ~/xp`, `open levva-loja-e-sorte`). Tapping it,
 * or pressing `:`, opens the shell. Its top edge doubles as the reading
 * progress bar (a scroll timeline, no JavaScript).
 *
 * Client because it follows the scroll and listens for clicks; it carries
 * no copy of its own beyond the client dictionary slice.
 */
export function StatusLine({ projects }: { projects: ShellProject[] }) {
  const { dict } = useI18n();
  const t = dict.shell;
  const pathname = usePathname();
  const active = useScrollSpy(SECTIONS);
  const [open, setOpen] = useState(false);
  const [echo, setEcho] = useState<string | null>(null);
  const section = useRef(active);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const timer = useRef(0);

  const dirOf: Record<string, string> = t.dirs;
  const slug = /\/projetos\/([^/?#]+)/.exec(pathname)?.[1];
  const path = slug
    ? `~/${dirOf.projetos}/${slug}`
    : active && dirOf[active]
      ? `~/${dirOf[active]}`
      : "~";
  const index = active ? SECTIONS.indexOf(active) + 1 : 0;

  const say = useCallback((command: string) => {
    setEcho(command);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setEcho(null), ECHO_MS);
  }, []);

  // `cd` into each section as the scroll gets there: a short blip.
  useEffect(() => {
    if (active === section.current) return;
    section.current = active;
    if (active) cue("section");
  }, [active]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest("a[href]");
      if (!link || link.closest(".status-line")) return;
      const command = commandForLink(link, dirOf);
      if (command) say(command);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [dirOf, say]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== ":" || event.metaKey || event.ctrlKey || event.altKey)
        return;
      const el = document.activeElement;
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        (el instanceof HTMLElement && el.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(timer.current);
    };
  }, []);

  const prompt = `hades@grajau:${path}$`;

  return (
    <>
      <div className="status-line">
        <span aria-hidden className="status-line__progress" />
        <button
          ref={buttonRef}
          type="button"
          aria-label={`${prompt} — ${t.open}`}
          aria-haspopup="dialog"
          aria-expanded={open}
          data-echo={echo ? "" : undefined}
          onClick={() => setOpen(true)}
          className="status-line__bar"
        >
          <span aria-hidden className="status-line__prompt">
            <span className="text-term-green">hades@grajau</span>:
            <span className="text-term-blue">{path}</span>$
          </span>
          <span aria-hidden className="status-line__echo">
            {echo ? `> ${echo}` : null}
          </span>
          {index ? (
            <span aria-hidden className="status-line__index">
              {`[${index}/${SECTIONS.length}]`}
            </span>
          ) : null}
          <span aria-hidden className="status-line__hint">
            <span className="stage-hint__mouse">{t.hintKey}</span>
            <span className="stage-hint__touch">{t.hintTouch}</span>
          </span>
        </button>
      </div>
      {open ? (
        <Shell
          projects={projects}
          onEcho={say}
          onClose={() => {
            setOpen(false);
            // After the dialog is gone: while it is open the page is inert
            // and would refuse the focus.
            window.requestAnimationFrame(() => buttonRef.current?.focus());
          }}
        />
      ) : null}
    </>
  );
}
