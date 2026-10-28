"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useToast } from "@/components/ui/toast";
import { useSmoothScroll } from "@/hooks/use-smooth-scroll";
import { useViewTransitionRouter } from "@/hooks/use-view-transition-router";
import { ANOMALIES, discover, foundAnomalies } from "@/lib/anomalies";
import { siteConfig } from "@/lib/site-config";
import { defaultLocale } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/locale-provider";
import { fill } from "@/lib/i18n/format";
import {
  localePath,
  projectPath,
  sectionPath,
  switchLocalePath,
} from "@/lib/i18n/routes";
import { downloadFile } from "@/lib/utils";
import { candidates, complete, type ShellProject } from "./commands";

type Tone = "ok" | "err" | "dim" | "path";
interface Line {
  text: string;
  tone?: Tone;
  /** A line that runs a command when chosen (e.g. a project in `ls`). */
  run?: string;
}
interface Entry {
  id: number;
  /** The command, echoed after the prompt; absent for the welcome line. */
  input?: string;
  lines: Line[];
}

/* Kept for the page's lifetime, so ↑ still finds yesterday's command after
   the shell is closed and opened again. */
const history: string[] = [];

/**
 * The shell: a real prompt over the page, as a modal <dialog> docked to the
 * foot of the screen (focus stays inside, Esc closes, focus returns to the
 * status line). It navigates the page — `cd` scrolls to a section, `open`
 * opens a case study — and answers the rest in place: `ls`, `cat why.txt`,
 * `whoami`, `anomalias`, `theme`, `lang`, `collapse`, `sudo contratar-edu`.
 * Nobody has to type: the chips under the output are the likely next
 * commands, and Tab completes, ↑/↓ walk the history.
 */
