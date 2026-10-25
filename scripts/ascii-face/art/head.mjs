// An android's head sculpted from signed distance functions and ray marched
// into a luminance buffer. No meshes, no photos: just math.
//
// Adapted from the profile README's sculpt (github.com/iHadesj/iHadesJ,
// src/art/head.mjs) and re-sculpted as an android: an idealised, hairless
// face on a long, smooth skull; a round module set into each side of the
// skull where the ears would be; panel seams over the crown, round the back
// and down the jaw; and a mechanical neck — a spine of stacked vertebrae,
// a joint and tubes.
//
// The sculpt is written in centimetres: y = 0 at the chin, x = 0 on the
// midline, the face looking down +z (z = 0 sits just in front of the
// modules). Every part has a material — how much light it gives back and how
// glossy it is — so the metal reads darker than the skin.

import {
  v3, add, sub, mul, dot, norm, clamp, smoothstep,
  rotX, rotY, rotZ, mat, matMul, transpose,
  sdSphere, sdEllipsoid, sdCapsule, sdRoundCone, sdRoundBox, polylineDistance,
  smin, smax,
} from './sdf.mjs';

const CM = 7.5; // one local unit in centimetres
const ORIGIN = v3(0, 11.5, 0); // eye line

const EYE = v3(3.15, 11.4, 7.3); // right/left pupils mirror on x
const EYE_RADIUS = 1.25;

/** The ear modules: one axis through both sides of the skull. */
const MODULE = { y: 13.4, z: -4.3, r: 5.85 };
const BOLT = { y: 16.1, z: 0.1, r: 0.42 };

/** Panel seams: thin grooves, a couple of millimetres deep. */
const SEAM_WIDTH = 0.11;
const SEAM_DEPTH = 0.25;
/** Down the side of the face, from the module to the jaw (side view, z/y). */
const JAW_SEAM = [
  [0.62, 9.96], [1.4, 9.31], [2.44, 8.27], [2.96, 6.71], [3.09, 5.67],
  [3.35, 4.37], [3.74, 3.33], [4.52, 2.55], [5.56, 1.9], [5.95, 0.73],
];

/**
 * Lines drawn on the face, like the strokes of an illustration (side view,
 * z/y; half-width in cm; only past `from` on |x|): the brow, the crease of
 * the upper lid, the wing of the nose and the mouth.
 */
const INK = [
  { width: 0.17, from: 1.5, line: [[5.4, 13.15], [6.3, 13.55], [7.12, 13.68], [8.0, 13.5], [8.9, 13.0]] },
  { width: 0.07, from: 2.0, line: [[6.1, 12.25], [7.2, 12.5], [8.4, 12.45]] },
  { width: 0.08, from: 0.6, line: [[8.75, 8.05], [8.45, 7.5], [8.5, 7.0], [8.85, 6.65], [9.35, 6.55]] },
  { width: 0.07, from: 0.4, line: [[7.7, 4.2], [8.8, 4.36], [10.2, 4.36]] },
];

/**
 * How much light each material gives back, how glossy it is, and which
 * group of parts it belongs to (the point cloud samples each group from its
 * own axis, see dots.mjs).
 */
export const MATERIALS = {
  skin: { albedo: 1, gloss: 0.45, group: 'head' },
  seam: { albedo: 0, gloss: 0, group: 'head' },
  housing: { albedo: 0.15, gloss: 0.8, group: 'head' },
  disc: { albedo: 1, gloss: 0.6, group: 'head' },
  ring: { albedo: 1, gloss: 0.8, group: 'head' },
  socket: { albedo: 0.12, gloss: 0.2, group: 'head' },
  bolt: { albedo: 1, gloss: 1, group: 'head' },
  column: { albedo: 0.35, gloss: 0.4, group: 'neck' },
  tube: { albedo: 0.75, gloss: 1, group: 'neck' },
  spine: { albedo: 0.85, gloss: 0.7, group: 'spine' },
};

function eyes(s) {
  return sdSphere(s, EYE, EYE_RADIUS);
}

