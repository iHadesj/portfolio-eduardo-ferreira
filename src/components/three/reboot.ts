import { fill } from "@/lib/i18n/format";

/**
 * The hero coming back after the collapse, as a terminal would bring it
 * back: a few kernel-log lines print where the hero was (how much was
 * absorbed, the horizon holding, the rebuild running to `[ ok ]`), the
 * screen clears, the prompt comes back and `whoami` is typed into it at a
 * person's pace — and the hero prints out as that command's output, in
 * reading order, at console speed: the name one letter at a time, the rest
 * line by line, a green block cursor riding the edge of the text, each
 * character flickering through noise before it settles.
 *
 * The real elements do the printing: each is revealed by a clip-path that
 * follows its own characters (measured once, a Range each), so nothing
 * reflows and what shows is the actual text. Only monospaced text flickers
 * (`data-pull-decode`): swapping characters there cannot move a thing.
 */

/** When the log's lines print, its progress dots run, and it clears (s). */
const LOG_LINES = [0, 0.1, 0.2];
const DOTS_UNTIL = 0.58;
const LOG_OK = 0.62;
const LOG_CLEAR = 0.86;
/** How many progress dots the rebuild line runs to. */
const DOTS = 8;
/** Console output speed, characters per second. */
const CPS = 950;
/** The name prints a letter at a time, then a breath. */
const LETTER = 0.042;
const NAME_PAUSE = 0.12;
/** A person typing the command: seconds per key, and Enter. */
const KEY_MIN = 0.06;
const KEY_MAX = 0.13;
const ENTER = 0.24;
/** How long a character flickers through noise before it settles (s). */
const SETTLE = 0.07;
/** Drawn-in pieces with no text (the rule): one quick sweep (s). */
const SWEEP = 0.14;
const NOISE = "!=+*ix1IX3A#5HSG98&@$";

export interface RebootCopy {
  /** "singularity: {count} objects absorbed" — the part up to the colon is
      the source, as in a kernel log. */
  absorbed: string;
  stable: string;
  restoring: string;
}

export interface RebootItem {
  el: HTMLElement;
  /** The name's letters (collapse wave 3): printed one at a time. */
  letter: boolean;
  /** Monospaced text: may flicker. */
  decode: boolean;
  /** The prompt: its `data-pull-instant` part appears at once, the rest is
      typed like a person would. */
  command: boolean;
}

export interface Reboot {
  /** Advance; false once everything is back. */
  step(dt: number): boolean;
  /** Show everything now (skip, reset). */
  finish(): void;
}

interface Char {
  /** Element-local px. */
  left: number;
  right: number;
  top: number;
  bottom: number;
  line: number;
  /** When it appears (s). */
  at: number;
  node: number;
  offset: number;
  quiet: boolean;
}

interface Print {
  el: HTMLElement;
  /** Border box, page px. */
  x: number;
  y: number;
  w: number;
  h: number;
  chars: Char[];
  lines: { top: number; bottom: number }[];
  texts: { node: Text; text: string }[];
  decode: boolean;
  start: number;
  end: number;
  sweep: boolean;
  shown: boolean;
  done: boolean;
  noisy: boolean;
}

const clamp = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const noise = () => NOISE[Math.floor(Math.random() * NOISE.length)] ?? "#";

function measure(item: RebootItem): Print {
  const { el } = item;
  const box = el.getBoundingClientRect();
  const texts: Print["texts"] = [];
  const chars: Char[] = [];
  const range = document.createRange();
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as Text;
    if (!text.data) continue;
    const index = texts.push({ node: text, text: text.data }) - 1;
    const instant =
      item.command && !!text.parentElement?.closest("[data-pull-instant]");
    for (let i = 0; i < text.data.length; i += 1) {
      range.setStart(text, i);
      range.setEnd(text, i + 1);
      const rect = range.getBoundingClientRect();
      if (!rect.width && !rect.height) continue;
      chars.push({
        left: rect.left - box.left,
        right: rect.right - box.left,
        top: rect.top - box.top,
        bottom: rect.bottom - box.top,
        line: 0,
        at: instant ? -1 : 0,
        node: index,
        offset: i,
        quiet: instant || !(text.data[i] ?? " ").trim(),
      });
    }
  }
  // Lines: characters whose tops agree (within half a line).
  const lines: Print["lines"] = [];
  for (const ch of chars) {
    const height = ch.bottom - ch.top;
    let line = lines.findIndex(
      ({ top }) => Math.abs(top - ch.top) < height / 2,
    );
    if (line < 0) line = lines.push({ top: ch.top, bottom: ch.bottom }) - 1;
    const current = lines[line];
    if (current) {
      current.top = Math.min(current.top, ch.top);
      current.bottom = Math.max(current.bottom, ch.bottom);
    }
    ch.line = line;
  }
  return {
    el,
    x: box.left + window.scrollX,
    y: box.top + window.scrollY,
    w: box.width,
    h: box.height,
    chars,
    lines,
    texts,
    decode: item.decode && !item.command,
    start: 0,
    end: 0,
    sweep: !chars.length,
    shown: false,
    done: false,
    noisy: false,
  };
}

