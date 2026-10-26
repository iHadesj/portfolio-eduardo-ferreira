/**
 * The hero's black hole, as text. One description of the scene — camera,
 * light bending, accretion disk, stars and glyph choice — shared by two
 * renderers:
 *
 * - `rasterizeHole` (here, pure TS) runs on the server at build time and
 *   produces the static poster: the scene's first frame, as characters.
 * - `black-hole-gl.ts` traces the same rays on the GPU every frame, so the
 *   live scene picks up exactly where the poster left off.
 *
 * Units: the event horizon has radius 1. Every sample traces a light ray
 * back from the camera through a Schwarzschild black hole — the bending is
 * the exact photon orbit, integrated as a pull of `1.5·h²/r⁵` (h: the ray's
 * angular momentum) — so the far side of the disk shows up above and below
 * the shadow, and a thin photon ring hugs it. The disk is a thin, turbulent
 * sheet whose inner edge is brightest, beamed brighter on the side that
 * turns toward the camera.
 *
 * Everything that has to match the GPU bit for bit (the hash behind noise
 * and stars) is integer math, identical in both languages.
 */

/* ── Layouts ─────────────────────────────────────────────────────────────── */

export interface HoleLayout {
  cols: number;
  rows: number;
}

/** Character grids, one per breakpoint: dense enough to read as an image. */
export const HOLE_LAYOUTS = {
  wide: { cols: 132, rows: 57 },
  narrow: { cols: 96, rows: 36 },
} as const satisfies Record<string, HoleLayout>;

export type HoleLayoutName = keyof typeof HOLE_LAYOUTS;

/** A cell is 0.6em × 1.2em (Geist Mono advance × line height). */
export const imageAspect = ({ cols, rows }: HoleLayout) =>
  (cols * 0.6) / (rows * 1.2);

/** Rays per cell along each axis; a cell's tone is their mean. */
export const SUB = 2;

/* ── Scene ───────────────────────────────────────────────────────────────── */

export const DISK_INNER = 2.6;
export const DISK_OUTER = 11;
export const CAMERA_DISTANCE = 24;
/** tan of half the horizontal field of view: the whole disk fits across. */
export const TAN_HALF_FOV = 0.38;

/** Integration: steps grow with distance from the hole. */
export const MAX_STEPS = 200;
export const STEP = 0.07;
export const STEP_MIN = 0.02;
export const STEP_MAX = 1;
export const ESCAPE_RADIUS = 36;

/** Keplerian spin: the disk turns at SPIN / r^1.5 radians per second. */
export const SPIN = 1.6;
/** Two noise layers drift for this long each and cross-fade, so the
    differential rotation never winds the turbulence up into stripes. */
export const FLOW_PERIOD = 14;
/** Relativistic beaming: brightness × g^BEAMING (g: the Doppler factor). */
export const BEAMING = 2;
/** Tone mapping: lum = 1 − exp(−EXPOSURE · light). */
export const EXPOSURE = 2.4;

/** Stars: one per lattice cell of the escape direction, now and then. */
export const STAR_GRID = 110;
export const STAR_DENSITY = 0.005;

/** A ring of light that runs out through the disk (a tap, a release). */
export const PULSE_SPEED = 7;
export const PULSE_GAIN = 1.6;

/** Lattice offset: keeps noise and star coordinates positive. */
export const LATTICE = 4096;

/* ── Camera ──────────────────────────────────────────────────────────────── */

export interface HoleView {
  /** Orbit around the hole's axis, radians. */
  azimuth: number;
  /** Height above the disk plane, radians: near 0 is edge-on. */
  inclination: number;
  roll: number;
  /** Camera distance factor: below 1 the hole looms larger. */
  zoom: number;
  /** Disk rotation clock, seconds (runs faster under gravity). */
  diskTime: number;
  /** Wall clock, seconds: star twinkle. */
  time: number;
  /** Seconds since the last pulse; a large number for none. */
  pulse: number;
  /** Light multiplier. */
  gain: number;
}

export const REST_INCLINATION = 0.15;
export const REST_ROLL = 0.11;
export const NO_PULSE = 1e3;

/** The scene on its own: a slow orbit, a gentle nod, the disk turning. */
export function idleView(time: number): HoleView {
  return {
    azimuth: 0.035 * time,
    inclination: REST_INCLINATION + 0.035 * Math.sin(0.23 * time),
    roll: REST_ROLL,
    zoom: 1,
    diskTime: time,
    time,
    pulse: NO_PULSE,
    gain: 1,
  };
}

export type Vec3 = [number, number, number];

export interface CameraFrame {
  eye: Vec3;
  right: Vec3;
  up: Vec3;
  forward: Vec3;
}