function cranium(p) {
  // long and smooth, fuller behind the ears where the modules sit
  let d = sdEllipsoid(p, v3(0, 14.0, -1.2), v3(7.2, 9.1, 10.5));
  d = smin(d, sdEllipsoid(p, v3(0, 14.0, -5.0), v3(7.4, 7.2, 6.6)), 1.5);
  d = smin(d, sdEllipsoid(p, v3(0, 10.5, -6.5), v3(6.0, 4.0, 4.0)), 2.0);
  d = smin(d, sdEllipsoid(p, v3(0, 15.0, 3.6), v3(6.0, 4.6, 6.0)), 1.5);
  // behind the jaw the shell stops short: the neck comes out from under it
  const base = 6.6 - 0.173 * (p[2] + 0.6);
  return smax(d, Math.min(base - p[1], -p[2] - 0.6), 0.8);
}

// The face volume: an ellipsoid whose width tapers from the cheekbones down
// to the chin.
function faceMass(p) {
  const taper = 0.74 + 0.26 * smoothstep(-0.5, 11, p[1]);
  const q = v3(p[0] / taper, p[1], p[2]);
  return sdEllipsoid(q, v3(0, 7.8, 3.3), v3(6.0, 7.8, 6.1)) * taper;
}

// s = point with |x| (the sculpt is symmetric), p = raw point (centimetres)
function skin(p, s) {
  let d = smin(cranium(p), faceMass(p), 3.0);

  // high cheekbones, and a smooth cheek plane under them: a face plate,
  // not a gaunt face
  d = smin(d, sdEllipsoid(s, v3(4.3, 10.0, 6.3), v3(1.7, 0.9, 1.6)), 1.7);
  d = smin(d, sdEllipsoid(s, v3(3.3, 8.0, 6.3), v3(1.5, 1.4, 1.4)), 2.4);
  d = smin(d, sdEllipsoid(s, v3(3.7, 6.6, 5.0), v3(2.0, 3.4, 2.7)), 2.2);

  // brow ridge over deep-set eyes
  d = smin(d, sdCapsule(s, v3(0, 13.1, 9.0), v3(4.1, 13.3, 7.3), 0.72), 1.5);
  d = smax(d, -sdEllipsoid(s, v3(3.2, 11.45, 9.0), v3(1.8, 1.05, 1.4)), 1.0);

  // a long, straight nose off the brow, narrow wings and nostrils
  d = smin(d, sdRoundCone(p, v3(0, 11.6, 9.2), v3(0, 7.95, 11.1), 0.45, 0.6), 0.7);
  d = smin(d, sdSphere(p, v3(0, 7.7, 11.25), 0.62), 0.45);
  d = smin(d, sdCapsule(p, v3(0, 7.3, 11.15), v3(0, 6.5, 9.9), 0.3), 0.5);
  d = smin(d, sdSphere(s, v3(1.05, 7.0, 9.85), 0.6), 0.65);
  d = smax(d, -sdSphere(s, v3(0.6, 6.6, 10.3), 0.24), 0.3);

  // closed lips wrapped round the dental arch, and the fold under them
  const m = v3(p[0], p[1], p[2] + 0.16 * p[0] * p[0]);
  d = smin(d, sdEllipsoid(m, v3(0, 5.1, 9.65), v3(1.85, 0.6, 0.72)), 0.85);
  d = smin(d, sdEllipsoid(m, v3(0, 3.6, 9.32), v3(1.6, 0.62, 0.68)), 0.85);
  d = smax(d, -sdEllipsoid(m, v3(0, 4.38, 10.1), v3(1.9, 0.07, 0.55)), 0.2);
  d = smax(d, -sdEllipsoid(p, v3(0, 2.5, 9.6), v3(1.4, 0.3, 0.45)), 0.5);

  // a strong chin, and the jaw running back to a high angle
  d = smin(d, sdEllipsoid(p, v3(0, 1.3, 8.0), v3(2.3, 1.5, 1.3)), 1.2);
  const GONION = v3(5.0, 3.4, -0.1);
  d = smin(d, sdCapsule(s, v3(1.7, 0.6, 7.4), GONION, 0.55), 2.0);
  d = smin(d, sdCapsule(s, GONION, v3(5.3, 8.6, -0.5), 0.6), 1.9);
  return d;
}

