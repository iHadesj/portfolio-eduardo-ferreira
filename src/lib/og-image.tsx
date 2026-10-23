import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getProject, localizeProject } from "@/lib/projects";
import { siteConfig } from "@/lib/site-config";

/**
 * Shared frame for every generated Open Graph card.
 *
 * Two constraints shape this file:
 *
 * 1. Satori (what `next/og` renders with) supports a subset of CSS — flexbox
 *    only, no CSS custom properties. So the palette is repeated here as
 *    literals instead of reading `@theme`, and the cards are always the dark
 *    terminal theme: a social preview has no viewer preference to follow.
 * 2. Satori cannot read woff2, which is the only format `public/fonts` ships.
 *    `loadFonts` therefore looks for optional TTF/OTF copies and silently falls
 *    back to the built-in face — the layout carries the brand either way.
 */

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

const ABYSS = "#0a0a0c";
const ASH = "#26262c";
const BONE = "#f2f4f8";
const SMOKE = "#9198a5";
const SIGNAL = "#c8cbd4";

const DISPLAY_FONT = "Geist Mono";
const BODY_FONT = "Geist";

/**
 * TODO_EDU: drop TTF or OTF copies of the two brand faces at
 * `public/fonts/og/` and the cards pick them up automatically. Vercel ships
 * both as TTF in the `geist` package; next/font serves woff2 only.
 */
const FONT_FILES = [
  { file: "GeistMono-SemiBold.ttf", name: DISPLAY_FONT, weight: 600 },
  { file: "Geist-Regular.ttf", name: BODY_FONT, weight: 400 },
] as const;

type LoadedFont = {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 600;
  style: "normal";
};

async function loadFonts(): Promise<LoadedFont[]> {
  const dir = path.join(process.cwd(), "public", "fonts", "og");
  const loaded: LoadedFont[] = [];

  for (const font of FONT_FILES) {
    try {
      const buffer = await readFile(path.join(dir, font.file));
      // Copy out of the pooled Node Buffer: `buffer.buffer` is a shared
      // allocation and handing the whole thing to satori would include
      // unrelated bytes.
      const data = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength,
      ) as ArrayBuffer;
      loaded.push({
        name: font.name,
        data,
        weight: font.weight,
        style: "normal",
      });
    } catch {
      // Not provided — the built-in face renders this card instead.
    }
  }

  return loaded;
}

/** Satori has no line clamping worth relying on, so trim before layout. */
function clamp(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

export interface OgCardProps {
  eyebrow: string;
  title: string;
  description: string;
  /** Small mono chips along the bottom — stack, or nothing on the home card. */
  tags?: string[];
  footer: string;
}

export async function renderOgImage({
  eyebrow,
  title,
  description,
  tags = [],
  footer,
}: OgCardProps): Promise<ImageResponse> {
  const fonts = await loadFonts();
  const hasBrandFonts = fonts.length > 0;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "68px 76px",
        backgroundColor: ABYSS,
        backgroundImage: `radial-gradient(900px 620px at 88% 8%, rgba(232,163,61,0.22), rgba(14,12,18,0) 62%), radial-gradient(700px 520px at 6% 96%, rgba(62,124,140,0.16), rgba(14,12,18,0) 60%)`,
        fontFamily: hasBrandFonts ? BODY_FONT : "sans-serif",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            display: "flex",
            fontSize: 22,
            letterSpacing: 4,
            textTransform: "uppercase",
            color: SIGNAL,
          }}
        >
          {eyebrow}
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 26,
            fontSize: title.length > 34 ? 68 : 86,
            lineHeight: 1.03,
            letterSpacing: -2,
            color: BONE,
            fontFamily: hasBrandFonts ? DISPLAY_FONT : "sans-serif",
            fontWeight: 600,
          }}
        >
          {clamp(title, 62)}
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 28,
            maxWidth: 880,
            fontSize: 30,
            lineHeight: 1.42,
            color: SMOKE,
          }}
        >
          {clamp(description, 168)}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", maxWidth: 780 }}>
          {tags.slice(0, 5).map((tag) => (
            <div
              key={tag}
              style={{
                display: "flex",
                marginRight: 12,
                marginTop: 12,
                padding: "9px 16px",
                border: `1px solid ${ASH}`,
                borderRadius: 999,
                fontSize: 21,
                color: SMOKE,
              }}
            >
              {tag}
            </div>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            fontSize: 23,
            color: SMOKE,
          }}
        >
          <div
            style={{
              display: "flex",
              width: 10,
              height: 10,
              marginRight: 14,
              borderRadius: 999,
              backgroundColor: SIGNAL,
            }}
          />
          {footer}
        </div>
      </div>

      {/* Signature signal rule — the one piece every card shares. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 8,
          display: "flex",
          backgroundImage:
            "linear-gradient(90deg, #f2c14e 0%, #e8a33d 45%, #d96c2c 100%)",
        }}
      />
    </div>,
    { ...OG_SIZE, fonts: hasBrandFonts ? fonts : undefined },
  );
}

/** Social card for a locale's home page. */
export function homeOgImage(locale: Locale): Promise<ImageResponse> {
  const dict = getDictionary(locale);
  return renderOgImage({
    eyebrow: dict.meta.ogEyebrow,
    title: siteConfig.name,
    description: siteConfig.role[locale],
    tags: ["Java", "Spring", "React", "TypeScript", "Next.js"],
    footer: `@${siteConfig.handle}`,
  });
}

/** Social card for one case study, in one locale. */
export function caseStudyOgImage(
  locale: Locale,
  slug: string,
): Promise<ImageResponse> {
  const source = getProject(slug);
  if (!source) notFound();

  const project = localizeProject(source, locale);
  const dict = getDictionary(locale);

  return renderOgImage({
    eyebrow: dict.projectPage.ogEyebrow,
    title: project.title,
    description: project.summary,
    tags: project.stack,
    footer: `${siteConfig.name} · @${siteConfig.handle}`,
  });
}
