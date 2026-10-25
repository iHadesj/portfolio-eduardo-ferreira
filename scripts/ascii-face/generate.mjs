/**
 * Bakes the hero's face — the `./psycho --train` portrait from the GitHub
 * profile README (github.com/iHadesj/iHadesJ, src/art): a head sculpted from
 * signed distance functions, the back of it dissolving into a stream of
 * pixels while a mirrored training log climbs through it. `art/` and `lib/`
 * come from that repo; head.mjs is re-sculpted (an android in profile) and
 * dots.mjs renders it as a point cloud — rows of dots that follow the skin,
 * like a 3D scan — instead of a grid of characters.
 *
 *   node scripts/ascii-face/generate.mjs
 *
 * Writes the training frames as 1-bit PNGs to src/components/face/frames/,
 * their imports to face-frames.ts and everything else (stream, log, eyes)
 * to face-data.json. Ray marching takes a while, so it runs once here and
 * the output is committed — the build and the browser only read files.
 */
/* eslint-disable no-console -- a CLI script: progress goes to the terminal */
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { CAMERA, portrait } from "./art/portrait.mjs";
import { bitmap, dotSize, sampleDots } from "./art/dots.mjs";
import { rng } from "./lib/random.mjs";

/**
 * Two compositions of the same scene. Images are drawn at 2× the size they
 * are shown at, so dots stay crisp on high-density screens. `cols`/`rows`
 * is the layout grid of the stream and log (character-cell shaped, like the
 * README), spanning the same frame.
 */
const VARIANTS = {
  wide: {
    width: 1040,
    cols: 120,
    rows: 45,
    logScale: 1.3,
    blocks: [24, 16, 10, 6],
    chaos: [0.18, 0.06],
  },
  narrow: {
    width: 716,
    cols: 80,
    rows: 30,
    logScale: 0.85,
    blocks: [18, 9],
    chaos: [0.12],
  },
};

/** Dot pitch as a share of the image width (≈ 3.6 CSS px on a 520 px box). */
const PITCH = 0.0062;
/** Where the skull lets go of its pixels: just behind the ear module, so
    the back of the skull and the spine break up and feed the stream. */
const DISSOLVE_AT = Number(process.env.FACE_DISSOLVE ?? -1.45);
/** A denser, chunkier stream than the README's. */
const DEBRIS_BOOST = Number(process.env.FACE_DEBRIS ?? 0.5);

/**
 * While iterating: FACE_CAMERA='{"yaw":0.8}' overrides the portrait camera,
 * and FACE_PREVIEW=<path> writes a composite PNG per layout (face, stream
 * and eyes, at 1×) to look at without a browser — and nothing else, so the
 * committed frames stay as they are.
 */
const camera = { ...CAMERA, ...JSON.parse(process.env.FACE_CAMERA ?? "{}") };
const preview = process.env.FACE_PREVIEW;

const out = new URL("../../src/components/face/", import.meta.url);
const framesDir = new URL("frames/", out);