/** Distance (cm) to the nearest seam's centre line. */
function seamDistance(p, s) {
  let d = Infinity;
  // over the crown, from one module to the other
  if (p[1] > 15.6) d = Math.abs(0.683 * (p[2] - 5.17) - 0.73 * (p[1] - 21.14));
  // round the back of the skull
  if (p[2] < -9.4) d = Math.min(d, Math.abs(p[1] - 13.2));
  // down the side of the face, where the face plate meets the jaw
  if (s[0] > 2.5) d = Math.min(d, polylineDistance(p[2], p[1], JAW_SEAM));
  return d;
}

/** Distance (cm) to the nearest ink line, past its half-width. */
function inkDistance(p, s) {
  let d = Infinity;
  for (const { width, from, line } of INK) {
    if (s[0] > from) d = Math.min(d, polylineDistance(p[2], p[1], line) - width);
  }
  return d;
}

/** The skin with its seams cut in. */
function shell(p, s) {
  const bare = skin(p, s);
  const seam = seamDistance(p, s);
  return { bare, d: Math.max(bare, Math.min(SEAM_WIDTH - seam, bare + SEAM_DEPTH)), seam };
}

/**
 * The ear module, built in layers over the skin (`u` = height above it):
 * a raised housing, a recessed ring, the disc with a raised ring on it, a
 * socket in the middle and a bolt on the rim. Returns the distance and the
 * part nearest to the point.
 */
function earModule(p, s, u) {
  const r = Math.hypot(p[1] - MODULE.y, p[2] - MODULE.z);
  if (r > MODULE.r + 1) return { d: r - MODULE.r, part: 'housing' };
  // only on the sides of the skull, not over the crown
  const side = 0.4226 * r - 0.9063 * s[0];

  let d = smax(r - MODULE.r, u - 0.75, 0.3);
  d = Math.max(d, Math.min(3.9 - r, u - 0.2)); // the recess round the disc
  const disc = Math.max(r - 3.75, u - 0.55);
  const ring = Math.max(Math.abs(r - 2.75) - 0.2, u - 0.68);
  d = Math.min(d, disc, ring);
  d = Math.max(d, Math.min(1.45 - r, u - 0.15)); // the socket
  const bolt = smax(Math.hypot(p[1] - BOLT.y, p[2] - BOLT.z) - BOLT.r, u - 1.05, 0.2);
  d = Math.max(Math.min(d, bolt), side);

  let part = 'housing';
  if (bolt <= d + 1e-3) part = 'bolt';
  else if (r < 1.45) part = 'socket';
  else if (ring <= d + 1e-3) part = 'ring';
  else if (r < 3.75) part = 'disc';
  else if (r < 3.9) part = 'socket';
  return { d, part };
}