const normalize = ([x, y, z]: Vec3): Vec3 => {
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
};
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

/** Camera on a sphere around the hole, looking at it; the disk is y = 0. */
export function cameraFrame(view: HoleView): CameraFrame {
  const d = CAMERA_DISTANCE * view.zoom;
  const ci = Math.cos(view.inclination);
  const eye: Vec3 = [
    d * ci * Math.sin(view.azimuth),
    d * Math.sin(view.inclination),
    d * ci * Math.cos(view.azimuth),
  ];
  const forward = normalize([-eye[0], -eye[1], -eye[2]]);
  const right0 = normalize(cross(forward, [0, 1, 0]));
  const up0 = cross(right0, forward);
  const c = Math.cos(view.roll);
  const s = Math.sin(view.roll);
  return {
    eye,
    forward,
    right: [
      right0[0] * c + up0[0] * s,
      right0[1] * c + up0[1] * s,
      right0[2] * c + up0[2] * s,
    ],
    up: [
      up0[0] * c - right0[0] * s,
      up0[1] * c - right0[1] * s,
      up0[2] * c - right0[2] * s,
    ],
  };
}

/* ── Noise (integer hash, same as the shader) ───────────────────────────── */

/** pcg3d (Jarzynski & Olano), one 32-bit output. */
export function hash3(x: number, y: number, z: number): number {
  x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
  y = (Math.imul(y, 1664525) + 1013904223) >>> 0;
  z = (Math.imul(z, 1664525) + 1013904223) >>> 0;
  x = (x + Math.imul(y, z)) >>> 0;
  y = (y + Math.imul(z, x)) >>> 0;
  z = (z + Math.imul(x, y)) >>> 0;
  x = (x ^ (x >>> 16)) >>> 0;
  y = (y ^ (y >>> 16)) >>> 0;
  z = (z ^ (z >>> 16)) >>> 0;
  x = (x + Math.imul(y, z)) >>> 0;
  y = (y + Math.imul(z, x)) >>> 0;
  z = (z + Math.imul(x, y)) >>> 0;
  return (x ^ y ^ z) >>> 0;
}

/** Hash of a lattice point as [0, 1), with 24 bits (exact in float32). */
const unit = (x: number, y: number, z: number) =>
  (hash3(x + LATTICE, y + LATTICE, z + LATTICE) >>> 8) / 16777216;

const fade = (t: number) => t * t * (3 - 2 * t);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

export function noise3(x: number, y: number, z: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const ux = fade(x - ix);
  const uy = fade(y - iy);
  const uz = fade(z - iz);
  const corner = (dx: number, dy: number, dz: number) =>
    unit(ix + dx, iy + dy, iz + dz);
  return mix(
    mix(
      mix(corner(0, 0, 0), corner(1, 0, 0), ux),
      mix(corner(0, 1, 0), corner(1, 1, 0), ux),
      uy,
    ),
    mix(
      mix(corner(0, 0, 1), corner(1, 0, 1), ux),
      mix(corner(0, 1, 1), corner(1, 1, 1), ux),
      uy,
    ),
    uz,
  );
}

export function fbm(x: number, y: number, z: number): number {
  return (
    0.5 * noise3(x, y, z) +
    0.3 * noise3(x * 2.07 + 17.1, y * 2.07 + 17.1, z * 2.07 + 17.1) +
    0.2 * noise3(x * 4.13 + 41.7, y * 4.13 + 41.7, z * 4.13 + 41.7)
  );
}

/* ── Tracing ─────────────────────────────────────────────────────────────── */

const clamp = (x: number, lo = 0, hi = 1) => (x < lo ? lo : x > hi ? hi : x);
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const fract = (x: number) => x - Math.floor(x);

/** Tangential and radial frequency of the disk's turbulence. */
export const TANGENTIAL = 2.2;
export const RADIAL = 1.3;
/** Brightness falls off as (DISK_INNER / r)^FALLOFF. */
export const FALLOFF = 1.25;

/**
 * Light and opacity of the disk where a ray crosses it, at `(x, z)` with
 * the ray travelling along `(vx, vy, vz)` (from the camera).
 */
