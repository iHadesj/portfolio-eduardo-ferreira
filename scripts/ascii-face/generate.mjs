/**
 * Bakes the hero's ASCII face — the same `./psycho --train` portrait as the
 * GitHub profile README (github.com/iHadesj/iHadesJ, src/art): a head
 * sculpted from signed distance functions, ray marched, turned into glyphs,
 * with its back half dissolving into a stream of pixels and a mirrored
 * training log. `art/` and `lib/` are copied from that repo; head.mjs is
 * re-sculpted (an idealised male head) and portrait.mjs turns the camera
 * closer to profile with the chin up.
 *
 *   node scripts/ascii-face/generate.mjs
 *
 * Writes src/components/face/face-data.json. Ray marching takes a few
 * seconds, so it runs once here and the output is committed — the build and
 * the browser only ever read text.
 */
/* eslint-disable no-console -- a CLI script: progress goes to the terminal */
import { writeFileSync } from "node:fs";
import { portrait } from "./art/portrait.mjs";
import { rng } from "./lib/random.mjs";

/**
 * Two grids from the same render settings: wide screens get more detail,
 * phones fewer, larger characters. Rows keep the README's aspect.
 */
const VARIANTS = {
  wide: {
    cols: 120,
    rows: 54,
    logScale: 1.3,
    epochs: [0, 1, 2, 3, 4, 5, 6, 8, 9],
  },
  // fewer cells (so a smaller log, or it would loom over the head) and fewer
  // epochs: both variants ship in the HTML, and phones pay for every byte
  narrow: { cols: 76, rows: 34, logScale: 0.85, epochs: [0, 3, 5, 7, 9] },
};

/**
 * The training run, epoch by epoch: a bare wireframe, then blocks of tone
 * that shrink while the noise dies out, then the face. Twice as many steps
 * as the README (which jumps 6 → 3 → 1), so crossfading them reads as one
 * continuous convergence instead of a slideshow.
 */
const EPOCHS = [
  { block: 0, chaos: 0.1 }, // wireframe
  { block: 8, chaos: 0.45 },
  { block: 6, chaos: 0.34 },
  { block: 4, chaos: 0.26 },
  { block: 3, chaos: 0.19 },
  { block: 2, chaos: 0.13 },
  { block: 1, chaos: 0.08 },
  { block: 1, chaos: 0.04 },
  { block: 1, chaos: 0.015 },
  { block: 1, chaos: 0 }, // final
];

const NOISE = " .,:;-=+*#%@";
const WIRE = " .:-=+";

/** Same per-cell logic as the README's `trainingFrames`, with our steps. */
function trainingFrames(art, seed = 77) {
  const { cols, rows, cells, tone, solid } = art;
  const final = art.face.join("");
  const rand = rng(seed);
  return EPOCHS.map(({ block, chaos }) => {
    const out = new Array(cols * rows).fill(" ");
    for (let i = 0; i < cols * rows; i += 1) {
      if (!solid[i]) continue;
      const c = i % cols;
      const r = Math.floor(i / cols);
      let ch;
      if (block === 0) {
        ch =
          WIRE[
            Math.min(
              WIRE.length - 1,
              Math.floor(cells[i].wire * 1.6 * WIRE.length),
            )
          ];
      } else if (block > 1) {
        const b = c - (c % block) + (r - (r % Math.ceil(block / 2))) * cols;
        ch =
          NOISE[
            Math.min(
              NOISE.length - 1,
              Math.floor(tone[b] * 0.95 * NOISE.length),
            )
          ];
      } else {
        ch = final[i];
      }
      if (rand() < chaos) {
        ch = rand() < 0.5 ? " " : NOISE[Math.floor(rand() * NOISE.length)];
      }
      out[i] = ch;
    }
    return Array.from({ length: rows }, (_, row) =>
      out.slice(row * cols, (row + 1) * cols).join(""),
    ).join("\n");
  });
}

/**
 * The pixel stream keeps moving after training: each layer of debris is
 * split into a couple of groups that drift out of phase. Every group gets
 * its own bounding box so the browser composites a small layer per group,
 * not a copy of the whole portrait.
 */
const GROUPS = { edge: 2, stream: 3, wake: 2, stray: 1 };

function debrisGroups(debris) {
  const rand = rng(404);
  const groups = new Map();
  for (const d of debris) {
    const k = Math.floor(rand() * GROUPS[d.layer]);
    const key = `${d.layer}-${k}`;
    if (!groups.has(key)) groups.set(key, { layer: d.layer, k, rects: [] });
    groups.get(key).rects.push([d.c, d.r, d.kind, d.len]);
  }
  return [...groups.values()].map((group) => {
    const c0 = Math.min(...group.rects.map(([c]) => c));
    const r0 = Math.min(...group.rects.map(([, r]) => r));
    const c1 = Math.max(...group.rects.map(([c, , , len]) => c + len));
    const r1 = Math.max(...group.rects.map(([, r]) => r + 1));
    return { ...group, box: [c0, r0, c1, r1] };
  });
}

const round = (value) => Math.round(value * 100) / 100;

/** The traced eye openings read as blobs on a web-sized grid: shrink them
    toward their own centre so they glint instead. */
const EYE_SCALE = 0.7;
function shrink(poly) {
  const cx = poly.reduce((sum, [x]) => sum + x, 0) / poly.length;
  const cy = poly.reduce((sum, [, y]) => sum + y, 0) / poly.length;
  return poly.map(([x, y]) => [
    round(cx + (x - cx) * EYE_SCALE),
    round(cy + (y - cy) * EYE_SCALE),
  ]);
}

const out = {};
for (const [name, { cols, rows, logScale, epochs }] of Object.entries(
  VARIANTS,
)) {
  const started = performance.now();
  const art = portrait({ cols, rows, logScale });
  out[name] = {
    cols,
    rows,
    // wireframe … final face, each as lines of text
    frames: trainingFrames(art).filter((_, epoch) => epochs.includes(epoch)),
    // glowing eyes, as polygons in cell units
    eyes: art.eyes.map(shrink),
    // the pixel stream, grouped for animation; rects are
    // [col, row, kind, length] — kind 0 dot, 1 small square, 2 square, 3 bar
    debris: debrisGroups(art.debris),
    // mirrored training log: right edge (cells), row, epoch (0–6), text
    log: art.log.map((line) => [line.right, line.r, line.epoch, line.text]),
    logScale: art.logScale,
  };
  console.log(
    `${name}: ${cols}×${rows}, ${art.debris.length} debris, ${Math.round(performance.now() - started)} ms`,
  );
}

const target = new URL(
  "../../src/components/face/face-data.json",
  import.meta.url,
);
writeFileSync(target, `${JSON.stringify(out)}\n`);
console.log("wrote", target.pathname);