/** The mechanical neck: a dark column, the spine, a joint and tubes. */
function neck(p, s) {
  if (p[1] > 10.5) return { d: p[1] - 9.5, part: 'column' }; // all of it is below 9.5
  // the column, an elliptic cylinder that runs up under the skull
  const qx = s[0] / 3.1;
  const qz = (p[2] + 3.5) / 3.6;
  const k0 = Math.hypot(qx, qz);
  const k1 = Math.hypot(qx / 3.1, qz / 3.6);
  const column = Math.max(k1 ? (k0 * (k0 - 1)) / k1 : -3, p[1] - 9.5);
  // vertebrae down the back
  const k = clamp(Math.round((7.4 - p[1]) / 1.6), 0, 14);
  const spine = sdRoundBox(s, v3(0, 7.4 - 1.6 * k, -7.9), v3(1.4, 0.32, 0.95), 0.3);
  // a joint on each side, under the module
  const rj = Math.hypot(p[1] - 5.9, p[2] + 4.6);
  const joint = Math.min(
    smax(rj - 1.35, Math.abs(s[0] - 3.1) - 0.45, 0.25),
    smax(rj - 0.7, Math.abs(s[0] - 3.5) - 0.3, 0.15),
  );
  // tubes: a thick one from the joint, two thin ones under the jaw
  const tube = Math.min(
    sdCapsule(s, v3(2.9, 5.9, -4.6), v3(2.9, -16, 1.9), 0.8),
    sdCapsule(s, v3(2.0, 3.6, -0.6), v3(2.0, -16, 1.8), 0.42),
    sdCapsule(s, v3(0.9, 2.6, 0.4), v3(0.9, -16, 2.4), 0.38),
  );
  const d = Math.min(column, spine, joint, tube);
  const part =
    spine <= d + 1e-3 ? 'spine' : joint <= d + 1e-3 || tube <= d + 1e-3 ? 'tube' : 'column';
  return { d, part };
}

function toCm(p) {
  return v3(p[0] * CM + ORIGIN[0], p[1] * CM + ORIGIN[1], p[2] * CM + ORIGIN[2]);
}

// Distance in local units (the renderer's space).
export function headSDF(pLocal) {
  const p = toCm(pLocal);
  const s = v3(Math.abs(p[0]), p[1], p[2]);
  const skinPart = shell(p, s);
  return (
    Math.min(skinPart.d, earModule(p, s, skinPart.bare).d, neck(p, s).d, eyes(s)) / CM
  );
}

/** The material of the surface nearest to a head-local point. */
export function surfaceAt(pLocal) {
  const p = toCm(pLocal);
  const s = v3(Math.abs(p[0]), p[1], p[2]);
  const skinPart = shell(p, s);
  const ear = earModule(p, s, skinPart.bare);
  const neckPart = neck(p, s);
  const nearest = Math.min(skinPart.d, ear.d, neckPart.d);
  if (ear.d === nearest) return MATERIALS[ear.part];
  if (neckPart.d === nearest) return MATERIALS[neckPart.part];
  const lined = skinPart.seam < SEAM_WIDTH * 1.8 || inkDistance(p, s) < 0;
  return lined ? MATERIALS.seam : MATERIALS.skin;
}

/** True where a head-local point is on the visible (glowing) part of an eye. */
export function isEyeAt(pLocal) {
  return eyeDistance(pLocal) < 0.004 && insideEyeOpening(pLocal);
}

function eyeDistance(pLocal) {
  const p = toCm(pLocal);
  return eyes(v3(Math.abs(p[0]), p[1], p[2])) / CM;
}

// Eyelids: a narrow almond-shaped window of each eyeball glows white.
function insideEyeOpening(pLocal) {
  const p = toCm(pLocal);
  const x = (Math.abs(p[0]) - EYE[0]) / 1.8;
  const y = (p[1] - EYE[1] + 0.05) / 0.8;
  return Math.abs(x) < 1 && y * y < (1 - x * x) * (1 - x * x);
}

export function normalAt(f, p) {
  const e = 0.002;
  // tetrahedron technique: 4 evaluations instead of 6
  const k = [
    [1, -1, -1], [-1, -1, 1], [-1, 1, -1], [1, 1, 1],
  ];
  let n = [0, 0, 0];
  for (const q of k) n = add(n, mul(q, f(add(p, mul(q, e)))));
  return norm(n);
}

// Cheap ambient occlusion: how much the surface is "closed in" along its normal.
function occlusion(f, p, n) {
  let occ = 0;
  let w = 1;
  for (let i = 1; i <= 5; i++) {
    const h = 0.03 * i;
    occ += (h - f(add(p, mul(n, h)))) * w;
    w *= 0.75;
  }
  return clamp(1 - 2.2 * occ);
}

