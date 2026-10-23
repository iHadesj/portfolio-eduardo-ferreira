// The hero portrait: an SDF head rendered to ASCII, its back half
// dissolving into pixels that stream to the left, while a mirrored training
// log scrolls through the stream (epoch by epoch the error goes down).

import { renderHead } from './head.mjs';
import { clamp, smoothstep } from './sdf.mjs';
import { rng, noise1 } from '../lib/random.mjs';

const CAMERA = {
  yaw: 0.92, // ~53°: three-quarter view, nose breaking the silhouette
  pitch: 0.15, // looking slightly down, like the reference
  roll: 0.06,
  distance: 8,
  fov: 0.48,
  center: [0.45, 0.08, 0],
  light: [0.8, 0.4, 0.5], // from where the face looks: lit profile, shaded cheek
};

// The training log, bottom → top like the reference: the run starts at the
// bottom of the stream and each epoch prints above the previous one.
// `epoch` orders the lines in time (0 = start, 6 = finished).
export const TRAINING_LOG = [
  { epoch: 6, row: 0.325, right: 0.47, text: 'TRAINING FINISHED' },
  { epoch: 5.5, row: 0.365, right: 0.47, text: 'ERROR: 2.35E-09' },
  { epoch: 5, row: 0.405, right: 0.46, text: '--- EPOCH: 5, AVERAGE' },
  { epoch: 4.5, row: 0.445, right: 0.47, text: 'ERROR: 6.21E-08' },
  { epoch: 4, row: 0.485, right: 0.47, text: '--- EPOCH: 4, AVERAGE' },
  { epoch: 3.5, row: 0.525, right: 0.47, text: 'ERROR: 8.35E-07' },
  { epoch: 3, row: 0.665, right: 0.525, text: '--- EPOCH: 3, AVERAGE' },
  { epoch: 2.5, row: 0.705, right: 0.525, text: 'ERROR: 1.62E-05' },
  { epoch: 2, row: 0.745, right: 0.48, text: '--- EPOCH: 2, AVERAGE' },
  { epoch: 1.5, row: 0.785, right: 0.525, text: 'ERROR: 5.74E-04' },
  { epoch: 1, row: 0.825, right: 0.525, text: '--- EPOCH: 1, AVERAGE' },
  { epoch: 0, row: 0.865, right: 0.525, text: 'TRAINING STARTED' },
];

// Surface-space wireframe: rings (latitude) and meridians (longitude)
// hugging the head, like the scan lines of a 3D capture. Used by the first
// training epochs, before the face has converged.
function meshLines(x, y, z) {
  const ring = (t, w) => smoothstep(w, 0, Math.abs(t - Math.round(t)));
  const lat = ring(y / 0.16, 0.24);
  const lon = ring((Math.atan2(x, z) / (2 * Math.PI)) * 28, 0.22);
  return Math.max(lat, lon * 0.75);
}

/**
 * Collapse the supersampled render into cells: mean luminance, how much of
 * the cell the head covers, eye pixels, mean head-local position and how
 * much wireframe runs through it.
 */
function sampleCells(buf, cols, rows, sx, sy) {
  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const pos = [0, 0, 0];
      let lum = 0, wire = 0, hits = 0, eye = 0;
      for (let y = 0; y < sy; y++) {
        for (let x = 0; x < sx; x++) {
          const i = (r * sy + y) * buf.width + (c * sx + x);
          if (!buf.mask[i]) continue;
          hits++;
          if (buf.material[i] === 2) { eye++; continue; } // eyes are drawn as shapes
          const [lx, ly, lz] = buf.local.subarray(i * 3, i * 3 + 3);
          lum += buf.lum[i];
          wire += meshLines(lx, ly, lz);
          pos[0] += lx; pos[1] += ly; pos[2] += lz;
        }
      }
      const n = sx * sy;
      const skin = hits - eye;
      cells.push({
        c, r,
        lum: lum / n,
        wire: skin ? wire / skin : 0,
        coverage: hits / n,
        eye: eye / n,
        pos: skin ? pos.map((v) => v / skin) : null,
      });
    }
  }
  return cells;
}

// Dark → bright, ordered by measured ink coverage in JetBrains Mono.
export const RAMP = ' .:-=+*#%@';

/** Floyd–Steinberg over the character ramp: smooth tones from few glyphs. */
function ditherToRamp(values, mask, cols, rows, ramp = RAMP) {
  const levels = ramp.length - 1;
  const v = Float32Array.from(values, (x) => x * levels);
  const out = new Array(cols * rows).fill(' ');
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (!mask[i]) continue;
      const q = Math.max(0, Math.min(levels, Math.round(v[i])));
      const err = v[i] - q;
      out[i] = ramp[q];
      const push = (dc, dr, w) => {
        const cc = c + dc, rr = r + dr;
        if (cc >= 0 && cc < cols && rr < rows && mask[rr * cols + cc]) v[rr * cols + cc] += err * w;
      };
      push(1, 0, 7 / 16); push(-1, 1, 3 / 16); push(0, 1, 5 / 16); push(1, 1, 1 / 16);
    }
  }
  return out;
}

