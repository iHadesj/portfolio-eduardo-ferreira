// A human head sculpted from signed distance functions and ray marched
// into a luminance buffer. No meshes, no photos: just math.
//
// Adapted from the profile README's sculpt (github.com/iHadesj/iHadesJ,
// src/art/head.mjs): the androgynous mannequin became an idealised, almost
// too-perfect male head — a statue's proportions, slightly uncanny on
// purpose. Heavy brow over deep-set eyes, a straight Greek nose, high
// cheekbones over lean cheeks, an angular jaw and a square chin, full lips
// and a strong neck.
//
// The sculpt is written in centimetres: y = 0 at the chin, z = 0 at the ear
// canal, x = 0 on the midline, the face looking down +z. Classic canon:
// eyes at half height, the face split in thirds (hairline / brows / nose
// base / chin), eye spacing = one eye.

import {
  v3, add, sub, mul, dot, norm, clamp, smoothstep,
  rotX, rotY, rotZ, mat, matMul, transpose,
  sdSphere, sdEllipsoid, sdCapsule, sdRoundCone, smin, smax,
} from './sdf.mjs';

const CM = 7.5; // one local unit (half the skull width) in centimetres
const ORIGIN = v3(0, 11.5, 0); // eye line, ear-canal depth

const EYE = v3(3.15, 11.45, 7.3); // right/left pupils mirror on x
const EYE_RADIUS = 1.3;

function eyes(s) {
  return sdSphere(s, EYE, EYE_RADIUS);
}

// The face volume: an ellipsoid whose width tapers from the cheekbones down
// to the chin. Less taper than the mannequin: a wide, square lower face.
function faceMass(p) {
  const taper = 0.76 + 0.24 * smoothstep(-0.5, 11, p[1]);
  const q = v3(p[0] / taper, p[1], p[2]);
  return sdEllipsoid(q, v3(0, 7.8, 3.5), v3(6.0, 7.5, 6.5)) * taper;
}

// s = point with |x| (the sculpt is symmetric), p = raw point (centimetres)
function skin(p, s) {
  // cranium, forehead and the face volume
  let d = sdEllipsoid(p, v3(0, 14.6, -0.9), v3(7.2, 8.5, 9.5));
  d = smin(d, sdEllipsoid(p, v3(0, 16.5, 3.7), v3(5.8, 5.4, 5.6)), 2.5);
  d = smin(d, faceMass(p), 3.0);

  // high, sharp cheekbones; the cheek under them stays lean
  d = smin(d, sdEllipsoid(s, v3(4.3, 10.0, 6.4), v3(1.7, 0.9, 1.6)), 1.7);
  d = smin(d, sdEllipsoid(s, v3(3.3, 8.2, 6.4), v3(1.5, 1.4, 1.4)), 2.4);

  // heavy brow ridge shading the eyes
  d = smin(d, sdCapsule(s, v3(0, 13.35, 9.15), v3(4.1, 13.5, 7.35), 0.72), 1.5);

  // square, forward chin with a soft cleft
  d = smin(d, sdEllipsoid(p, v3(0, 2.0, 8.55), v3(2.3, 1.65, 1.4)), 1.2);
  d = smax(d, -sdEllipsoid(p, v3(0, 1.8, 10.0), v3(0.2, 0.7, 0.3)), 0.3);

  // angular jaw: a crisp line from the chin to a defined angle, then up
  const GONION = v3(5.0, 2.6, 0.9);
  d = smin(d, sdCapsule(s, v3(1.7, 1.2, 7.7), GONION, 0.55), 2.0);
  d = smin(d, sdCapsule(s, GONION, v3(5.25, 7.6, 0.2), 0.6), 1.9);

  // eye sockets, deep under the brow – the eyeballs sit inside
  d = smax(d, -sdEllipsoid(s, v3(3.2, 11.5, 9.05), v3(1.8, 1.1, 1.4)), 1.0);

  // nose: a straight dorsum off the brow (Greek profile), a projecting tip,
  // narrow wings and nostrils
  d = smin(d, sdRoundCone(p, v3(0, 12.3, 9.5), v3(0, 8.85, 11.7), 0.5, 0.66), 0.7);
  d = smin(d, sdSphere(p, v3(0, 8.6, 11.55), 0.74), 0.45);
  d = smin(d, sdSphere(s, v3(1.05, 8.05, 10.05), 0.62), 0.65);
  d = smax(d, -sdSphere(s, v3(0.6, 7.65, 10.5), 0.25), 0.3);

  // full lips wrapped round the dental arch, a crisp mouth line, and the
  // fold that sets the lower lip off from the chin
  const m = v3(p[0], p[1], p[2] + 0.16 * p[0] * p[0]);
  d = smin(d, sdEllipsoid(m, v3(0, 5.8, 9.9), v3(1.9, 0.52, 0.78)), 0.85);
  d = smin(d, sdEllipsoid(m, v3(0, 4.62, 9.8), v3(1.65, 0.62, 0.82)), 0.85);
  d = smax(d, -sdEllipsoid(m, v3(0, 5.2, 10.55), v3(1.95, 0.07, 0.55)), 0.2);
  d = smax(d, -sdEllipsoid(p, v3(0, 3.45, 9.9), v3(1.5, 0.34, 0.5)), 0.55);

  // ears: helix rim, a hollow concha and the lobe
  d = smin(d, sdEllipsoid(s, v3(6.75, 10.6, -0.8), v3(0.55, 2.8, 1.55)), 0.5);
  d = smax(d, -sdEllipsoid(s, v3(7.15, 10.35, -0.6), v3(0.3, 1.15, 0.65)), 0.45);

  // a strong neck with the two big neck muscles and the Adam's apple
  d = smin(d, sdCapsule(p, v3(0, 7.6, -2.4), v3(0, -12, -1.0), 5.5), 2.6);
  d = smin(d, sdCapsule(s, v3(4.8, 8.4, -2.0), v3(1.4, -10, 3.6), 0.9), 1.5);
  d = smin(d, sdEllipsoid(p, v3(0, -3.2, 4.15), v3(0.75, 1.15, 0.7)), 1.0);
  return d;
}