export function diskAt(
  x: number,
  z: number,
  vx: number,
  vy: number,
  vz: number,
  diskTime: number,
  pulse: number,
): [number, number] {
  const r = Math.hypot(x, z);
  if (r < DISK_INNER || r > DISK_OUTER) return [0, 0];
  const phi = Math.atan2(z, x);
  const omega = SPIN / (r * Math.sqrt(r));

  // Turbulence in the gas's own frame: a cylinder of noise (seamless round
  // the hole), stretched along the orbit so it reads as streaks.
  const flow = diskTime / FLOW_PERIOD;
  let grain = 0;
  for (let k = 0; k < 2; k += 1) {
    const phase = fract(flow + 0.5 * k);
    const weight = 1 - Math.abs(2 * phase - 1);
    const a = phi - omega * phase * FLOW_PERIOD;
    grain +=
      weight *
      fbm(
        Math.cos(a) * TANGENTIAL + 9.7 * k,
        Math.sin(a) * TANGENTIAL,
        r * RADIAL,
      );
  }

  const falloff = Math.pow(DISK_INNER / r, FALLOFF);
  const edges =
    smoothstep(DISK_INNER, DISK_INNER + 0.8, r) *
    (1 - smoothstep(DISK_OUTER * 0.6, DISK_OUTER, r));

  // Doppler: the gas orbits at sqrt(0.5 / r) of light speed; its approaching
  // side is beamed brighter, and climbing out of the well dims it all.
  const speed = Math.sqrt(0.5 / r);
  const vl = Math.hypot(vx, vy, vz) || 1;
  const toward = (Math.sin(phi) * vx - Math.cos(phi) * vz) / vl;
  const gamma = 1 / Math.sqrt(1 - speed * speed);
  const g = 1 / (gamma * (1 - speed * toward));
  const redshift = Math.sqrt(1 - 1 / r);

  const ring = (r - (DISK_INNER + PULSE_SPEED * pulse)) / 1.4;
  const flash = PULSE_GAIN * Math.exp(-ring * ring) * Math.exp(-pulse * 0.5);

  const light =
    (falloff * (0.18 + 1.25 * smoothstep(0.28, 0.75, grain)) + flash) *
    edges *
    Math.pow(g, BEAMING) *
    redshift;
  const opacity = edges * (0.55 + 0.4 * grain);
  return [light, opacity];
}

/** Starlight for a ray escaping along `(x, y, z)`. */
export function starAt(x: number, y: number, z: number, time: number): number {
  const l = Math.hypot(x, y, z) || 1;
  const ix = Math.floor((x / l) * STAR_GRID);
  const iy = Math.floor((y / l) * STAR_GRID);
  const iz = Math.floor((z / l) * STAR_GRID);
  if (unit(ix, iy, iz) >= STAR_DENSITY) return 0;
  const shade = unit(iz, ix, iy + 77);
  return (
    (0.35 + 0.65 * shade) *
    (0.7 + 0.3 * Math.sin(time * (1 + 2 * shade) + 6.283 * shade))
  );
}

/**
 * Trace one ray back from the camera; returns its tone-mapped light, 0–1.
 * Captured rays stay dark; the disk is crossed as often as the ray bends
 * round, each crossing seen through the ones in front.
 */
export function traceRay(
  eye: Vec3,
  dir: Vec3,
  view: Pick<HoleView, "diskTime" | "time" | "pulse" | "gain">,
): number {
  let [px, py, pz] = eye;
  let [vx, vy, vz] = dir;
  const cx = py * vz - pz * vy;
  const cy = pz * vx - px * vz;
  const cz = px * vy - py * vx;
  const h2 = cx * cx + cy * cy + cz * cz;

  let light = 0;
  let alpha = 0;
  for (let i = 0; i < MAX_STEPS; i += 1) {
    const r2 = px * px + py * py + pz * pz;
    const r = Math.sqrt(r2);
    if (r < 1) break;
    if (r > ESCAPE_RADIUS && px * vx + py * vy + pz * vz > 0) {
      light += (1 - alpha) * starAt(vx, vy, vz, view.time);
      break;
    }
    const dt = clamp(STEP * r, STEP_MIN, STEP_MAX);
    const pull = (-1.5 * h2) / (r2 * r2 * r);
    vx += pull * px * dt;
    vy += pull * py * dt;
    vz += pull * pz * dt;
    const qx = px;
    const qy = py;
    const qz = pz;
    px += vx * dt;
    py += vy * dt;
    pz += vz * dt;
    if (qy * py < 0) {
      const f = qy / (qy - py);
      const [glow, opacity] = diskAt(
        qx + (px - qx) * f,
        qz + (pz - qz) * f,
        vx,
        vy,
        vz,
        view.diskTime,
        view.pulse,
      );
      light += (1 - alpha) * glow;
      alpha += (1 - alpha) * opacity;
      if (alpha > 0.98) break;
    }
  }
  return 1 - Math.exp(-EXPOSURE * view.gain * light);
}

/* ── Glyphs ──────────────────────────────────────────────────────────────── */

/**
 * Density ramp, thin → dense, with each glyph's measured ink coverage in
 * Geist Mono 500 (share of the 0.6em × 1.2em cell). Letters and digits in
 * the dense half give the image texture, like a printout.
 */