/** Outline of each glowing eye, traced from the eye pixels, in cell units. */
function traceEyes(buf, sx, sy) {
  const spans = new Map(); // buffer row → [minX, maxX] per eye blob
  for (let y = 0; y < buf.height; y++) {
    const xs = [];
    for (let x = 0; x < buf.width; x++) if (buf.material[y * buf.width + x] === 2) xs.push(x);
    if (xs.length) spans.set(y, xs);
  }
  // split into blobs by horizontal gaps (two eyes never overlap on screen)
  const blobs = [];
  for (const [y, xs] of spans) {
    let start = xs[0];
    for (let k = 1; k <= xs.length; k++) {
      if (k === xs.length || xs[k] !== xs[k - 1] + 1) {
        const span = [start, xs[k - 1]];
        let blob = blobs.find((b) => Math.abs(b.cx - (span[0] + span[1]) / 2) < 12 && b.rows.at(-1)[0] >= y - 2);
        if (!blob) blobs.push((blob = { cx: (span[0] + span[1]) / 2, rows: [] }));
        blob.rows.push([y, ...span]);
        if (k < xs.length) start = xs[k];
      }
    }
  }
  return blobs
    .filter((b) => b.rows.length > 1)
    .map((b) => {
      const left = b.rows.map(([y, x0]) => [x0 / sx, y / sy]);
      const right = b.rows.map(([y, , x1]) => [(x1 + 1) / sx, (y + 1) / sy]).reverse();
      return [...left, ...right];
    });
}

export function portrait({
  cols = 160, rows = 72, seed = 1312, sx = 4, sy = 6,
  gamma = 1.25, gain = 1.35, logScale = 1.5, camera = {}, buf: cached,
} = {}) {
  const buf = cached ?? renderHead({ width: cols * sx, height: rows * sy, aspect: (0.6 * sy) / sx, ...CAMERA, ...camera });
  const cells = sampleCells(buf, cols, rows, sx, sy);
  const rand = rng(seed);
  const edge = noise1(seed + 1);
  const streak = noise1(seed + 2);
  const N = cols * rows;

  // --- dissolve: the back of the skull lets go of its pixels -------------
  const solid = new Uint8Array(N);
  const dissolved = [];
  for (const cell of cells) {
    if (cell.coverage < 0.15 || !cell.pos) continue;
    const [, y, z] = cell.pos;
    // ragged boundary, further forward on the jaw than on the crown;
    // the neck stays whole and simply fades into shadow
    const front = 0.14 + 0.16 * clamp(-y) + (edge(cell.r * 0.23) - 0.5) * 0.5;
    const neck = smoothstep(-1.15, -2.0, y) * 0.55; // the neck thins out too
    const p = Math.max(smoothstep(front + 0.16, front - 0.32, z), neck * (0.4 + 0.6 * smoothstep(1, 0, z)));
    if (rand() < p) dissolved.push({ ...cell, depth: clamp(front - z, 0, 1.5) });
    else solid[cell.r * cols + cell.c] = 1;
  }

  // --- face: light → glyphs (the neck sinks into the jaw's shadow) ----------
  const neckShade = (cell) => (cell.pos ? 1 - 0.85 * smoothstep(-1.1, -1.8, cell.pos[1]) : 1);
  const tone = cells.map((cell) => clamp(Math.pow(cell.lum * neckShade(cell), gamma) * gain));
  const face = ditherToRamp(tone, solid, cols, rows);

  // leftmost solid cell per row: where the stream leaves the head
  const leftEdge = Array.from({ length: rows }, (_, r) => {
    for (let c = 0; c < cols; c++) if (solid[r * cols + c] && face[r * cols + c] !== ' ') return c;
    return -1;
  });

  // --- debris: square pixels, sized by how bright they were ------------------
  // kind: 0 = dot, 1 = small square, 2 = square, 3 = bar (len cells long)
  // layer: where it came from, so each part of the stream can move its own way
  const debris = [];
  const taken = new Set();
  let layer = 'edge';
  const put = (c, r, kind, len = 1) => {
    c = Math.round(c);
    if (c < 0 || c + len > cols || r < 0 || r >= rows) return;
    for (let k = 0; k < len; k++) if (solid[r * cols + c + k] || taken.has(r * cols + c + k)) return;
    for (let k = 0; k < len; k++) taken.add(r * cols + c + k);
    debris.push({ c, r, kind, len, layer });
  };
  const at = (fx) => Math.round(fx * cols);
  const row = (fy) => Math.round(fy * rows);
  const sizeOf = (s) => (s > 0.62 ? 2 : s > 0.3 ? 1 : 0);

  // 1) the skull breaking up: pixels near the boundary stay almost in place
  for (const d of dissolved) {
    if (d.depth > 0.45 || d.pos[1] < -1.15 || rand() > 0.75 - d.depth) continue;
    put(d.c - Math.floor(rand() * rand() * 6 * (1 + d.depth * 4)), d.r, sizeOf(d.lum * 2.2 + 0.25));
  }

  // 2) the stream: horizontal bars flowing out of the head, mid height
  layer = 'stream';
  for (let r = row(0.2); r <= row(0.6); r++) {
    const from = leftEdge[r] > 0 ? leftEdge[r] : at(0.58);
    const reach = at(0.1 + 0.2 * streak(r * 0.45));
    for (let c = from - 2; c > reach; ) {
      const fade = (c - reach) / Math.max(1, from - reach); // 1 near head → 0
      const len = 1 + Math.floor(rand() * (1 + 5 * fade));
      if (rand() < 0.25 + 0.55 * fade) put(c - len + 1, r, len > 1 ? 3 : sizeOf(fade + 0.25), len);
      c -= len + 1 + Math.floor(rand() * (1 + 7 * (1 - fade)));
    }
  }

  // 3) dotted wake under the chin, stretching far to the left
  layer = 'wake';
  for (let r = row(0.62); r <= row(0.95); r += 2) {
    const from = Math.max(at(0.5), (leftEdge[r] > 0 ? leftEdge[r] : at(0.64)) - 2);
    const reach = at(0.03 + 0.12 * rand());
    for (let c = from; c > reach; c -= 2 + Math.floor(rand() * 2)) {
      const fade = (c - reach) / (from - reach);
      if (rand() < 0.5 + 0.35 * fade) put(c, r, sizeOf(fade * 0.75 + rand() * 0.3));
    }
  }

  // 4) a trail leaving the crown, and a few stray pixels in the dark
  layer = 'stray';
  for (let c = at(0.33); c < at(0.6); c += 2) if (rand() < 0.8) put(c, row(0.065), sizeOf(0.15 + ((c / cols) - 0.33) * 2.8));
  for (let k = 0; k < 14; k++) put(at(0.02 + rand() * 0.5), row(0.05 + rand() * 0.9), rand() < 0.4 ? 2 : 1);

  // --- the log: mirrored lines sitting in the stream ------------------------
  const log = TRAINING_LOG.map((l) => ({
    ...l,
    r: row(l.row),
    right: at(l.right),
    width: Math.ceil(l.text.length * logScale),
  }));
  const clear = (r, c0, c1) => {
    for (let k = debris.length - 1; k >= 0; k--) {
      const d = debris[k];
      if (d.r >= r - 1 && d.r <= r && d.c + d.len > c0 && d.c < c1) debris.splice(k, 1);
    }
  };
  for (const l of log) clear(l.r, l.right - l.width - 1, l.right + 2);

  return {
    buf,
    cols,
    rows,
    logScale,
    cells,
    tone,
    solid,
    face: rowsOf(face, cols, rows),
    eyes: traceEyes(buf, sx, sy),
    debris,
    log,
  };
}

