import { createRibbonFrames } from "./infinity-path";

/**
 * The ∞ ribbon, as text. One description of the sculpture — mesh, pose,
 * camera, shading and glyph choice — shared by two renderers:
 *
 * - `rasterizeAscii` (here, pure TS) runs on the server at build time and
 *   produces the static poster. It is the first frame of the scene.
 * - `ascii-gl.ts` runs the same mesh, `shade` and glyph matching on the GPU,
 *   so the live scene picks up exactly where the poster left off.
 *
 * Glyphs are chosen by *shape*, not only by brightness: every cell is
 * sampled 2×3 and matched against how each glyph's ink fills the same 2×3
 * grid, so silhouettes are drawn with / \ ( ) _ instead of a staircase of
 * density characters. Depth then picks the ink colour (near is bright, far
 * sinks into the background) — the two cues that make it read as an object.
 */

/* ── Glyphs ──────────────────────────────────────────────────────────────── */

/**
 * Ink per sixth of the cell (top-left, top-right, mid-left, mid-right,
 * bottom-left, bottom-right), measured from the mono font. Symbols only:
 * letters would make the ribbon read as words.
 */
export const GLYPH_SHAPES: readonly (readonly [string, readonly number[]])[] = [
  [" ", [0, 0, 0, 0, 0, 0]],
  [".", [0, 0, 0.007, 0.007, 0.1, 0.1]],
  [",", [0, 0, 0.005, 0.009, 0.187, 0.107]],
  [":", [0.066, 0.066, 0.036, 0.036, 0.1, 0.1]],
  [";", [0.068, 0.068, 0.042, 0.045, 0.201, 0.093]],
  ["'", [0.125, 0.126, 0.016, 0.016, 0, 0]],
  ["`", [0.103, 0.033, 0, 0, 0, 0]],
  ["^", [0.19, 0.188, 0.102, 0.101, 0, 0]],
  ["~", [0, 0, 0.271, 0.271, 0, 0]],
  ["-", [0, 0, 0.128, 0.128, 0, 0]],
  ["_", [0, 0, 0, 0, 0.18, 0.18]],
  ["=", [0.05, 0.05, 0.294, 0.294, 0, 0]],
  ["+", [0.043, 0.043, 0.3, 0.3, 0.017, 0.017]],
  ["*", [0.067, 0.067, 0.41, 0.41, 0.01, 0.01]],
  ["<", [0.004, 0.143, 0.339, 0.187, 0, 0.047]],
  [">", [0.145, 0.004, 0.185, 0.338, 0.047, 0]],
  ["!", [0.132, 0.132, 0.111, 0.111, 0.075, 0.076]],
  ["|", [0.15, 0.15, 0.15, 0.15, 0.11, 0.11]],
  ["/", [0.001, 0.316, 0.215, 0.102, 0.231, 0]],
  ["\\", [0.316, 0.001, 0.102, 0.215, 0, 0.231]],
  ["(", [0.203, 0.168, 0.302, 0, 0.093, 0.194]],
  [")", [0.168, 0.203, 0, 0.302, 0.193, 0.093]],
  ["[", [0.302, 0.075, 0.3, 0, 0.223, 0.12]],
  ["]", [0.075, 0.302, 0, 0.3, 0.12, 0.223]],
  ["{", [0.051, 0.31, 0.225, 0.2, 0.036, 0.257]],
  ["}", [0.322, 0.042, 0.243, 0.205, 0.259, 0.036]],
  ["#", [0.27, 0.288, 0.379, 0.36, 0.093, 0.093]],
  ["%", [0.443, 0.195, 0.293, 0.401, 0.099, 0.239]],
  ["&", [0.286, 0.18, 0.411, 0.378, 0.233, 0.212]],
  ["@", [0.273, 0.302, 0.44, 0.435, 0.319, 0.244]],
  ["$", [0.352, 0.312, 0.273, 0.393, 0.23, 0.249]],
];

export const GLYPHS = GLYPH_SHAPES.map(([glyph]) => glyph).join("");
/** Densest ink in the table: light 1.0 maps to this much ink. */
export const MAX_INK = 0.47;
/** > 1 exaggerates contrast inside a cell so edges snap to edge glyphs. */
export const SHARPEN = 1.7;
/** Below this peak brightness a cell stays empty. */
export const EMPTY_BELOW = 0.05;

