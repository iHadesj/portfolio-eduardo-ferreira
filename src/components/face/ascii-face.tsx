import type { CSSProperties } from "react";
import data from "./face-data.json";

/**
 * The README's `./psycho --train` portrait, in the hero: a head sculpted
 * from signed distance functions and ray marched into glyphs (baked by
 * scripts/ascii-face/generate.mjs), converging epoch by epoch out of a bare
 * wireframe while a mirrored training log climbs the stream of pixels its
 * skull dissolves into. Then the eyes light up and it keeps living: the
 * stream drifts left, edge pixels twinkle, bands of the face glitch now and
 * then, a scan line sweeps down and the eyes breathe.
 *
 * Pure markup and CSS (`.face*` in globals.css): every moving part is its
 * own small layer animating opacity or transform, so none of it touches the
 * main thread. Reduced motion shows the finished face, still. Decorative:
 * the hero copy next to it says who this is.
 */

type Variant = (typeof data)[keyof typeof data];

/** Art units: one cell is 6 × 10, like the README's SVG. */
const CELL_W = 6;
const CELL_H = 10;
/** When the run starts, and how long the epochs take to converge. */
const START = 0.3;
const TRAIN = 2.8;
const DONE = START + TRAIN + 0.3;

/** Rows (as fractions of the height) that glitch sideways now and then. */
const GLITCH_BANDS: readonly (readonly [number, number])[] = [
  [0.18, 0.22],
  [0.43, 0.46],
  [0.68, 0.72],
];

const s = (seconds: number) => `${seconds.toFixed(2)}s`;

function rectsPath(rects: readonly (readonly number[])[]): string {
  return rects
    .map(([c = 0, r = 0, kind = 0, len = 1]) => {
      const x = c * CELL_W;
      const y = r * CELL_H;
      if (kind === 3) {
        return `M${x + 0.5} ${y + 3.2}h${len * CELL_W - 1}v3.6h${1 - len * CELL_W}z`;
      }
      const size = [1.6, 3, 5][kind] ?? 3;
      const pad = (CELL_W - size) / 2;
      return `M${x + pad} ${y + (CELL_H - size) / 2}h${size}v${size}h${-size}z`;
    })
    .join("");
}

function eyesPath(eyes: Variant["eyes"]): string {
  return eyes
    .map(
      (poly) =>
        `M${poly.map(([x = 0, y = 0]) => `${x * CELL_W} ${y * CELL_H}`).join("L")}z`,
    )
    .join("");
}

/** Per-layer motion of the pixel stream once training is done. */
function debrisMotion(layer: string, k: number): CSSProperties {
  const intro = `face-on 0.5s ${s(START + 0.15 * k)} both`;
  const ambient: Record<string, string> = {
    edge: `face-twinkle ${s(2.6 + 0.7 * k)} steps(1) ${s(DONE + 0.4 * k)} infinite`,
    stream: `face-flow 4.2s ease-in ${s(DONE + 1.05 * k)} infinite`,
    wake: `face-flow 6.5s linear ${s(DONE + 2.1 * k)} infinite`,
    stray: `face-twinkle 3.1s steps(1) ${s(DONE)} infinite`,
  };
  return { animation: `${intro}, ${ambient[layer] ?? ""}` };
}

function FaceVariant({ name, art }: { name: string; art: Variant }) {
  const width = art.cols * CELL_W;
  const height = art.rows * CELL_H;
  const early = art.frames.slice(0, -1);
  const finalLines = (art.frames[art.frames.length - 1] ?? "").split("\n");
  const slot = TRAIN / Math.max(1, art.frames.length - 1);

  const bands = GLITCH_BANDS.map(([from, to]) => [
    Math.round(from * art.rows),
    Math.round(to * art.rows),
  ]);
  const inBand = (row: number) =>
    bands.some(([from = 0, to = 0]) => row >= from && row <= to);

  return (
    <div
      data-variant={name}
      className="face__variant"
      style={{ "--cols": art.cols, "--rows": art.rows } as CSSProperties}
    >
      {/* The run: each epoch fades in over the last and out under the next. */}
      {early.map((frame, epoch) => (
        <pre
          key={epoch}
          className="face__frame face__frame--early"
          style={{
            animationDuration: s(slot * 1.6),
            animationDelay: s(START + epoch * slot - slot * 0.3),
          }}
        >
          {frame}
        </pre>
      ))}

      {/* The trained face: still rows plus bands that glitch sideways. */}
      <div
        className="face__final"
        style={{ animationDelay: s(START + TRAIN - slot * 0.3) }}
      >
        <pre className="face__frame">
          {finalLines.map((line, row) => (inBand(row) ? "" : line)).join("\n")}
        </pre>
        {bands.map(([from = 0, to = 0], k) => (
          <pre
            key={from}
            className="face__frame face__band"
            style={{
              top: `${from * 1.2}em`,
              animationDelay: s(DONE + 2 + k * 2.3),
            }}
          >
            {finalLines.slice(from, to + 1).join("\n")}
          </pre>
        ))}
      </div>

      {art.debris.map((group) => {
        const [c0 = 0, r0 = 0, c1 = 0, r1 = 0] = group.box;
        return (
          <svg
            key={`${group.layer}-${group.k}`}
            className="face__debris"
            viewBox={`${c0 * CELL_W} ${r0 * CELL_H} ${(c1 - c0) * CELL_W} ${(r1 - r0) * CELL_H}`}
            preserveAspectRatio="none"
            style={{
              left: `${(c0 / art.cols) * 100}%`,
              top: `${(r0 / art.rows) * 100}%`,
              width: `${((c1 - c0) / art.cols) * 100}%`,
              height: `${((r1 - r0) / art.rows) * 100}%`,
              ...debrisMotion(group.layer, group.k),
            }}
          >
            <path d={rectsPath(group.rects)} />
          </svg>
        );
      })}

      <svg
        className="face__log"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
      >
        {art.log.map(([right, row, epoch, text]) => (
          <text
            key={String(text)}
            className={Number(epoch) % 6 === 0 ? "is-mark" : undefined}
            x={-Number(right) * CELL_W}
            y={(Number(row) + 0.85) * CELL_H}
            fontSize={(CELL_W * art.logScale) / 0.6}
            transform="scale(-1 1)"
            style={{ animationDelay: s(START + (Number(epoch) / 6) * TRAIN) }}
          >
            {text}
          </text>
        ))}
      </svg>

      <div className="face__scan" />

      <svg
        className="face__eyes"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        style={{ "--done": s(DONE) } as CSSProperties}
      >
        <path d={eyesPath(art.eyes)} />
      </svg>
    </div>
  );
}

export function AsciiFace({ className }: { className?: string }) {
  return (
    <div aria-hidden className={className ? `face ${className}` : "face"}>
      <div className="face__art">
        <FaceVariant name="wide" art={data.wide} />
        <FaceVariant name="narrow" art={data.narrow} />
      </div>
      <p
        className="face__caption"
        style={
          {
            "--start": s(START),
            "--train": s(TRAIN),
            "--done": s(DONE),
          } as CSSProperties
        }
      >
        <span className="face__prompt">$</span> ./psycho --train{" "}
        <span className="face__bar">
          <span />
        </span>{" "}
        <span className="face__status">done</span>
      </p>
    </div>
  );
}