/**
 * "Training" frames: the same head at increasing fidelity. Epoch 0 is a bare
 * wireframe, then coarse blocks of tone, then the face sharpens while the
 * noise dies out. The last frame is the final face.
 */
export function trainingFrames(art, { seed = 77 } = {}) {
  const { cols, rows, cells, tone, solid } = art;
  const final = art.face.join('');
  const rand = rng(seed);
  const noise = ' .,:;-=+*#%@';
  const wireRamp = ' .:-=+';
  const steps = [
    { block: 0, chaos: 0.12 }, // wireframe
    { block: 6, chaos: 0.4 },
    { block: 3, chaos: 0.22 },
    { block: 1, chaos: 0.1 },
    { block: 1, chaos: 0.035 },
    { block: 1, chaos: 0 },
  ];
  return steps.map(({ block, chaos }, epoch) => {
    const out = new Array(cols * rows).fill(' ');
    for (let i = 0; i < cols * rows; i++) {
      if (!solid[i]) continue;
      const c = i % cols, r = Math.floor(i / cols);
      let ch;
      if (block === 0) {
        ch = wireRamp[Math.min(wireRamp.length - 1, Math.floor(cells[i].wire * 1.6 * wireRamp.length))];
      } else if (block > 1) {
        // the tone of the block this cell belongs to (blocks are ~square on screen)
        const b = (c - (c % block)) + (r - (r % Math.ceil(block / 2))) * cols;
        ch = noise[Math.min(noise.length - 1, Math.floor(tone[b] * 0.95 * noise.length))];
      } else {
        ch = final[i];
      }
      if (rand() < chaos) ch = rand() < 0.5 ? ' ' : noise[Math.floor(rand() * noise.length)];
      out[i] = ch;
    }
    return { epoch, face: rowsOf(out, cols, rows) };
  });
}

const rowsOf = (arr, cols, rows) =>
  Array.from({ length: rows }, (_, r) => arr.slice(r * cols, (r + 1) * cols).join(''));
