/**
 * The shell's vocabulary, shared by the status line (which only echoes) and
 * the prompt (which runs). Pure functions: no DOM, no React.
 */

export interface ShellProject {
  slug: string;
  title: string;
}

/** What the prompt understands, for completion. Both spellings of the
 *  anomaly list work; the help shows the page's own. */
export const COMMANDS = [
  "help",
  "ls",
  "cd",
  "open",
  "cat",
  "whoami",
  "cv",
  "email",
  "theme",
  "sound",
  "lang",
  "collapse",
  "anomalias",
  "anomalies",
  "curl",
  "git",
  "sudo",
  "echo",
  "clear",
  "exit",
] as const;

export interface CompletionContext {
  /** Directory names, in the page's language. */
  dirs: string[];
  slugs: string[];
  sudoTarget: string;
}

/** Candidates for the last word of `input`. */
export function candidates(input: string, ctx: CompletionContext): string[] {
  const words = input.trimStart().split(/\s+/);
  const token = words[words.length - 1] ?? "";
  if (words.length <= 1) {
    return COMMANDS.filter((command) => command.startsWith(token));
  }
  const pools: Record<string, string[]> = {
    cd: ["~", ...ctx.dirs],
    ls: ctx.dirs.slice(0, 1),
    open: ctx.slugs,
    cat: ["why.txt", "cv.pdf"],
    theme: ["dark", "light"],
    sound: ["on", "off"],
    sudo: [ctx.sudoTarget],
    git: ["log"],
  };
  return (pools[words[0] ?? ""] ?? []).filter((word) => word.startsWith(token));
}

/** Completes the last word: fully when one candidate fits (plus a space, as
 *  a shell does), else to the prefix every candidate shares. */
export function complete(input: string, options: string[]): string {
  const first = options[0];
  if (first === undefined) return input;
  const token = input.split(/\s+/).pop() ?? "";
  const head = input.slice(0, input.length - token.length);
  if (options.length === 1) return `${head}${first} `;
  let prefix = first;
  for (const option of options) {
    while (!option.startsWith(prefix)) prefix = prefix.slice(0, -1);
  }
  return head + (prefix.length > token.length ? prefix : token);
}

/**
 * The command a click on the page amounts to — the status line prints it,
 * so the reader learns the shell without opening it. `dirOf` maps section
 * ids to directory names.
 */
export function commandForLink(
  link: Element,
  dirOf: Record<string, string>,
): string | null {
  const href = link.getAttribute("href") ?? "";
  if (link.hasAttribute("download")) return "wget cv.pdf";
  if (href.startsWith("mailto:")) return "mail edu";
  const hash = /#([\w-]+)$/.exec(href)?.[1];
  const project = /\/projetos\/([\w-]+)/.exec(href)?.[1];
  if (project) {
    return hash === "decisoes"
      ? `cat ${project}/decisions.log`
      : `open ${project}`;
  }
  if (hash && dirOf[hash]) return `cd ~/${dirOf[hash]}`;
  if (/github\.com/.test(href)) return "open github";
  if (/linkedin\.com/.test(href)) return "open linkedin";
  return null;
}