/**
 * Tone ramp (dark → bright) for cells with no edge inside them. Shape
 * matching on an evenly lit cell picks whichever glyph spreads its ink most
 * evenly — `|` — and turns flat areas into a fence; density reads better.
 */
export const RAMP = ".:-=+*#%@";
export const RAMP_INDEX = [...RAMP].map((glyph) => GLYPHS.indexOf(glyph));
/** Brightness span inside a cell above which it counts as an edge. */
export const EDGE_SPREAD = 0.2;
/** Shading range mapped onto the ramp (see `shade`). */
export const RAMP_LOW = 0.28;
export const RAMP_HIGH = 1.1;

/**
 * Index into GLYPHS for a cell: interiors by tone, edges (partly covered, or
 * a strong gradient across the cell) by the glyph whose ink layout best
 * matches the cell's light layout.
 */
export function matchGlyph(shape: readonly number[]): number {
  const peak = Math.max(...shape);
  if (peak < EMPTY_BELOW) return 0;
  const low = Math.min(...shape);
  if (low >= EMPTY_BELOW && peak - low < EDGE_SPREAD) {
    const mean = shape.reduce((sum, x) => sum + x, 0) / shape.length;
    const t = Math.min(
      Math.max((mean - RAMP_LOW) / (RAMP_HIGH - RAMP_LOW), 0),
      1,
    );
    return RAMP_INDEX[Math.round(t * (RAMP.length - 1))]!;
  }
  const v = shape.map(
    (x) => Math.min(peak * Math.pow(x / peak, SHARPEN), 1) * MAX_INK,
  );
  let best = 0;
  let bestDistance = Infinity;
  GLYPH_SHAPES.forEach(([, ink], index) => {
    let d = 0;
    for (let k = 0; k < 6; k += 1) d += (v[k]! - ink[k]!) ** 2;
    if (d < bestDistance) {
      bestDistance = d;
      best = index;
    }
  });
  return best;
}

/* ── Layouts ─────────────────────────────────────────────────────────────── */

export interface AsciiLayout {
  cols: number;
  rows: number;
  /** Box aspect (width / height) the grid fills. */
  aspect: number;
}

/**
 * Cells are twice as tall as wide (Geist Mono advances 0.6em, lines are
 * 1.2em), so `rows = cols / (2 · aspect)`. The ∞ is about 2.8:1, so both
 * boxes are wide: a band across the page, and a shorter one on phones.
 */
export const LAYOUTS = {
  band: { cols: 140, rows: 28, aspect: 2.5 },
  compact: { cols: 72, rows: 20, aspect: 1.8 },
} as const satisfies Record<string, AsciiLayout>;

export type LayoutName = keyof typeof LAYOUTS;

/** Samples per cell, matching the glyph table's 2×3 grid. */
export const SUB_X = 2;
export const SUB_Y = 3;

/* ── Pose ────────────────────────────────────────────────────────────────── */

const FOV_Y = (38 * Math.PI) / 180;
/** Half extents of the ribbon (plus its width) to keep in frame. */
const FIT_HALF_WIDTH = 1.62;
const FIT_HALF_HEIGHT = 1.2;

/** Camera distance that fits the ribbon in a viewport of `aspect` (w/h). */
export function cameraDistance(aspect: number): number {
  const t = Math.tan(FOV_Y / 2);
  return Math.max(FIT_HALF_HEIGHT / t, FIT_HALF_WIDTH / (t * aspect)) + 0.2;
}

export interface Pose {
  yaw: number;
  pitch: number;
  /**
   * How far the strip has rolled around its own centre line. The ∞ never
   * turns away from the reader; its surface does — like a conveyor belt
   * running along the loop — so it keeps spinning and still reads as ∞.
   */
  roll: number;
}

/** Facing the reader, tipped back just enough to show it has depth. */
export const REST_POSE: Pose = { yaw: 0.2, pitch: 0.1, roll: 0 };

/**
 * The sculpture is always turning: the strip rolls around its centre line
 * at a steady pace, while the whole ∞ swings slowly from side to side and
 * breathes in pitch — enough parallax between the strands to read as depth,
 * never enough to show it edge-on. `idlePose(0)` is the poster.
 */
export function idlePose(seconds: number): Pose {
  return {
    yaw: REST_POSE.yaw + Math.sin(seconds * 0.36) * 0.3,
    pitch: REST_POSE.pitch + Math.sin(seconds * 0.27 + 1.1) * 0.07,
    roll: REST_POSE.roll + seconds * 0.55,
  };
}

