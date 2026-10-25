// The head as a point cloud: the look of a 3D scan. Instead of shading a
// grid fixed to the screen (what turned the face into "text"), the surface
// itself is sampled in rows — horizontal slices of the head, dots evenly
// spaced along what the camera sees of each — and each sample becomes a
// square dot whose size follows its light. The rows bend with the face, crowd where it turns away and spread
// where it faces the light, which is what makes it read as a scanned head.

import {
  headSDF,
  isEyeAt,
  normalAt,
  shadeSurface,
  surfaceAt,
} from "./head.mjs";
import {
  v3,
  add,
  sub,
  mul,
  dot,
  len,
  norm,
  rotX,
  rotY,
  rotZ,
  mat,
  matMul,
  transpose,
} from "./sdf.mjs";

/** Head-local height range swept by the rows: neck to crown. */
const Y_FROM = -3.6;
const Y_TO = 1.9;
/** Half-width of the band each row scans, and how far out its rays start. */
const REACH = 3.2;

/**
 * Samples the visible surface. Returns dots in image pixels:
 * { x, y, lum, row, theta } — `row` and `theta` let callers pick the scan
 * lines (wireframe epoch). `keep(x, y)` lets the caller veto samples early
 * (the dissolving back of the head) before any shading is spent on them.
 */
export function sampleDots({
  width,
  height,
  yaw,
  pitch,
  roll,
  distance,
  fov,
  center,
  light,
  fill,
  pitchPx,
  keep = () => true,
}) {
  const R = matMul(rotY(yaw), matMul(rotX(pitch), rotZ(roll)));
  const Rt = transpose(R);
  const L = norm(light);
  const toWorld = (pl) => add(mat(R, pl), center);
  const scene = (pw) => headSDF(mat(Rt, sub(pw, center)));
  const ro = v3(0, 0, distance);
  const tanF = Math.tan(fov / 2);
  const aspect = width / height;

  // Spacing on the skin so that, facing the camera, rows land `pitchPx`
  // apart; along a row the dots sit a little closer, so rows read as lines.
  const pxPerUnit = height / (2 * distance * tanF);
  const rowStep = pitchPx / pxPerUnit;
  const dotStep = rowStep * 0.8;

  const project = (pw) => {
    const rel = sub(pw, ro);
    const depth = -rel[2];
    if (depth <= 0) return null;
    const x = rel[0] / (depth * tanF * aspect);
    const y = rel[1] / (depth * tanF);
    return [
      ((x + 1) / 2) * width,
      ((1 - y) / 2) * height,
      Math.hypot(rel[0], rel[1], rel[2]),
    ];
  };

  // Is anything in front of the point, seen from the camera?
  const visible = (pw, reach) => {
    const rd = norm(sub(pw, ro));
    let t = distance - 4;
    for (let s = 0; s < 220 && t < reach - 0.012; s++) {
      const d = scene(add(ro, mul(rd, t)));
      if (d < 0.0008) return false;
      t += d * 0.85;
    }
    return true;
  };

  // Each row is a horizontal slice of the head, traced with parallel rays
  // along the camera's view flattened onto the slice, side by side across
  // it: together they find the slice's visible outline — the sides of the
  // nose and of the spine included, which rays from inside the head miss.
  const view = mat(Rt, v3(0, 0, -1));
  const along = norm(v3(view[0], 0, view[2]));
  const across = v3(-along[2], 0, along[0]);
  const fine = dotStep / 2;

  const dots = [];
  for (let row = 0; Y_FROM + row * rowStep <= Y_TO; row++) {
    sampleRow(row, Y_FROM + row * rowStep);
  }
  return dots;

  // The first surface a ray across the slice meets (head-local), or null.
  function cast(y, s) {
    const start = v3(
      across[0] * s - along[0] * REACH,
      y,
      across[2] * s - along[2] * REACH,
    );
    let t = 0;
    for (let i = 0; i < 300 && t < 2 * REACH; i++) {
      const p = add(start, mul(along, t));
      const d = headSDF(p);
      if (d < 0.0008) return p;
      t += Math.max(d * 0.9, 0.0004);
    }
    return null;
  }

  // Walk the outline and drop a dot every `dotStep` along it, so dots stay
  // evenly spaced on the surface: they crowd where it turns away and spread
  // where it faces the camera, which is what makes it read as a 3D scan.
  function sampleRow(row, y) {
    let prev = null;
    let travelled = 0;
    for (let s = -REACH; s <= REACH; s += fine) {
      const hit = cast(y, s);
      if (!hit) {
        prev = null;
        continue;
      }
      const gap = prev ? len(sub(hit, prev)) : Infinity;
      if (gap > 4 * dotStep) {
        // a new stretch: the edge of the head, or surface stepping out from
        // behind something nearer
        emit(hit, row);
        travelled = 0;
      } else {
        let next = dotStep - travelled;
        for (; next <= gap; next += dotStep) {
          emit(onSurface(add(prev, mul(sub(hit, prev), next / gap))), row);
        }
        travelled = gap - (next - dotStep);
      }
      prev = hit;
    }
  }

  // Pull a point between two samples back onto the surface.
  function onSurface(p) {
    let q = p;
    for (let i = 0; i < 2; i++) {
      const d = headSDF(q);
      q = sub(q, mul(normalAt(headSDF, q), d));
    }
    return q;
  }

  function emit(hit, row) {
    const pw = toWorld(hit);
    const shot = project(pw);
    if (!shot) return;
    const [x, py, reach] = shot;
    if (x < 0 || x >= width || py < 0 || py >= height || !keep(x, py)) return;
    const n = normalAt(scene, pw);
    const rd = norm(sub(pw, ro));
    if (dot(n, rd) >= -0.04 || isEyeAt(hit) || !visible(pw, reach)) return;
    dots.push({
      x,
      y: py,
      lum: shadeSurface(scene, pw, n, rd, L, surfaceAt(hit), fill),
      row,
      theta: Math.atan2(hit[0], hit[2] - 0.27),
    });
  }
}

/** A 1-bit canvas: `on` pixels are ink. */
export function bitmap(width, height) {
  const bits = new Uint8Array(width * height);
  return {
    width,
    height,
    bits,
    square(cx, cy, size) {
      const x0 = Math.round(cx - size / 2);
      const y0 = Math.round(cy - size / 2);
      for (let y = Math.max(0, y0); y < Math.min(height, y0 + size); y++) {
        for (let x = Math.max(0, x0); x < Math.min(width, x0 + size); x++) {
          bits[y * width + x] = 1;
        }
      }
    },
  };
}

/**
 * Halftone in flat tones, like a vector illustration printed in dots:
 * shadows stay black, the half-lit planes get small dots, the lit ones big
 * dots, and highlights take the whole pitch so neighbouring dots merge into
 * solid white planes. Few sizes, so each plane of the face reads as one
 * flat tone with a crisp edge to the next.
 */
export function dotSize(
  lum,
  pitchPx,
  { floor = 0.16, mid = 0.42, solid = 0.8 } = {},
) {
  if (lum < floor) return 0;
  if (lum < mid) return Math.max(1, Math.round(pitchPx * 0.34));
  if (lum < solid) return pitchPx - 2;
  return pitchPx;
}