export const RAMP: readonly (readonly [string, number])[] = [
  [" ", 0],
  [".", 0.0275],
  [",", 0.0455],
  [":", 0.0551],
  [";", 0.073],
  ["!", 0.0997],
  ["=", 0.1165],
  ["+", 0.1227],
  ["*", 0.1405],
  ["i", 0.1695],
  ["x", 0.1709],
  ["1", 0.1924],
  ["I", 0.2084],
  ["X", 0.2304],
  ["3", 0.2422],
  ["A", 0.2458],
  ["#", 0.2528],
  ["5", 0.2579],
  ["H", 0.2649],
  ["S", 0.2707],
  ["G", 0.281],
  ["9", 0.2918],
  ["8", 0.2972],
  ["&", 0.3109],
  ["@", 0.3303],
  ["$", 0.3336],
];

export const GLYPHS = RAMP.map(([glyph]) => glyph).join("");

/** Below this tone a cell stays empty. */
export const TONE_EMPTY = 0.035;
/** Light → tone: lifts the dim outer disk into the visible glyphs. */
export const TONE_GAMMA = 0.85;

/** Tone (0–1, in 64 steps) → glyph index, matching ink to tone. */
export const TONE_LUT: readonly number[] = Array.from(
  { length: 64 },
  (_, k) => {
    const tone = k / 63;
    if (tone < TONE_EMPTY) return 0;
    const target =
      0.0275 + ((tone - TONE_EMPTY) / (1 - TONE_EMPTY)) * (0.3336 - 0.0275);
    let best = 1;
    for (let i = 1; i < RAMP.length; i += 1) {
      const ink = RAMP[i]?.[1] ?? 0;
      const bestInk = RAMP[best]?.[1] ?? 0;
      if (Math.abs(ink - target) < Math.abs(bestInk - target)) best = i;
    }
    return best;
  },
);

export const toneOf = (light: number) => Math.pow(light, TONE_GAMMA);

/* ── Ink ─────────────────────────────────────────────────────────────────── */

/** Tones where the ink reaches warm and hot (see the draw shader). */
export const WARM_AT = 0.4;
export const HOT_AT = 0.85;

/**
 * The poster's three ink layers, hot → cool: each cell goes to the layer
 * nearest its tone on the live scene's cool → warm → hot gradient.
 */
export function inkLayer(tone: number): 0 | 1 | 2 {
  if (tone >= (WARM_AT + HOT_AT) / 2) return 0;
  if (tone >= (0.08 + WARM_AT) / 2) return 1;
  return 2;
}

/* ── Poster ──────────────────────────────────────────────────────────────── */

/** Every ray of one frame, top row first: `cols·SUB × rows·SUB` lights. */
export function traceFrame(layout: HoleLayout, view: HoleView): Float32Array {
  const w = layout.cols * SUB;
  const h = layout.rows * SUB;
  const tanY = TAN_HALF_FOV / imageAspect(layout);
  const { eye, right, up, forward } = cameraFrame(view);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y += 1) {
    const v = (1 - ((y + 0.5) / h) * 2) * tanY;
    for (let x = 0; x < w; x += 1) {
      const u = (((x + 0.5) / w) * 2 - 1) * TAN_HALF_FOV;
      const dir = normalize([
        forward[0] + right[0] * u + up[0] * v,
        forward[1] + right[1] * u + up[1] * v,
        forward[2] + right[2] * u + up[2] * v,
      ]);
      out[y * w + x] = traceRay(eye, dir, view);
    }
  }
  return out;
}

/**
 * One frame as text: three layers of the same grid (hot, warm, cool), each
 * holding only its own cells, so CSS can ink them like the live scene does.
 */
export function rasterizeHole(layout: HoleLayout, view: HoleView): string[] {
  const lights = traceFrame(layout, view);
  const w = layout.cols * SUB;
  const layers = [0, 1, 2].map(() =>
    Array.from({ length: layout.rows }, () =>
      new Array<string>(layout.cols).fill(" "),
    ),
  );
  for (let r = 0; r < layout.rows; r += 1) {
    for (let c = 0; c < layout.cols; c += 1) {
      let sum = 0;
      for (let dy = 0; dy < SUB; dy += 1) {
        for (let dx = 0; dx < SUB; dx += 1) {
          sum += lights[(r * SUB + dy) * w + c * SUB + dx] ?? 0;
        }
      }
      const tone = toneOf(sum / (SUB * SUB));
      const glyph = GLYPHS[TONE_LUT[Math.round(tone * 63)] ?? 0] ?? " ";
      if (glyph === " ") continue;
      const row = layers[inkLayer(tone)]?.[r];
      if (row) row[c] = glyph;
    }
  }
  return layers.map((rows) => rows.map((row) => row.join("")).join("\n"));
}
