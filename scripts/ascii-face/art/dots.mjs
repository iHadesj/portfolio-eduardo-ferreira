// The head as a point cloud: the look of a 3D scan. Instead of shading a
// grid fixed to the screen (what turned the face into "text"), the surface
// itself is sampled in rows — rings around the vertical axis, evenly spaced
// on the skin — and each sample becomes a square dot whose size follows its
// light. The rows bend with the face, crowd where it turns away and spread
// where it faces the light, which is what makes it read as a scanned head.

import { headSDF, isEyeAt, normalAt, shadeSkin } from "./head.mjs";
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

/** Rows are rings around this vertical axis (head-local units). */
const AXIS_Z = 0.27;
/** Head-local height range swept by the rows: neck to crown. */
const Y_FROM = -3.6;
const Y_TO = 1.9;
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
  let row = 0;
  for (let y = Y_FROM; y <= Y_TO; y += rowStep, row++) {
    let theta = -Math.PI;
    while (theta < Math.PI) {
      const dir = v3(Math.sin(theta), 0, Math.cos(theta));
      const start = v3(dir[0] * REACH, y, AXIS_Z + dir[2] * REACH);
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
      if (shot) {
        const [x, py, reach] = shot;
        if (x >= 0 && x < width && py >= 0 && py < height && keep(x, py)) {
          const n = normalAt(scene, pw);
          const rd = norm(sub(pw, ro));
          if (dot(n, rd) < -0.04 && !isEyeAt(hit) && visible(pw, reach)) {
            dots.push({
              x,
              y: py,
              lum: shadeSkin(scene, pw, n, rd, L),
              row,
              theta,
            });
          }
        }
      }
      theta += step;
    }
  }
  return dots;
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
 * Halftone in three registers, like a hard-lit photograph pushed to 1 bit:
 * shadows stay black, mid-tones are dots that grow with the light, and
 * highlights take the whole pitch so neighbouring dots merge into solid
 * white planes.
 */
export function dotSize(
  lum,
  pitchPx,
  { gamma = 1.0, floor = 0.14, solid = 0.92, exposure = 1 } = {},
) {
  const tone = Math.pow(lum * exposure, gamma);
  if (tone < floor) return 0;
  if (tone >= solid) return pitchPx;
  const largest = pitchPx - 2;
  const t = (tone - floor) / (solid - floor);
  return Math.max(1, Math.min(largest, Math.round(1 + t * (largest - 1))));
}