/** Reading order: rows top to bottom (tops within a few px share a row),
    left to right within a row. */
function readingOrder(prints: Print[]): Print[] {
  const byTop = [...prints].sort((a, b) => a.y - b.y);
  const rows: Print[][] = [];
  for (const print of byTop) {
    const row = rows[rows.length - 1];
    if (row && Math.abs((row[0]?.y ?? 0) - print.y) < 8) row.push(print);
    else rows.push([print]);
  }
  return rows.flatMap((row) => row.sort((a, b) => a.x - b.x));
}

/** `[    1.4420]` — seconds since the collapse, kernel-log style. */
const stamp = (seconds: number) => `[${seconds.toFixed(4).padStart(10)}]`;

export function createReboot(
  items: RebootItem[],
  /** Where the log prints (the hero's text column); none → no log. */
  host: HTMLElement | null,
  copy: RebootCopy,
  /** How many pieces were swallowed, and how long ago it began (s). */
  absorbed: number,
  since: number,
): Reboot {
  for (const { el } of items) {
    el.style.transform = "";
    el.style.opacity = "";
    el.style.visibility = "hidden";
    el.style.clipPath = "";
  }
  const kinds = new Map(items.map((item) => [item.el, item]));
  const prints = readingOrder(items.map(measure));

  // The schedule: one print after another, like a console's output.
  let t = host ? LOG_CLEAR + 0.04 : 0;
  prints.forEach((print, i) => {
    const kind = kinds.get(print.el);
    print.start = t;
    if (kind?.command) {
      let key = t;
      for (const ch of print.chars) {
        if (ch.at < 0) ch.at = t;
        else {
          key += KEY_MIN + Math.random() * (KEY_MAX - KEY_MIN);
          ch.at = key;
        }
      }
      t = key + ENTER;
    } else if (kind?.letter) {
      for (const ch of print.chars) ch.at = t;
      t += LETTER;
      const next = prints[i + 1];
      if (next && !kinds.get(next.el)?.letter) t += NAME_PAUSE;
    } else if (print.sweep) {
      t += SWEEP;
    } else {
      print.chars.forEach((ch, k) => {
        ch.at = t + k / CPS;
      });
      t += print.chars.length / CPS;
    }
    const last = print.chars.reduce((latest, ch) => Math.max(latest, ch.at), t);
    print.end = print.sweep
      ? print.start + SWEEP
      : last + (print.decode ? SETTLE : 0);
  });

  // The log.
  const log = host ? document.createElement("div") : null;
  const logLines: { at: number; build: () => HTMLElement }[] = [];
  // Filled in when the third line prints.
  const progress: { dots: HTMLElement | null; ok: HTMLElement | null } = {
    dots: null,
    ok: null,
  };
  if (log && host) {
    log.className = "hole-console";
    log.setAttribute("aria-hidden", "true");
    host.append(log);
    const line = (at: number, text: string, extra?: (p: HTMLElement) => void) =>
      logLines.push({
        at,
        build: () => {
          const p = document.createElement("p");
          const time = document.createElement("span");
          time.className = "hole-console__time";
          time.textContent = stamp(since + at);
          p.append(time, " ");
          const colon = text.indexOf(":");
          if (colon > 0) {
            const source = document.createElement("span");
            source.className = "hole-console__source";
            source.textContent = text.slice(0, colon + 1);
            p.append(source, text.slice(colon + 1));
          } else {
            p.append(text);
          }
          extra?.(p);
          return p;
        },
      });
    line(LOG_LINES[0] ?? 0, fill(copy.absorbed, { count: absorbed }));
    line(LOG_LINES[1] ?? 0, copy.stable);
    line(LOG_LINES[2] ?? 0, copy.restoring, (p) => {
      const dots = document.createElement("span");
      dots.className = "hole-console__dots";
      const ok = document.createElement("span");
      ok.className = "hole-console__ok";
      p.append(" ", dots, " ", ok);
      progress.dots = dots;
      progress.ok = ok;
    });
  }

  const cursor = document.createElement("div");
  cursor.className = "hole-type-cursor";
  cursor.setAttribute("aria-hidden", "true");
  cursor.hidden = true;
  document.body.append(cursor);

  let clock = 0;
  let printed = 0;
  let logDone = !log;
  let finished = false;

  const clip = (print: Print, x: number, line: number) => {
    const top = line === 0 ? 0 : (print.lines[line]?.top ?? 0);
    const bottom =
      line >= print.lines.length - 1
        ? print.h
        : (print.lines[line]?.bottom ?? print.h);
    const px = (n: number) => `${n.toFixed(1)}px`;
    print.el.style.clipPath =
      line === 0
        ? `polygon(0 0, ${px(x)} 0, ${px(x)} ${px(bottom)}, 0 ${px(bottom)})`
        : `polygon(0 0, ${px(print.w)} 0, ${px(print.w)} ${px(top)}, ${px(x)} ${px(top)}, ${px(x)} ${px(bottom)}, 0 ${px(bottom)})`;
  };

  const restoreText = (print: Print) => {
    if (!print.noisy) return;
    print.noisy = false;
    for (const { node, text } of print.texts) node.data = text;
  };

  const flicker = (print: Print) => {
    let any = false;
    const out = print.texts.map(({ text }) => [...text]);
    for (const ch of print.chars) {
      if (ch.quiet || clock < ch.at || clock >= ch.at + SETTLE) continue;
      const chars = out[ch.node];
      if (chars) chars[ch.offset] = noise();
      any = true;
    }
    if (!any) {
      restoreText(print);
      return;
    }
    print.noisy = true;
    print.texts.forEach(({ node }, i) => {
      node.data = out[i]?.join("") ?? node.data;
    });
  };

  const place = (print: Print, ch: Char | undefined) => {
    if (!ch) return;
    const height = ch.bottom - ch.top;
    const width = Math.max(2, (ch.right - ch.left) * 0.9);
    cursor.hidden = false;
    cursor.style.width = `${width.toFixed(1)}px`;
    cursor.style.height = `${height.toFixed(1)}px`;
    cursor.style.transform = `translate(${(print.x - window.scrollX + ch.right + 1).toFixed(1)}px, ${(print.y - window.scrollY + ch.top).toFixed(1)}px)`;
  };

  const end = () => {
    if (finished) return;
    finished = true;
    for (const print of prints) {
      restoreText(print);
      print.el.style.clipPath = "";
      print.el.style.visibility = "";
    }
    log?.remove();
    cursor.remove();
  };

  return {
    step(dt) {
      if (finished) return false;
      clock += dt;

      // The log, line by line; its dots run, it reports ok, it clears.
      if (log && !logDone) {
        while (
          printed < logLines.length &&
          clock >= (logLines[printed]?.at ?? 0)
        ) {
          const entry = logLines[printed];
          if (entry) log.append(entry.build());
          printed += 1;
        }
        if (progress.dots) {
          const from = LOG_LINES[2] ?? 0;
          const n = Math.floor(
            clamp((clock - from) / (DOTS_UNTIL - from)) * DOTS,
          );
          progress.dots.textContent = ".".repeat(n);
        }
        if (progress.ok && clock >= LOG_OK) progress.ok.textContent = "[ ok ]";
        if (clock >= LOG_CLEAR) {
          log.remove();
          logDone = true;
        }
      }

      let active: { print: Print; ch: Char | undefined } | null = null;
      let pending = false;
      for (const print of prints) {
        if (print.done) continue;
        pending = true;
        if (clock < print.start) continue;
        if (print.sweep) {
          const k = clamp((clock - print.start) / SWEEP);
          print.el.style.visibility = "";
          clip(print, k * print.w, 0);
          if (k >= 1) {
            print.el.style.clipPath = "";
            print.done = true;
          }
          continue;
        }
        let n = 0;
        while (n < print.chars.length && (print.chars[n]?.at ?? 0) <= clock)
          n += 1;
        if (!n) continue;
        if (!print.shown) {
          print.shown = true;
          print.el.style.visibility = "";
        }
        if (n < print.chars.length) {
          const ch = print.chars[n - 1];
          clip(print, ch?.right ?? 0, ch?.line ?? 0);
        } else {
          print.el.style.clipPath = "";
        }
        if (print.decode) flicker(print);
        active = { print, ch: print.chars[n - 1] };
        if (n >= print.chars.length && clock >= print.end) {
          restoreText(print);
          print.done = true;
        }
      }

      // The cursor rides the newest text; between prints it waits,
      // blinking, where it stopped.
      if (active) {
        delete cursor.dataset.idle;
        place(active.print, active.ch);
      } else if (!cursor.hidden) {
        cursor.dataset.idle = "true";
      }

      if (!pending && logDone) {
        end();
        return false;
      }
      return true;
    },

    finish: end,
  };
}