/**
 * How far a drag may turn the ribbon on top of its own swing. Past the soft
 * limit the pull meets growing resistance (a rubber band), so from any angle
 * the reader can reach it still reads as ∞; letting go springs it back.
 */
export const TURN_LIMIT = { yaw: 0.6, pitch: 0.4 } as const;

export function elastic(value: number, limit: number): number {
  return limit * Math.tanh(value / limit);
}

/* ── Matrices (column-major, WebGL convention) ───────────────────────────── */

export type Mat4 = Float32Array;

/** Rotation: pitch about x, then yaw about y. */
export function modelMatrix({ yaw, pitch }: Pose): Mat4 {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cx = Math.cos(pitch);
  const sx = Math.sin(pitch);
  // R = Rx(pitch) · Ry(yaw)
  // prettier-ignore
  return new Float32Array([
    cy, sx * sy, -cx * sy, 0,
    0, cx, sx, 0,
    sy, -sx * cy, cx * cy, 0,
    0, 0, 0, 1,
  ]);
}

export function perspective(aspect: number, near = 0.1, far = 20): Mat4 {
  const f = 1 / Math.tan(FOV_Y / 2);
  const nf = 1 / (near - far);
  // prettier-ignore
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ]);
}

/* ── Mesh ────────────────────────────────────────────────────────────────── */

/**
 * The strip, stored so it can roll: every vertex keeps its point on the
 * centre line, the two axes of the cross-section there (width and depth,
 * unit vectors) and its signed offset across the width. The surface at a
 * given roll is `center + (width·cos r + depth·sin r) · offset`.
 */
export interface RibbonMesh {
  centers: Float32Array;
  widths: Float32Array;
  depths: Float32Array;
  offsets: Float32Array;
  indices: Uint16Array;
}

const SEGMENTS = 320;
/** Vertices across the ribbon's width. */
const ACROSS = 5;

/**
 * A zero-thickness strip swept along the figure-eight. The half-twist means
 * the last ring meets the first one flipped, so the seam joins column j to
 * column ACROSS-1-j — and since rolling turns every cross-section by the
 * same angle, the seam stays closed at any roll. Shading is two-sided, so
 * the flipped normal is harmless.
 */
export function buildRibbonMesh(): RibbonMesh {
  const frames = createRibbonFrames(SEGMENTS);
  const count = SEGMENTS * ACROSS;
  const centers = new Float32Array(count * 3);
  const widths = new Float32Array(count * 3);
  const depths = new Float32Array(count * 3);
  const offsets = new Float32Array(count);

  frames.forEach((frame, i) => {
    for (let j = 0; j < ACROSS; j += 1) {
      const v = i * ACROSS + j;
      centers.set(frame.center, v * 3);
      widths.set(frame.width, v * 3);
      depths.set(frame.depth, v * 3);
      offsets[v] = (j / (ACROSS - 1) - 0.5) * 2 * ribbonHalfWidth(frame.u);
    }
  });

  const indices = new Uint16Array(SEGMENTS * (ACROSS - 1) * 6);
  let n = 0;
  for (let i = 0; i < SEGMENTS; i += 1) {
    const next = (i + 1) % SEGMENTS;
    const seam = next === 0;
    for (let j = 0; j < ACROSS - 1; j += 1) {
      const a = i * ACROSS + j;
      const b = i * ACROSS + j + 1;
      const c = next * ACROSS + (seam ? ACROSS - 1 - j : j);
      const d = next * ACROSS + (seam ? ACROSS - 2 - j : j + 1);
      indices.set([a, c, b, b, c, d], n);
      n += 6;
    }
  }

  return { centers, widths, depths, offsets, indices };
}

/**
 * Narrow enough that both loops of the ∞ stay open from the front, with the
 * same organic variation along the loop as the original sculpture.
 */
function ribbonHalfWidth(u: number): number {
  return 0.25 * (1 + Math.sin(u * 5 - 0.6) * 0.1 + Math.sin(u * 9) * 0.04);
}

/* ── Shading ─────────────────────────────────────────────────────────────── */

/** View-space key light, up and to the left. */
export const LIGHT: readonly [number, number, number] = (() => {
  const l = [-0.45, 0.62, 0.64];
  const len = Math.hypot(l[0]!, l[1]!, l[2]!);
  return [l[0]! / len, l[1]! / len, l[2]! / len] as const;
})();

