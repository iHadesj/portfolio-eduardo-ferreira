// Signed distance primitives used to sculpt the head.
// Vectors are plain [x, y, z] arrays: tiny, allocation-light and easy to read.
// Most formulas come from Inigo Quilez's articles (iquilezles.org).

export const v3 = (x, y, z) => [x, y, z];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const len = (a) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a) => mul(a, 1 / (len(a) || 1));
export const clamp = (x, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
export const mix = (a, b, t) => a + (b - a) * t;
export const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

// Rotation matrices (row-major 3x3) and helpers.
export const rotX = (a) => [1, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a)];
export const rotY = (a) => [Math.cos(a), 0, Math.sin(a), 0, 1, 0, -Math.sin(a), 0, Math.cos(a)];
export const rotZ = (a) => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];
export const mat = (m, p) => [
  m[0] * p[0] + m[1] * p[1] + m[2] * p[2],
  m[3] * p[0] + m[4] * p[1] + m[5] * p[2],
  m[6] * p[0] + m[7] * p[1] + m[8] * p[2],
];
export const matMul = (a, b) => {
  const r = new Array(9);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
  return r;
};
export const transpose = (m) => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];

// --- distance functions ----------------------------------------------------

export function sdSphere(p, c, r) {
  return Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]) - r;
}

// Bound-correct-ish ellipsoid approximation.
export function sdEllipsoid(p, c, r) {
  const x = (p[0] - c[0]) / r[0];
  const y = (p[1] - c[1]) / r[1];
  const z = (p[2] - c[2]) / r[2];
  const k0 = Math.hypot(x, y, z);
  const k1 = Math.hypot(x / r[0], y / r[1], z / r[2]);
  return k1 === 0 ? -Math.min(r[0], r[1], r[2]) : (k0 * (k0 - 1)) / k1;
}

export function sdCapsule(p, a, b, r) {
  const pa = sub(p, a);
  const ba = sub(b, a);
  const h = clamp(dot(pa, ba) / dot(ba, ba));
  return len(sub(pa, mul(ba, h))) - r;
}

// Capsule whose radius blends from r1 (at a) to r2 (at b).
export function sdRoundCone(p, a, b, r1, r2) {
  const pa = sub(p, a);
  const ba = sub(b, a);
  const h = clamp(dot(pa, ba) / dot(ba, ba));
  return len(sub(pa, mul(ba, h))) - mix(r1, r2, h);
}

// Polynomial smooth min / max: blend two surfaces over a radius k.
export function smin(a, b, k) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}
export function smax(a, b, k) {
  return -smin(-a, -b, k);
}