// Soft shadow: march towards the light and remember the closest miss.
function softShadow(f, p, l, k = 10) {
  let res = 1;
  let t = 0.02;
  for (let i = 0; i < 48 && t < 3; i++) {
    const h = f(add(p, mul(l, t)));
    if (h < 0.0005) return 0;
    res = Math.min(res, (k * h) / t);
    t += clamp(h, 0.01, 0.2);
  }
  return clamp(res);
}

/**
 * Light at a surface point `pw` (world space) with normal `n`, seen along
 * `rd`: key light with soft shadows, a cool fill, ambient occlusion and a
 * grazing rim that outlines the profile, scaled by the material. Shared by
 * the ASCII renderer below and the point-cloud renderer in dots.mjs.
 */
export function shadeSurface(scene, pw, n, rd, L, { albedo, gloss } = MATERIALS.skin) {
  if (!albedo) return 0;
  const shadow = 0.25 + 0.75 * softShadow(scene, add(pw, mul(n, 0.004)), L);
  const diffuse = clamp(dot(n, L)) * shadow;
  const fill = clamp(dot(n, norm(v3(-0.8, 0.1, 0.4)))) * 0.16;
  // grazing-angle glow, stronger on the side the face points to so the
  // profile (brow, nose, lips, chin) gets a bright outline
  const grazing = Math.pow(clamp(1 - Math.abs(dot(n, rd))), 2.5);
  const rim = grazing * (0.18 + 0.45 * clamp(n[0])) * (0.5 + 0.5 * albedo);
  // specular sheen: the planes facing the light burn out to white, and the
  // metal catches sharper highlights than the skin
  const half = norm(sub(L, rd));
  const spec = Math.pow(clamp(dot(n, half)), 40) * gloss * shadow;
  const ao = occlusion(scene, pw, n);
  return clamp(
    (0.03 + Math.pow(diffuse, 1.3) * 0.97 + fill) * albedo * (0.3 + 0.7 * ao) + rim + spec,
  );
}

/**
 * Ray march the head into a W×H buffer.
 * Returns luminance (0..1), coverage mask, material id and head-local coords
 * so later passes can decide what dissolves into pixels.
 */
export function renderHead({
  width,
  height,
  aspect = 1, // pixel width / pixel height
  yaw = 0.66,
  pitch = -0.16,
  roll = 0.05,
  distance = 7.2,
  fov = 0.42,
  center = v3(0.05, -0.28, 0),
  light = norm(v3(0.55, 0.45, 0.85)),
} = {}) {
  // object rotation: head turned to the viewer's right, chin up a little
  const R = matMul(rotY(yaw), matMul(rotX(pitch), rotZ(roll)));
  const Rt = transpose(R);
  const L = norm(light);

  const lum = new Float32Array(width * height);
  const mask = new Uint8Array(width * height);
  const material = new Uint8Array(width * height);
  const local = new Float32Array(width * height * 3);

  const ro = v3(0, 0, distance);
  const tanF = Math.tan(fov / 2);

  // scene in world space = head in local space, rotated
  const sceneLocal = (pw) => mat(Rt, sub(pw, center));
  const scene = (pw) => headSDF(sceneLocal(pw));

  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      const u = ((i + 0.5) / width) * 2 - 1;
      const v = 1 - ((j + 0.5) / height) * 2;
      const rd = norm(v3((u * tanF * (width * aspect)) / height, v * tanF, -1));

      let t = distance - 4;
      let hit = false;
      for (let s = 0; s < 220 && t < distance + 4; s++) {
        const d = scene(add(ro, mul(rd, t)));
        if (d < 0.0008) { hit = true; break; }
        t += d * 0.8;
      }
      if (!hit) continue;

      const idx = j * width + i;
      const pw = add(ro, mul(rd, t));
      const pl = sceneLocal(pw);
      const n = normalAt(scene, pw);
      const isEye = isEyeAt(pl);

      lum[idx] = isEye ? 1 : shadeSurface(scene, pw, n, rd, L, surfaceAt(pl));
      mask[idx] = 1;
      material[idx] = isEye ? 2 : 1;
      local.set(pl, idx * 3);
    }
  }
  return { width, height, lum, mask, material, local };
}