/**
 * Brightness in [0, ~1] for a surface point. Mirrored line for line in the
 * GLSL of `ascii-gl.ts` — change one, change both.
 *
 * `n` is already flipped to face the viewer, `v` points at the camera.
 */
export function shade(
  n: readonly [number, number, number],
  v: readonly [number, number, number],
): number {
  const [lx, ly, lz] = LIGHT;
  const lambert = Math.max(n[0] * lx + n[1] * ly + n[2] * lz, 0);
  let hx = lx + v[0];
  let hy = ly + v[1];
  let hz = lz + v[2];
  const hl = Math.hypot(hx, hy, hz) || 1;
  hx /= hl;
  hy /= hl;
  hz /= hl;
  const spec = Math.pow(Math.max(n[0] * hx + n[1] * hy + n[2] * hz, 0), 24);
  const facing = Math.max(n[0] * v[0] + n[1] * v[1] + n[2] * v[2], 0);
  const rim = Math.pow(1 - facing, 2);
  return Math.min(0.3 + 0.62 * lambert + 0.55 * spec + 0.35 * rim, 1.15);
}

/**
 * 0 = the far edge of the sculpture, 1 = the near edge. The ribbon spans
 * about ±1 around the origin in depth, whatever the pose.
 */
export function nearness(dist: number, camera: number): number {
  return Math.min(Math.max((camera + 1 - dist) / 2, 0), 1);
}

/** Depth buckets the static poster is split into (one text layer each). */
export const DEPTH_LAYERS = 3;

export function depthLayer(near: number): number {
  return Math.min(DEPTH_LAYERS - 1, Math.floor((1 - near) * DEPTH_LAYERS));
}

/* ── CPU rasterizer (server-side poster) ─────────────────────────────────── */

let cachedMesh: RibbonMesh | undefined;

/**
 * Renders the ribbon at `pose` into text, one string per depth layer (near
 * first). Layers hold spaces wherever another layer has the glyph, so they
 * stack into a single image. A z-buffered triangle rasterizer over a 2×3
 * sample grid per cell; flat shading per triangle is indistinguishable from
 * the GPU's smooth shading at this size.
 */