export function Shell({
  projects,
  onClose,
  onEcho,
}: {
  projects: ShellProject[];
  onClose: () => void;
  /** Prints a command on the status line, for the ones that leave. */
  onEcho: (command: string) => void;
}) {
  const { locale, dict } = useI18n();
  const t = dict.shell;
  const pathname = usePathname();
  const { setTheme, resolvedTheme } = useTheme();
  const { toast } = useToast();
  const scrollTo = useSmoothScroll();
  const navigate = useViewTransitionRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);
  const cursor = useRef(-1);
  const [entries, setEntries] = useState<Entry[]>(() => [
    { id: 0, lines: [{ text: t.welcome, tone: "dim" }] },
  ]);
  const [value, setValue] = useState("");

  const dirs = Object.entries(t.dirs);
  const context = {
    dirs: dirs.map(([, name]) => name),
    slugs: projects.map((project) => project.slug),
    sudoTarget: t.sudoTarget,
  };
  const onHome = !/\/projetos\//.test(pathname);
  const host = new URL(siteConfig.url).host;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    inputRef.current?.focus();
    discover("terminal");
    return () => dialog.close();
  }, []);

  useEffect(() => {
    const output = outputRef.current;
    if (output) output.scrollTop = output.scrollHeight;
  }, [entries]);

  /** Go to a section: scroll there on the home page, navigate elsewhere. */
  const goTo = (id: string) => {
    if (onHome) scrollTo(`#${id}`);
    else navigate(sectionPath(locale, `#${id}`));
  };

  /** Close the shell, then act — so what changes is what the reader sees. */
  const leave = (command: string, action: () => void) => {
    onEcho(command);
    onClose();
    window.setTimeout(action, 60);
  };

  const run = (raw: string) => {
    const input = raw.trim();
    setValue("");
    cursor.current = -1;
    if (!input) return;
    history.push(input);
    const [name = "", ...args] = input.split(/\s+/);
    const arg = args.join(" ");
    const lines: Line[] = [];
    const say = (...more: Line[]) => lines.push(...more);
    const print = () =>
      setEntries((previous) => [
        ...previous,
        { id: nextId.current++, input, lines },
      ]);

    switch (name.toLowerCase()) {
      case "help":
        for (const [command = "", what = ""] of t.help) {
          say({ text: `${command.padEnd(20)}${what}` });
        }
        break;

      case "ls": {
        const target = arg.replace(/^~\/?/, "").replace(/\/$/, "");
        if (!target) {
          say({
            text: [
              ...context.dirs.map((dir) => `${dir}/`),
              "why.txt",
              "cv.pdf",
            ].join("  "),
            tone: "path",
          });
        } else if (target === t.dirs.projetos) {
          for (const project of projects) {
            say({
              text: project.slug,
              tone: "path",
              run: `open ${project.slug}`,
            });
          }
          say({ text: t.lsHint, tone: "dim" });
        } else {
          say({ text: fill(t.noDir, { dir: target }), tone: "err" });
        }
        break;
      }

      case "cd": {
        const target = arg.replace(/^~\/?/, "").replace(/\/$/, "");
        if (!target || target === "..") {
          leave("cd ~", () =>
            onHome ? scrollTo("#hero") : navigate(localePath(locale, "/")),
          );
          return;
        }
        const id = dirs.find(([, dir]) => dir === target)?.[0];
        if (!id) {
          say({ text: fill(t.noDir, { dir: target }), tone: "err" });
          break;
        }
        leave(`cd ~/${target}`, () => goTo(id));
        return;
      }

      case "open": {
        const query = arg.toLowerCase();
        if (query === "github" || query === "linkedin") {
          // Opened while the keypress still counts as the reader's gesture.
          window.open(siteConfig.links[query], "_blank", "noopener,noreferrer");
          say({ text: siteConfig.links[query], tone: "path" });
          break;
        }
        const project =
          projects.find((p) => p.slug === query) ??
          projects.find(
            (p) =>
              query.length > 1 &&
              (p.slug.startsWith(query) ||
                p.title.toLowerCase().includes(query)),
          );
        if (!project) {
          say({
            text: fill(t.noProject, { name: arg, dir: t.dirs.projetos }),
            tone: "err",
          });
          break;
        }
        leave(`open ${project.slug}`, () =>
          navigate(projectPath(locale, project.slug)),
        );
        return;
      }

      case "cat":
        if (arg === "why.txt") {
          say(...siteConfig.why.map((text) => ({ text })));
          discover("why");
        } else if (arg === "cv.pdf") {
          downloadFile(siteConfig.cvUrl, siteConfig.cvFileName);
          say({ text: t.cv, tone: "ok" });
        } else {
          say({ text: fill(t.noFile, { file: arg || "?" }), tone: "err" });
        }
        break;

      case "whoami": {
        const availability = siteConfig.availability.open
          ? t.availability.open
          : t.availability.closed;
        say(
          ...t.whoami.map((text) => ({ text: fill(text, { availability }) })),
        );
        break;
      }

      case "cv":
        downloadFile(siteConfig.cvUrl, siteConfig.cvFileName);
        say({ text: t.cv, tone: "ok" });
        break;

      case "email":
      case "mail":
        void navigator.clipboard?.writeText(siteConfig.email);
        toast(dict.common.emailCopied);
        say({ text: fill(t.email, { email: siteConfig.email }), tone: "ok" });
        break;

      case "theme": {
        const theme =
          arg === "dark" || arg === "light"
            ? arg
            : resolvedTheme === "light"
              ? "dark"
              : "light";
        setTheme(theme);
        say({ text: fill(t.theme, { theme }), tone: "ok" });
        break;
      }

      case "lang": {
        const target = locale === defaultLocale ? "en" : defaultLocale;
        leave("lang", () => navigate(switchLocalePath(pathname, target)));
        return;
      }

      case "collapse":
        // The stage marks its trigger live once the scene runs; without it
        // (another page, reduced motion, no WebGL) there is nothing to pull.
        if (!document.querySelector(".hole-trigger--live")) {
          say({ text: t.collapseOff, tone: "dim" });
          break;
        }
        leave("collapse", () => {
          scrollTo("#hero");
          window.setTimeout(
            () => window.dispatchEvent(new Event("hole:collapse")),
            700,
          );
        });
        return;

      case "anomalias":
      case "anomalies": {
        const found = foundAnomalies();
        say({
          text: fill(t.anomalies, {
            count: found.length,
            total: ANOMALIES.length,
          }),
        });
        for (const id of ANOMALIES) {
          say(
            found.includes(id)
              ? { text: `[x] ${dict.anomalies.names[id]}`, tone: "ok" }
              : { text: "[ ] ???", tone: "dim" },
          );
        }
        break;
      }

      case "curl":
        say(
          { text: t.curl, tone: "dim" },
          { text: `$ curl ${host}`, tone: "path" },
        );
        break;

      case "git":
        leave("git log --graph", () => goTo("trajetoria"));
        return;

      case "sudo":
        if (
          arg === t.sudoTarget ||
          arg === "contratar-edu" ||
          arg === "hire-edu"
        ) {
          say(
            { text: t.sudoPrompt, tone: "dim" },
            { text: t.sudoOk, tone: "ok" },
          );
          discover("sudo");
          print();
          window.setTimeout(
            () => leave(`sudo ${arg}`, () => goTo("contato")),
            900,
          );
          return;
        }
        say({ text: t.sudoDenied, tone: "err" });
        break;

      case "echo":
        say({ text: arg });
        break;

      case "clear":
        setEntries([]);
        return;

      case "exit":
        onClose();
        return;

      default:
        say({ text: fill(t.notFound, { cmd: name }), tone: "err" });
    }
    print();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Tab") {
      event.preventDefault();
      setValue((current) => complete(current, candidates(current, context)));
    } else if (event.key === "ArrowUp") {
      if (history.length === 0) return;
      event.preventDefault();
      cursor.current =
        cursor.current < 0
          ? history.length - 1
          : Math.max(0, cursor.current - 1);
      setValue(history[cursor.current] ?? "");
    } else if (event.key === "ArrowDown") {
      if (cursor.current < 0) return;
      event.preventDefault();
      cursor.current += 1;
      if (cursor.current >= history.length) {
        cursor.current = -1;
        setValue("");
      } else {
        setValue(history[cursor.current] ?? "");
      }
    } else if (event.key === "l" && event.ctrlKey) {
      event.preventDefault();
      setEntries([]);
    }
  };

  const chips = value.trim()
    ? candidates(value, context)
        .slice(0, 6)
        .map((option) => complete(value, [option]).trim())
    : [
        "help",
        "ls",
        `cd ${t.dirs.projetos}`,
        "cat why.txt",
        "whoami",
        `sudo ${t.sudoTarget}`,
      ];

  return (
    <dialog
      ref={dialogRef}
      aria-label={t.label}
      className="shell"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // A click on the backdrop lands on the dialog itself.
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div className="shell__frame">
        <div className="shell__bar">
          <span aria-hidden>hades@grajau: ~</span>
          <button type="button" onClick={onClose} aria-label={t.close}>
            [x]
          </button>
        </div>

        <div ref={outputRef} className="shell__output" aria-live="polite">
          {entries.map((entry) => (
            <div key={entry.id} className="shell__entry">
              {entry.input !== undefined ? (
                <p className="shell__echo">
                  <span aria-hidden className="text-term-green">
                    ${" "}
                  </span>
                  {entry.input}
                </p>
              ) : null}
              {entry.lines.map((line, index) => {
                const command = line.run;
                return command ? (
                  <button
                    key={index}
                    type="button"
                    className="shell__line"
                    data-tone={line.tone}
                    onClick={() => run(command)}
                  >
                    {line.text}
                  </button>
                ) : (
                  <p key={index} className="shell__line" data-tone={line.tone}>
                    {line.text}
                  </p>
                );
              })}
            </div>
          ))}
        </div>

        <div className="shell__chips" role="group" aria-label={t.suggestions}>
          {chips.map((chip) => (
            <button key={chip} type="button" onClick={() => run(chip)}>
              {chip}
            </button>
          ))}
        </div>

        <form
          className="shell__input"
          onSubmit={(event) => {
            event.preventDefault();
            run(value);
          }}
        >
          <label htmlFor="shell-input" className="shell__prompt">
            <span aria-hidden>
              <span className="text-term-green">hades@grajau</span>:
              <span className="text-term-blue">~</span>$
            </span>
            <span className="sr-only">{t.inputLabel}</span>
          </label>
          <input
            id="shell-input"
            ref={inputRef}
            value={value}
            onChange={(event) => {
              cursor.current = -1;
              setValue(event.target.value);
            }}
            onKeyDown={onKeyDown}
            placeholder={t.placeholder}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
          />
        </form>
      </div>
    </dialog>
  );
}