function toCm(p) {
  return v3(p[0] * CM + ORIGIN[0], p[1] * CM + ORIGIN[1], p[2] * CM + ORIGIN[2]);
}

// Distance in local units (the renderer's space).
export function headSDF(pLocal) {
  const p = toCm(pLocal);
  const s = v3(Math.abs(p[0]), p[1], p[2]);
  return Math.min(skin(p, s), eyes(s)) / CM;
}

/** True where a head-local point is on the visible (glowing) part of an eye. */
export function isEyeAt(pLocal) {
  return eyeDistance(pLocal) < 0.004 && insideEyeOpening(pLocal);
}

function eyeDistance(pLocal) {
  const p = toCm(pLocal);
  return eyes(v3(Math.abs(p[0]), p[1], p[2])) / CM;
}

// Eyelids: a wide almond-shaped window of each eyeball glows white.
function insideEyeOpening(pLocal) {
  const p = toCm(pLocal);
  const x = (Math.abs(p[0]) - EYE[0]) / 1.85;
  const y = (p[1] - EYE[1] + 0.05) / 0.78;
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
 * grazing rim that outlines the profile. Shared by the ASCII renderer below
 * and the point-cloud renderer in dots.mjs.
 */
export function shadeSkin(scene, pw, n, rd, L) {
  const shadow = 0.25 + 0.75 * softShadow(scene, add(pw, mul(n, 0.004)), L);
  const diffuse = clamp(dot(n, L)) * shadow;
  const fill = clamp(dot(n, norm(v3(-0.8, 0.1, 0.4)))) * 0.16;
  // grazing-angle glow, stronger on the side the face points to so the
  // profile (brow, nose, lips, chin) gets a bright outline
  const grazing = Math.pow(clamp(1 - Math.abs(dot(n, rd))), 2.5);
  const rim = grazing * (0.18 + 0.45 * clamp(n[0]));
  // a broad specular sheen: the planes facing the light (brow, bridge of the
  // nose, cheekbone, lips, chin) burn out to white, like a flash portrait
  const half = norm(sub(L, rd));
  const spec = Math.pow(clamp(dot(n, half)), 40) * 0.45 * shadow;
  const ao = occlusion(scene, pw, n);
  return clamp((0.03 + Math.pow(diffuse, 1.3) * 0.97 + fill) * (0.3 + 0.7 * ao) + rim + spec);
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

      lum[idx] = isEye ? 1 : shadeSkin(scene, pw, n, rd, L);
      mask[idx] = 1;
      material[idx] = isEye ? 2 : 1;
      local.set(pl, idx * 3);
    }
  }
  return { width, height, lum, mask, material, local };
}