export function rasterizeAscii(layout: AsciiLayout, pose: Pose): string[] {
  const mesh = (cachedMesh ??= buildRibbonMesh());
  const sw = layout.cols * SUB_X;
  const sh = layout.rows * SUB_Y;
  const camera = cameraDistance(layout.aspect);
  const model = modelMatrix(pose);
  const proj = perspective(layout.aspect);

  const vertexCount = mesh.offsets.length;
  const view = new Float32Array(vertexCount * 3);
  const screen = new Float32Array(vertexCount * 2);
  const normal = new Float32Array(vertexCount * 3);
  const cr = Math.cos(pose.roll);
  const sr = Math.sin(pose.roll);

  for (let i = 0; i < vertexCount; i += 1) {
    const p = i * 3;
    const offset = mesh.offsets[i]!;
    const wx = mesh.widths[p]! * cr + mesh.depths[p]! * sr;
    const wy = mesh.widths[p + 1]! * cr + mesh.depths[p + 1]! * sr;
    const wz = mesh.widths[p + 2]! * cr + mesh.depths[p + 2]! * sr;
    const x = mesh.centers[p]! + wx * offset;
    const y = mesh.centers[p + 1]! + wy * offset;
    const z = mesh.centers[p + 2]! + wz * offset;
    const vx = model[0]! * x + model[4]! * y + model[8]! * z;
    const vy = model[1]! * x + model[5]! * y + model[9]! * z;
    const vz = model[2]! * x + model[6]! * y + model[10]! * z - camera;
    view[p] = vx;
    view[p + 1] = vy;
    view[p + 2] = vz;
    const w = -vz;
    screen[i * 2] = ((proj[0]! * vx) / w) * 0.5 * sw + sw / 2;
    screen[i * 2 + 1] = sh / 2 - ((proj[5]! * vy) / w) * 0.5 * sh;
    const nx = mesh.depths[p]! * cr - mesh.widths[p]! * sr;
    const ny = mesh.depths[p + 1]! * cr - mesh.widths[p + 1]! * sr;
    const nz = mesh.depths[p + 2]! * cr - mesh.widths[p + 2]! * sr;
    normal[p] = model[0]! * nx + model[4]! * ny + model[8]! * nz;
    normal[p + 1] = model[1]! * nx + model[5]! * ny + model[9]! * nz;
    normal[p + 2] = model[2]! * nx + model[6]! * ny + model[10]! * nz;
  }

  const depth = new Float32Array(sw * sh).fill(-Infinity);
  const lum = new Float32Array(sw * sh);
  const near = new Float32Array(sw * sh);

  for (let t = 0; t < mesh.indices.length; t += 3) {
    const ia = mesh.indices[t]!;
    const ib = mesh.indices[t + 1]!;
    const ic = mesh.indices[t + 2]!;
    const ax = screen[ia * 2]!;
    const ay = screen[ia * 2 + 1]!;
    const bx = screen[ib * 2]!;
    const by = screen[ib * 2 + 1]!;
    const cx = screen[ic * 2]!;
    const cy = screen[ic * 2 + 1]!;
    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (Math.abs(area) < 1e-9) continue;

    // Flat shading from the triangle's centroid.
    let nx = normal[ia * 3]! + normal[ib * 3]! + normal[ic * 3]!;
    let ny = normal[ia * 3 + 1]! + normal[ib * 3 + 1]! + normal[ic * 3 + 1]!;
    let nz = normal[ia * 3 + 2]! + normal[ib * 3 + 2]! + normal[ic * 3 + 2]!;
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl;
    ny /= nl;
    nz /= nl;
    const px = (view[ia * 3]! + view[ib * 3]! + view[ic * 3]!) / 3;
    const py = (view[ia * 3 + 1]! + view[ib * 3 + 1]! + view[ic * 3 + 1]!) / 3;
    const pz = (view[ia * 3 + 2]! + view[ib * 3 + 2]! + view[ic * 3 + 2]!) / 3;
    const pl = Math.hypot(px, py, pz) || 1;
    const v: [number, number, number] = [-px / pl, -py / pl, -pz / pl];
    if (nx * v[0] + ny * v[1] + nz * v[2] < 0) {
      nx = -nx;
      ny = -ny;
      nz = -nz;
    }
    const value = shade([nx, ny, nz], v);
    const closeness = nearness(-pz, camera);

    const minX = Math.max(Math.floor(Math.min(ax, bx, cx)), 0);
    const maxX = Math.min(Math.ceil(Math.max(ax, bx, cx)), sw - 1);
    const minY = Math.max(Math.floor(Math.min(ay, by, cy)), 0);
    const maxY = Math.min(Math.ceil(Math.max(ay, by, cy)), sh - 1);
    const za = view[ia * 3 + 2]!;
    const zb = view[ib * 3 + 2]!;
    const zc = view[ic * 3 + 2]!;

    for (let y = minY; y <= maxY; y += 1) {
      const sy = y + 0.5;
      for (let x = minX; x <= maxX; x += 1) {
        const sx = x + 0.5;
        const w0 = ((bx - sx) * (cy - sy) - (by - sy) * (cx - sx)) / area;
        const w1 = ((cx - sx) * (ay - sy) - (cy - sy) * (ax - sx)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const z = w0 * za + w1 * zb + w2 * zc;
        const s = y * sw + x;
        if (z > depth[s]!) {
          depth[s] = z;
          lum[s] = value;
          near[s] = closeness;
        }
      }
    }
  }

  const layers = Array.from({ length: DEPTH_LAYERS }, () => [] as string[]);
  const shape = [0, 0, 0, 0, 0, 0];
  for (let row = 0; row < layout.rows; row += 1) {
    const lines = Array.from({ length: DEPTH_LAYERS }, () => "");
    for (let col = 0; col < layout.cols; col += 1) {
      let closeness = 0;
      let covered = 0;
      for (let k = 0; k < 6; k += 1) {
        const s =
          (row * SUB_Y + Math.floor(k / 2)) * sw + col * SUB_X + (k % 2);
        shape[k] = lum[s]!;
        if (depth[s]! > -Infinity) {
          closeness += near[s]!;
          covered += 1;
        }
      }
      const glyph = GLYPHS[matchGlyph(shape)]!;
      const layer = covered ? depthLayer(closeness / covered) : -1;
      for (let l = 0; l < DEPTH_LAYERS; l += 1) {
        lines[l] += l === layer ? glyph : " ";
      }
    }
    lines.forEach((line, l) => layers[l]!.push(line));
  }
  return layers.map((lines) => lines.join("\n"));
}
