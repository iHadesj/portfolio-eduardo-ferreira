import {
  HEAT_INKS,
  idleView,
  rasterizeHole,
} from "@/components/three/black-hole";
import { siteConfig } from "@/lib/site-config";
import { localizedProjects } from "@/lib/projects";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { fill } from "@/lib/i18n/format";
import { projectPath } from "@/lib/i18n/routes";
import type { Locale } from "@/lib/i18n/config";

/**
 * What a terminal gets from the site (`curl edu-ferreira.vercel.app`, see
 * app/api/terminal and the rewrites in next.config.ts): the home page as
 * text — the black hole traced by the same ray marcher as the poster, whoami,
 * why.txt, the projects with their lead decision, contact — and with `/cv`
 * the résumé. ANSI-coloured, 80 columns wide.
 *
 * There is no CSS on the far side of a pipe, so the colours are spelled out
 * here; they mirror the dark theme's tokens in app/globals.css.
 */

const WIDTH = 78;
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

const INK = {
  bone: "#f2f4f8",
  smoke: "#9198a5",
  green: "#5af78e",
  blue: "#57c7ff",
  yellow: "#f3f99d",
} as const;

const HEAT: Record<(typeof HEAT_INKS)[number], string> = {
  ember: "#ff4b1f",
  flame: "#ff8a2b",
  gold: "#ffc764",
  white: "#fff4e2",
  blue: "#cfe0ff",
};

/** 24-bit foreground colour. */
function fg(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `\x1b[38;2;${(n >> 16) & 255};${(n >> 8) & 255};${n & 255}m`;
}

const paint = (hex: string, text: string, bold = false) =>
  `${fg(hex)}${bold ? BOLD : ""}${text}${RESET}`;

/** Word-wraps plain text (no escapes) to WIDTH, hanging `indent` after the
 *  first line. */
