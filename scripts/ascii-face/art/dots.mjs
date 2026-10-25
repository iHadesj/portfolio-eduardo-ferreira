// The head as a point cloud: the look of a 3D scan. Instead of shading a
// grid fixed to the screen (what turned the face into "text"), the surface
// itself is sampled in rows — rings around a vertical axis, evenly spaced
// on the skin — and each sample becomes a square dot whose size follows its
// light. The rows bend with the face, crowd where it turns away and spread
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
  norm,
  rotX,
  rotY,
  rotZ,
  mat,
  matMul,
  transpose,
} from "./sdf.mjs";

/**
 * Rows are rings around vertical axes (head-local units): one through the
 * head, and one inside each part of the neck that sticks out of it — a ring
 * only finds what faces away from its axis, so the sides of the spine need
 * an axis of their own. Each axis keeps the parts of its group.
 */
const AXES = [
  { z: 0.27, to: 1.9, group: "head" },
  { z: -0.47, to: -0.2, group: "neck" },
  { z: -1.05, to: -0.4, group: "spine" },
];
/** Lowest row, at the bottom of the neck; every axis shares the same rows. */
const Y_FROM = -3.6;
/** Rays start this far from the axis and march inward to the skin. */
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

  const dots = [];
  for (const axis of AXES) {
    for (let row = 0; Y_FROM + row * rowStep <= axis.to; row++) {
      sampleRing(axis, row, Y_FROM + row * rowStep);
    }
  }
  return dots;

  function sampleRing(axis, row, y) {
    let theta = -Math.PI;
    while (theta < Math.PI) {
      const dir = v3(Math.sin(theta), 0, Math.cos(theta));
      const start = v3(dir[0] * REACH, y, axis.z + dir[2] * REACH);
      // march inward from outside the head to the first skin hit
      let t = 0;
      let hit = null;
      for (let s = 0; s < 90 && t < REACH; s++) {
        const p = sub(start, mul(dir, t));
        const d = headSDF(p);
        if (d < 0.0008) {
          hit = p;
          break;
        }
        t += d * 0.9;
      }
      if (!hit) {
        theta += dotStep;
        continue;
      }
      const radius = Math.max(REACH - t, 0.15);
      const step = dotStep / radius;

      const pw = toWorld(hit);
      const shot = project(pw);
      const surface = surfaceAt(hit);
      if (shot && surface.group === axis.group) {
        const [x, py, reach] = shot;
        if (x >= 0 && x < width && py >= 0 && py < height && keep(x, py)) {
          const n = normalAt(scene, pw);
          const rd = norm(sub(pw, ro));
          if (dot(n, rd) < -0.04 && !isEyeAt(hit) && visible(pw, reach)) {
            dots.push({
              x,
              y: py,
              lum: shadeSurface(scene, pw, n, rd, L, surface, fill),
              row,
              theta,
            });
          }
        }
      }
      theta += step;
    }
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
