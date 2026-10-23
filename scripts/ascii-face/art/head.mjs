// A human head sculpted from signed distance functions and ray marched
// into a luminance buffer. No meshes, no photos: just math.
//
// The sculpt is written in centimetres using average adult landmarks
// (androgynous, mannequin-like): y = 0 at the chin, z = 0 at the ear canal,
// x = 0 on the midline. Classic canon: eyes at half height, the face split
// in thirds (hairline / brows / nose base / chin), eye spacing = one eye.

import {
  v3, add, sub, mul, dot, norm, clamp, smoothstep,
  rotX, rotY, rotZ, mat, matMul, transpose,
  sdSphere, sdEllipsoid, sdCapsule, sdRoundCone, smin, smax,
} from './sdf.mjs';

const CM = 7.5; // one local unit (half the skull width) in centimetres
const ORIGIN = v3(0, 11.5, 0); // eye line, ear-canal depth

const EYE = v3(3.15, 11.5, 7.5); // right/left pupils mirror on x
const EYE_RADIUS = 1.25;

function eyes(s) {
  return sdSphere(s, EYE, EYE_RADIUS);
}

// The face volume: an ellipsoid whose width tapers from the cheekbones down
// to the chin, which gives the classic inverted-egg front silhouette.
function faceMass(p) {
  const taper = 0.64 + 0.36 * smoothstep(-0.5, 11, p[1]);
  const q = v3(p[0] / taper, p[1], p[2]);
  return sdEllipsoid(q, v3(0, 7.8, 3.5), v3(6.0, 7.5, 6.6)) * taper;
}

// s = point with |x| (the sculpt is symmetric), p = raw point (centimetres)
function skin(p, s) {
  // cranium, forehead and the face volume
  let d = sdEllipsoid(p, v3(0, 14.6, -0.8), v3(7.2, 8.4, 9.3));
  d = smin(d, sdEllipsoid(p, v3(0, 16.6, 3.6), v3(5.8, 5.4, 5.6)), 2.5);
  d = smin(d, faceMass(p), 3.2);

  // gentle structure: cheekbones, brow, chin, jaw angle
  d = smin(d, sdEllipsoid(s, v3(4.2, 9.6, 6.5), v3(1.6, 1.0, 1.6)), 2.4);
  d = smin(d, sdEllipsoid(s, v3(3.4, 8.0, 6.4), v3(2.0, 2.0, 1.8)), 2.6); // cheeks
  d = smin(d, sdCapsule(s, v3(0, 13.4, 9.0), v3(4.0, 13.5, 7.2), 0.45), 2.0);
  d = smin(d, sdEllipsoid(p, v3(0, 2.4, 8.4), v3(1.9, 1.6, 1.3)), 1.5);
  d = smin(d, sdCapsule(s, v3(1.8, 1.7, 7.4), v3(4.6, 4.6, 1.0), 0.5), 2.6);

  // eye sockets (shallow) – the eyeballs sit inside
  d = smax(d, -sdEllipsoid(s, v3(3.15, 11.45, 9.2), v3(1.75, 1.1, 1.35)), 1.1);

  // nose: dorsum, tip, wings, nostrils
  d = smin(d, sdRoundCone(p, v3(0, 12.2, 9.35), v3(0, 8.95, 11.35), 0.55, 0.7), 0.8);
  d = smin(d, sdSphere(p, v3(0, 8.7, 11.25), 0.78), 0.5);
  d = smin(d, sdSphere(s, v3(1.05, 8.05, 10.0), 0.65), 0.7);
  d = smax(d, -sdSphere(s, v3(0.62, 7.6, 10.45), 0.26), 0.3);

  // lips wrap around the dental arch: bend them back towards the corners
  const m = v3(p[0], p[1], p[2] + 0.16 * p[0] * p[0]);
  d = smin(d, sdEllipsoid(m, v3(0, 5.75, 9.85), v3(1.85, 0.46, 0.7)), 0.9);
  d = smin(d, sdEllipsoid(m, v3(0, 4.6, 9.75), v3(1.6, 0.54, 0.75)), 0.9);
  d = smax(d, -sdEllipsoid(m, v3(0, 5.17, 10.5), v3(1.95, 0.08, 0.55)), 0.2);
  d = smax(d, -sdEllipsoid(p, v3(0, 3.4, 9.85), v3(1.5, 0.36, 0.5)), 0.6);

  // ears
  d = smin(d, sdEllipsoid(s, v3(6.75, 10.6, -0.8), v3(0.5, 2.7, 1.5)), 0.5);

  // neck, leaning forward a little, with the two big neck muscles
  d = smin(d, sdCapsule(p, v3(0, 8.0, -2.4), v3(0, -12, -1.2), 5.2), 3.2);
  d = smin(d, sdCapsule(s, v3(4.8, 8.4, -2.0), v3(1.4, -10, 3.4), 0.8), 1.6);
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

function eyeDistance(pLocal) {
  const p = toCm(pLocal);
  return eyes(v3(Math.abs(p[0]), p[1], p[2])) / CM;
}

// Eyelids: only an almond-shaped window of each eyeball glows.
function insideEyeOpening(pLocal) {
  const p = toCm(pLocal);
  const x = (Math.abs(p[0]) - EYE[0]) / 1.6;
  const y = (p[1] - EYE[1] + 0.05) / 0.75;
  return Math.abs(x) < 1 && y * y < (1 - x * x) * (1 - x * x);
}

function normalAt(f, p) {
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
      for (let s = 0; s < 180 && t < distance + 4; s++) {
        const d = scene(add(ro, mul(rd, t)));
        if (d < 0.0008) { hit = true; break; }
        t += d * 0.85;
      }
      if (!hit) continue;

      const idx = j * width + i;
      const pw = add(ro, mul(rd, t));
      const pl = sceneLocal(pw);
      const n = normalAt(scene, pw);
      const isEye = eyeDistance(pl) < 0.004 && insideEyeOpening(pl);

      const diffuse = clamp(dot(n, L)) * (0.25 + 0.75 * softShadow(scene, add(pw, mul(n, 0.004)), L));
      const fill = clamp(dot(n, norm(v3(-0.8, 0.1, 0.4)))) * 0.16;
      // grazing-angle glow, stronger on the side the face points to so the
      // profile (brow, nose, lips, chin) gets a bright outline
      const grazing = Math.pow(clamp(1 - Math.abs(dot(n, rd))), 2.5);
      const rim = grazing * (0.18 + 0.45 * clamp(n[0]));
      const ao = occlusion(scene, pw, n);
      const l = isEye ? 1 : (0.03 + Math.pow(diffuse, 1.3) * 0.97 + fill) * (0.3 + 0.7 * ao) + rim;

      lum[idx] = clamp(l);
      mask[idx] = 1;
      material[idx] = isEye ? 2 : 1;
      local.set(pl, idx * 3);
    }
  }
  return { width, height, lum, mask, material, local };
}