// ── 1-bit PNG: palette [transparent, white] ────────────────────────────────
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const head = Buffer.alloc(4);
  head.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc(body));
  return Buffer.concat([head, body, tail]);
}
function png1bit({ width, height, bits }) {
  const stride = Math.ceil(width / 8);
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (bits[y * width + x]) {
        raw[y * (stride + 1) + 1 + (x >> 3)] |= 0x80 >> (x & 7);
      }
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 1; // bit depth
  ihdr[9] = 3; // palette
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("PLTE", Buffer.from([0, 0, 0, 255, 255, 255])),
    chunk("tRNS", Buffer.from([0])),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ── frames ─────────────────────────────────────────────────────────────────

/** The finished face: every dot at its halftone size. */
function finalFrame(dots, width, height, pitch) {
  const bmp = bitmap(width, height);
  for (const d of dots) {
    const size = dotSize(d.lum, pitch);
    if (size) bmp.square(d.x, d.y, size);
  }
  return bmp;
}

/**
 * Before epoch 0: random initialisation — static shaped like the head, the
 * same points scattered with random sizes. It is on screen from the first
 * paint, and being the densest frame it is also what the browser counts as
 * the hero's largest paint (sparser frames are ignored for that).
 */
function noiseFrame(dots, width, height, pitch, rand) {
  const bmp = bitmap(width, height);
  for (const d of dots) {
    if (rand() < 0.45) continue;
    const size = 1 + Math.floor(rand() * (pitch - 1));
    const dx = (rand() - 0.5) * pitch * 3;
    const dy = (rand() - 0.5) * pitch;
    bmp.square(d.x + dx, d.y + dy, size);
  }
  return bmp;
}

/** Epoch 0: only the scan lines — every third ring and a few meridians. */
function wireFrame(dots, width, height) {
  const bmp = bitmap(width, height);
  const MERIDIAN = 0.13;
  for (const d of dots) {
    const ring = d.row % 3 === 0;
    const offset = Math.abs(
      d.theta / MERIDIAN - Math.round(d.theta / MERIDIAN),
    );
    if (ring || offset < 0.08) bmp.square(d.x, d.y, ring ? 2 : 1);
  }
  return bmp;
}

/** Coarse epochs: the face's ink averaged over big blocks, one square each. */
function blockFrame(dots, width, height, pitch, block) {
  const bw = Math.ceil(width / block);
  const ink = new Float32Array(bw * Math.ceil(height / block));
  for (const d of dots) {
    const size = dotSize(d.lum, pitch);
    ink[Math.floor(d.y / block) * bw + Math.floor(d.x / block)] += size * size;
  }
  const bmp = bitmap(width, height);
  ink.forEach((amount, i) => {
    if (!amount) return;
    const fill = Math.min(1, amount / (block * block));
    const size = Math.round(Math.sqrt(fill) * (block - 2));
    if (size < 1) return;
    bmp.square(
      (i % bw) * block + block / 2,
      Math.floor(i / bw) * block + block / 2,
      size,
    );
  });
  return bmp;
}

/** Late epochs: the face with dots missing and stray noise, still settling. */
function chaosFrame(dots, width, height, pitch, chaos, rand) {
  const bmp = bitmap(width, height);
  for (const d of dots) {
    if (rand() < chaos) {
      if (rand() < 0.5) continue;
      const size = 1 + Math.floor(rand() * (pitch - 2));
      bmp.square(d.x + (rand() - 0.5) * pitch * 3, d.y, size);
      continue;
    }
    const size = dotSize(d.lum, pitch);
    if (size) bmp.square(d.x, d.y, size);
  }
  return bmp;
}

// ── the stream, grouped for animation ──────────────────────────────────────

/**
 * The pixel stream keeps moving after training: each layer of debris is
 * split into a couple of groups that drift out of phase, each with its own
 * bounding box so the browser composites a small layer per group.
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

/** The traced eye openings: shrink a little toward their centre so they
    glint inside the socket. */
const EYE_SCALE = 0.92;
function shrink(poly) {
  const cx = poly.reduce((sum, [x]) => sum + x, 0) / poly.length;
  const cy = poly.reduce((sum, [, y]) => sum + y, 0) / poly.length;
  return poly.map(([x, y]) => [
    round(cx + (x - cx) * EYE_SCALE),
    round(cy + (y - cy) * EYE_SCALE),
  ]);
}

// ── preview (development only) ─────────────────────────────────────────────

/** Debris as the component draws it (sizes in 6×12 cell units). */
const DEBRIS_SIZES = [2, 4, 6];
const EDGE_SCALE = 1.6;
const BAR = 7;

function compositePreview(face, art, cols, rows) {
  const { width, height } = face;
  const img = Uint8Array.from(face.bits, (on) => (on ? 235 : 0));
  const cw = width / cols;
  const ch = height / rows;
  const fill = (x0, y0, w, h, v) => {
    for (
      let y = Math.max(0, Math.round(y0));
      y < Math.min(height, Math.round(y0 + h));
      y++
    )
      for (
        let x = Math.max(0, Math.round(x0));
        x < Math.min(width, Math.round(x0 + w));
        x++
      )
        img[y * width + x] = v;
  };
  for (const d of art.debris) {
    const x = d.c * cw;
    const y = d.r * ch;
    if (d.kind === 3) {
      const t = (BAR / 12) * ch;
      fill(x + cw / 12, y + (ch - t) / 2, d.len * cw - cw / 6, t, 160);
    } else {
      const scale = d.layer === "edge" ? EDGE_SCALE : 1;
      const size = ((DEBRIS_SIZES[d.kind] * scale) / 6) * cw;
      fill(x + (cw - size) / 2, y + (ch - size) / 2, size, size, 160);
    }
  }
  for (const poly of art.eyes.map(shrink)) {
    const pts = poly.map(([px, py]) => [px * cw, py * ch]);
    const xs = pts.map(([px]) => px);
    const ys = pts.map(([, py]) => py);
    for (
      let y = Math.floor(Math.min(...ys));
      y <= Math.ceil(Math.max(...ys));
      y++
    ) {
      for (
        let x = Math.floor(Math.min(...xs));
        x <= Math.ceil(Math.max(...xs));
        x++
      ) {
        let inside = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [xi, yi] = pts[i];
          const [xj, yj] = pts[j];
          if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
            inside = !inside;
        }
        if (inside && x >= 0 && y >= 0 && x < width && y < height)
          img[y * width + x] = 255;
      }
    }
  }
  // downscale 2× (box filter): roughly what a 1× screen shows
  const ow = Math.floor(width / 2);
  const oh = Math.floor(height / 2);
  const raw = Buffer.alloc((ow + 1) * oh);
  for (let y = 0; y < oh; y++)
    for (let x = 0; x < ow; x++) {
      const i = 2 * y * width + 2 * x;
      raw[y * (ow + 1) + 1 + x] =
        (img[i] + img[i + 1] + img[i + width] + img[i + width + 1]) >> 2;
    }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ow, 0);
  ihdr.writeUInt32BE(oh, 4);
  ihdr[8] = 8;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ── bake ───────────────────────────────────────────────────────────────────