function wrap(text: string, indent = ""): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const lead = lines.length === 0 ? "" : indent;
    if (line && (lead + line + " " + word).length > WIDTH) {
      lines.push(lead + line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push((lines.length === 0 ? "" : indent) + line);
  return lines;
}

/** The hole at 72 × 24 cells — a terminal cell is about as tall as two are
 *  wide, the same 0.6 × 1.2 em cell the poster is laid out on. */
function holeArt(): string[] {
  const cols = 72;
  const rows = 24;
  const layers = rasterizeHole({ cols, rows }, idleView(0)).map((layer) =>
    layer.split("\n"),
  );
  const lines: { text: string; inked: boolean }[] = [];
  for (let r = 0; r < rows; r += 1) {
    let line = "";
    let ink = -1;
    let inked = false;
    for (let col = 0; col < cols; col += 1) {
      let glyph = " ";
      let layer = -1;
      layers.forEach((rowsOfLayer, index) => {
        const cell = rowsOfLayer[r]?.[col];
        if (cell && cell !== " ") {
          glyph = cell;
          layer = index;
        }
      });
      const name = HEAT_INKS[layer];
      if (name && layer !== ink) {
        line += fg(HEAT[name]);
        ink = layer;
      }
      if (glyph !== " ") inked = true;
      line += glyph;
    }
    lines.push({ text: `  ${line.trimEnd()}${RESET}`, inked });
  }
  // Rows with no glyph at all, top and bottom, are just air.
  while (lines.length && !lines[0]?.inked) lines.shift();
  while (lines.length && !lines[lines.length - 1]?.inked) lines.pop();
  return lines.map((line) => line.text);
}

const prompt = (command: string) =>
  `${paint(INK.green, "hades@grajau")}:${paint(INK.blue, "~")}$ ${command}`;

function host(): string {
  return new URL(siteConfig.url).host;
}

/** `curl <host>`: the home page, as text. */
export function renderHome(locale: Locale): string {
  const dict = getDictionary(locale);
  const t = dict.terminal;
  const out: string[] = ["", ...holeArt(), ""];

  out.push(prompt("whoami"));
  const availability = siteConfig.availability.open
    ? dict.shell.availability.open
    : dict.shell.availability.closed;
  for (const line of dict.shell.whoami) {
    out.push(paint(INK.bone, fill(line, { availability })));
  }

  out.push("", prompt("cat why.txt"));
  siteConfig.why.forEach((line, index, all) => {
    out.push(paint(index === all.length - 1 ? INK.bone : INK.smoke, line));
  });

  out.push("", prompt(`ls ${dict.shell.dirs.projetos}`));
  for (const project of localizedProjects(locale)) {
    const dot =
      project.status === "shipped"
        ? paint(INK.green, "●")
        : project.status === "in-progress"
          ? paint(INK.yellow, "○")
          : paint(INK.smoke, "○");
    out.push(`${dot} ${paint(INK.bone, project.title, true)}`);
    const lead = project.decisions[0];
    if (lead) {
      for (const line of wrap(`+ ${lead.choice}`, "    ")) {
        out.push(paint(INK.green, `  ${line}`));
      }
    }
    out.push(
      paint(
        INK.blue,
        `  ${siteConfig.url}${projectPath(locale, project.slug)}`,
      ),
    );
  }

  out.push("", prompt(`cat ${dict.shell.dirs.contato}`));
  out.push(
    `${paint(INK.smoke, "e-mail  ")} ${siteConfig.email}`,
    `${paint(INK.smoke, "github  ")} ${siteConfig.links.github}`,
    `${paint(INK.smoke, "linkedin")} ${siteConfig.links.linkedin}`,
  );

  out.push(
    "",
    paint(INK.smoke, fill(t.cvHint, { host: host() })),
    paint(INK.smoke, t.shellHint),
    "",
    paint(INK.smoke, fill(t.signoff, { host: host() })),
    "",
  );
  return out.join("\n");
}

/** Lanes of the trajectory that are work, and the ones that are study. */
const WORK = ["vtt", "projetos"];
const STUDY = ["estacio", "ebac"];

/** `curl <host>/cv`: the résumé, as text. */
export function renderCv(locale: Locale): string {
  const dict = getDictionary(locale);
  const t = dict.terminal;
  const out: string[] = [
    "",
    paint(INK.bone, siteConfig.name.toUpperCase(), true),
    paint(INK.smoke, siteConfig.role[locale]),
    paint(
      INK.smoke,
      [
        siteConfig.email,
        siteConfig.links.github.replace(/^https?:\/\//, ""),
        siteConfig.links.linkedin.replace(/^https?:\/\/(www\.)?/, ""),
      ].join(" · "),
    ),
  ];

  const section = (title: string) =>
    out.push("", paint(INK.green, `## ${title}`));
  const story = (ids: string[]) => {
    for (const id of ids) {
      const item = dict.experience.items.find((entry) => entry.id === id);
      if (!item) continue;
      out.push(
        "",
        `${paint(INK.bone, item.role, true)}${item.org ? paint(INK.smoke, ` · ${item.org}`) : ""}`,
        paint(INK.smoke, item.period),
      );
      for (const bullet of item.bullets) {
        out.push(...wrap(`- ${bullet}`, "  "));
      }
      out.push(paint(INK.blue, item.stack.join(" · ")));
    }
  };

  section(t.experience);
  story(WORK);
  section(t.education);
  story(STUDY);

  section(t.projects);
  for (const project of localizedProjects(locale)) {
    out.push(
      "",
      `${paint(INK.bone, project.title, true)} ${paint(INK.smoke, `· ${project.stack.join(", ")}`)}`,
      ...wrap(project.summary),
      paint(INK.blue, `${siteConfig.url}${projectPath(locale, project.slug)}`),
    );
  }

  section(t.stack);
  out.push(siteConfig.stack.join(" · "));

  out.push(
    "",
    paint(
      INK.smoke,
      fill(t.pdf, { url: `${siteConfig.url}${siteConfig.cvUrl}` }),
    ),
    "",
  );
  return out.join("\n");
}
