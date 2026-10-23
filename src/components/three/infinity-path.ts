/**
 * The ribbon's backbone: a closed figure-eight that should read as ∞ from
 * every angle the reader can turn it to. So it is symmetric — mirror-image
 * lobes, no tilt — and only two things give it a third dimension:
 *
 * - The crossing never touches. The two strands pass each other at slightly
 *   different depths (`LIFT`), so the waist opens and closes as it turns.
 * - The ribbon keeps its single Möbius half-twist, distributed over a
 *   rotation-minimising frame so the surface never flips abruptly.
 *
 * Pure math, no three.js: the GPU scene and the server-side ASCII poster
 * both sample this same curve, so every rendition matches.
 */

export type Vec3 = [number, number, number];

const TAU = Math.PI * 2;

/** Half-span of the loop along x. */
const SPAN = 1.3;
/** Lobe height relative to the span: full enough to keep both loops open. */
const LOBE_HEIGHT = 1.4;
/** 1 = Bernoulli lemniscate (slender lobes), 0 = Gerono (round lobes). */
const ROUNDNESS = 0.5;
/** Depth that separates the two strands where an infinity sign would cross. */
const LIFT = 0.36;

/**
 * Rotation of the ribbon's width at u = 0. With 0 the right tip would lie
 * flat; a quarter turn back makes the twist visible on both lobes.
 */
const TWIST_PHASE = -0.62;

export function infinityPoint(u: number): Vec3 {
  const s = Math.sin(u);
  const c = Math.cos(u);
  const denominator = 1 + ROUNDNESS * s * s;
  const x = (SPAN * c) / denominator;
  const y = (SPAN * LOBE_HEIGHT * s * c) / denominator;
  return [x, y, LIFT * s];
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const normalize = (a: Vec3): Vec3 => {
  const length = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / length, a[1] / length, a[2] / length];
};

/** Rodrigues rotation of `v` around the unit axis `k`. */
function rotateAround(v: Vec3, k: Vec3, angle: number): Vec3 {
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const kv = cross(k, v);
  const kd = dot(k, v) * (1 - cosA);
  return [
    v[0] * cosA + kv[0] * sinA + k[0] * kd,
    v[1] * cosA + kv[1] * sinA + k[1] * kd,
    v[2] * cosA + kv[2] * sinA + k[2] * kd,
  ];
}

export interface RibbonFrame {
  /** Loop parameter in [0, 2π). */
  u: number;
  center: Vec3;
  tangent: Vec3;
  /** Direction of the ribbon's width (already includes the half-twist). */
  width: Vec3;
  /** Direction of the ribbon's thickness: tangent × width. */
  depth: Vec3;
}

/**
 * Samples `count` frames around the loop with parallel transport (double
 * reflection), then spreads the holonomy plus exactly half a turn along the
 * loop. Closing the mesh with a half-ring offset is then always seamless.
 */
export function createRibbonFrames(count: number): RibbonFrame[] {
  const centers: Vec3[] = [];
  for (let index = 0; index < count; index += 1) {
    centers.push(infinityPoint((index / count) * TAU));
  }

  const tangents: Vec3[] = centers.map((_, index) =>
    normalize(
      sub(centers[(index + 1) % count]!, centers[(index - 1 + count) % count]!),
    ),
  );

  // Start with the ribbon width lying in the drawing plane, perpendicular to
  // the tangent at the right-hand tip.
  const firstTangent = tangents[0]!;
  let reference = normalize(
    sub([1, 0, 0], scale(firstTangent, dot([1, 0, 0], firstTangent))),
  );
  reference = rotateAround(reference, firstTangent, TWIST_PHASE);

  const transported: Vec3[] = [reference];
  for (let index = 0; index < count; index += 1) {
    const next = (index + 1) % count;
    const step = sub(centers[next]!, centers[index]!);
    const c1 = dot(step, step) || 1e-9;
    const current = transported[index]!;
    const reflected = sub(current, scale(step, (2 / c1) * dot(step, current)));
    const reflectedTangent = sub(
      tangents[index]!,
      scale(step, (2 / c1) * dot(step, tangents[index]!)),
    );
    const correction = sub(tangents[next]!, reflectedTangent);
    const c2 = dot(correction, correction) || 1e-9;
    transported.push(
      normalize(
        sub(
          reflected,
          scale(correction, (2 / c2) * dot(correction, reflected)),
        ),
      ),
    );
  }

  // Signed angle that brings the transported frame back onto the start.
  const closing = transported[count]!;
  const holonomy = Math.atan2(
    dot(cross(closing, reference), firstTangent),
    dot(closing, reference),
  );
  const totalTwist = Math.PI + holonomy;

  return centers.map((center, index) => {
    const u = (index / count) * TAU;
    const tangent = tangents[index]!;
    const width = normalize(
      rotateAround(transported[index]!, tangent, (index / count) * totalTwist),
    );
    const depth = normalize(cross(tangent, width));
    return { u, center, tangent, width, depth };
  });
}