if (!preview) {
  rmSync(framesDir, { recursive: true, force: true });
  mkdirSync(framesDir, { recursive: true });
}

const data = {};
const imports = [];
const lists = {};
const only = process.env.FACE_ONLY;
for (const [name, v] of Object.entries(VARIANTS)) {
  if (only && name !== only) continue;
  const started = performance.now();
  const height = Math.round((v.width * v.rows * 1.2) / (v.cols * 0.6));
  const pitch = Math.max(5, Math.round(v.width * PITCH));

  // The cell portrait decides what dissolves, where the stream and the log
  // go, and traces the eyes; the point cloud draws what stays solid.
  const art = portrait({
    cols: v.cols,
    rows: v.rows,
    logScale: v.logScale,
    dissolveAt: DISSOLVE_AT,
    debrisBoost: DEBRIS_BOOST,
    camera,
  });
  const keep = (x, y) => {
    const c = Math.floor((x / v.width) * v.cols);
    const r = Math.floor((y / height) * v.rows);
    return art.solid[r * v.cols + c] === 1;
  };
  const dots = sampleDots({
    width: v.width,
    height,
    ...camera,
    pitchPx: pitch,
    keep,
  });

  const rand = rng(77);
  const frames = [
    noiseFrame(dots, v.width, height, pitch, rand),
    wireFrame(dots, v.width, height),
    ...v.blocks.map((block) => blockFrame(dots, v.width, height, pitch, block)),
    ...v.chaos.map((chaos) =>
      chaosFrame(dots, v.width, height, pitch, chaos, rand),
    ),
    finalFrame(dots, v.width, height, pitch),
  ];
  lists[name] = frames.map((frame, i) => {
    const file = `${name}-${i}.png`;
    const bytes = png1bit(frame);
    if (!preview) writeFileSync(new URL(file, framesDir), bytes);
    const id = `${name}${i}`;
    imports.push(`import ${id} from "./frames/${file}";`);
    return { id, bytes: bytes.length };
  });

  if (preview) {
    writeFileSync(
      `${preview}-${name}.png`,
      compositePreview(frames.at(-1), art, v.cols, v.rows),
    );
  }

  data[name] = {
    cols: v.cols,
    rows: v.rows,
    width: v.width,
    height,
    eyes: art.eyes.map(shrink),
    debris: debrisGroups(art.debris),
    log: art.log.map((line) => [line.right, line.r, line.epoch, line.text]),
    logScale: art.logScale,
  };
  const kb = lists[name]
    .map(({ bytes }) => (bytes / 1024).toFixed(1))
    .join(" + ");
  console.log(
    `${name}: ${dots.length} dots, frames ${kb} KB, ${Math.round(performance.now() - started)} ms`,
  );
}

if (!preview) {
  writeFileSync(new URL("face-data.json", out), `${JSON.stringify(data)}\n`);
  const frameLists = Object.entries(lists)
    .map(
      ([name, list]) => `  ${name}: [${list.map(({ id }) => id).join(", ")}],`,
    )
    .join("\n");
  writeFileSync(
    new URL("face-frames.ts", out),
    `// Generated by scripts/ascii-face/generate.mjs — do not edit.\n${imports.join("\n")}\n\n` +
      `/** Training frames per layout, wireframe first, finished face last. */\n` +
      `export const FACE_FRAMES = {\n${frameLists}\n};\n`,
  );
  console.log("frames:", readdirSync(framesDir).length);
}
