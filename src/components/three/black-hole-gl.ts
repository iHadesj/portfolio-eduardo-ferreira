import {
  BEAMING,
  DISK_INNER,
  DISK_OUTER,
  EDGE_FADE_X,
  EDGE_FADE_Y,
  ESCAPE_RADIUS,
  EXPOSURE,
  FALLOFF,
  FLOW_PERIOD,
  GLYPHS,
  HEAT_SCALE,
  HEAT_STOPS,
  LATTICE,
  MAX_STEPS,
  PULSE_GAIN,
  PULSE_SPEED,
  RADIAL,
  SPIN,
  STAR_DENSITY,
  STAR_GRID,
  STAR_HEAT,
  STEP,
  STEP_MAX,
  STEP_MIN,
  SUB,
  TANGENTIAL,
  TAN_HALF_FOV,
  TONE_GAMMA,
  TONE_LUT,
  cameraFrame,
  imageAspect,
  type HoleLayout,
  type HoleView,
} from "./black-hole";
import { DUST_GLYPHS } from "./black-hole-dust";
import {
  FULLSCREEN_VS,
  allocateTexture,
  compileAsync,
  uploadGlyphAtlas,
  type Rgba,
} from "./gl-utils";

/**
 * The black hole, live, in raw WebGL2. Two passes per frame:
 *
 * 1. Rays: one fragment per ray (`cols·2 × rows·2`) traces light back from
 *    the camera exactly like `traceRay` in black-hole.ts and stores its
 *    light and its heat × light.
 * 2. Glyphs: a full-screen pass reads each cell's mean light and heat — a
 *    single bilinear fetch at the centre of its 2×2 rays — picks the glyph
 *    from the same tone table as the poster, inks it by heat on the
 *    blackbody ramp, and adds a soft halo from the blurred light around it.
 *    Nothing bends the picture: under a hold the rays themselves feel a
 *    heavier hole (`uMass`). Dust (black-hole-dust.ts) fills the empty
 *    cells.
 *
 * The main-thread cost of a frame is a few uniforms, one small texture
 * upload (the dust) and two draw calls.
 */

const f = (n: number) => (Number.isInteger(n) ? `${n}.0` : `${n}`);

/* Mirrors black-hole.ts: hash3, noise3, fbm, diskAt, starAt, traceRay. */
const RAY_FS = `#version 300 es
precision highp float;
precision highp int;
uniform vec3 uEye;
uniform vec3 uRight;
uniform vec3 uUp;
uniform vec3 uForward;
uniform vec2 uTan;
uniform vec2 uSize;
uniform float uDiskTime;
uniform float uTime;
uniform float uPulse;
uniform float uGain;
uniform float uMass;
uniform float uStars;
out vec4 outColor;

uint hash3(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z;
  v.y += v.z * v.x;
  v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z;
  v.y += v.z * v.x;
  v.z += v.x * v.y;
  return v.x ^ v.y ^ v.z;
}

float unit3(ivec3 p) {
  return float(hash3(uvec3(p + ${LATTICE})) >> 8u) / 16777216.0;
}

float noise3(vec3 p) {
  ivec3 i = ivec3(floor(p));
  vec3 t = p - floor(p);
  vec3 u = t * t * (3.0 - 2.0 * t);
  return mix(
    mix(
      mix(unit3(i), unit3(i + ivec3(1, 0, 0)), u.x),
      mix(unit3(i + ivec3(0, 1, 0)), unit3(i + ivec3(1, 1, 0)), u.x),
      u.y),
    mix(
      mix(unit3(i + ivec3(0, 0, 1)), unit3(i + ivec3(1, 0, 1)), u.x),
      mix(unit3(i + ivec3(0, 1, 1)), unit3(i + ivec3(1, 1, 1)), u.x),
      u.y),
    u.z);
}

float fbm(vec3 p) {
  return 0.5 * noise3(p)
    + 0.3 * noise3(p * 2.07 + 17.1)
    + 0.2 * noise3(p * 4.13 + 41.7);
}

vec3 diskAt(vec2 xz, vec3 v) {
  float r = length(xz);
  float inner = ${f(DISK_INNER)} * uMass;
  if (r < inner || r > ${f(DISK_OUTER)}) return vec3(0.0);
  float phi = atan(xz.y, xz.x);
  float omega = ${f(SPIN)} * sqrt(uMass) / (r * sqrt(r));
  float flow = uDiskTime / ${f(FLOW_PERIOD)};
  float grain = 0.0;
  for (int k = 0; k < 2; k++) {
    float phase = fract(flow + 0.5 * float(k));
    float weight = 1.0 - abs(2.0 * phase - 1.0);
    float a = phi - omega * phase * ${f(FLOW_PERIOD)};
    grain += weight * fbm(vec3(cos(a) * ${f(TANGENTIAL)} + 9.7 * float(k), sin(a) * ${f(TANGENTIAL)}, r * ${f(RADIAL)}));
  }
  float falloff = pow(inner / r, ${f(FALLOFF)});
  float edges = smoothstep(inner, inner + 0.8, r)
    * (1.0 - smoothstep(${f(DISK_OUTER * 0.6)}, ${f(DISK_OUTER)}, r));
  float speed = sqrt(0.5 * uMass / r);
  float toward = (sin(phi) * v.x - cos(phi) * v.z) / max(length(v), 1e-6);
  float gamma = 1.0 / sqrt(1.0 - speed * speed);
  float g = 1.0 / (gamma * (1.0 - speed * toward));
  float redshift = sqrt(1.0 - uMass / r);
  float ring = (r - (inner + ${f(PULSE_SPEED)} * uPulse)) / 1.4;
  float flash = ${f(PULSE_GAIN)} * exp(-ring * ring) * exp(-uPulse * 0.5);
  float light = (falloff * (0.18 + 1.25 * smoothstep(0.28, 0.75, grain)) + flash)
    * edges * pow(g, ${f(BEAMING)}) * redshift;
  float heat = pow(inner / r, 0.75) * g * redshift;
  return vec3(light, edges * (0.55 + 0.4 * grain), heat);
}

float starAt(vec3 d) {
  vec3 n = d / max(length(d), 1e-6);
  ivec3 i = ivec3(floor(n * ${f(STAR_GRID)}));
  if (unit3(i) >= ${f(STAR_DENSITY)}) return 0.0;
  float shade = unit3(ivec3(i.z, i.x, i.y + 77));
  return (0.35 + 0.65 * shade)
    * (0.7 + 0.3 * sin(uTime * (1.0 + 2.0 * shade) + 6.283 * shade));
}

void main() {
  vec2 uv = gl_FragCoord.xy / uSize * 2.0 - 1.0;
  vec3 dir = normalize(uForward + uRight * uv.x * uTan.x + uUp * uv.y * uTan.y);
  vec3 p = uEye;
  vec3 v = dir;
  vec3 c = cross(p, v);
  float h2 = dot(c, c);
  float light = 0.0;
  float heat = 0.0;
  float alpha = 0.0;
  for (int i = 0; i < ${MAX_STEPS}; i++) {
    float r2 = dot(p, p);
    float r = sqrt(r2);
    if (r < uMass) break;
    if (r > ${f(ESCAPE_RADIUS)} && dot(p, v) > 0.0) {
      float star = (1.0 - alpha) * uStars * starAt(v);
      light += star;
      heat += star * ${f(STAR_HEAT)};
      break;
    }
    float dt = clamp(${f(STEP)} * r, ${f(STEP_MIN)}, ${f(STEP_MAX)});
    v += (-1.5 * uMass * h2 / (r2 * r2 * r)) * p * dt;
    vec3 q = p;
    p += v * dt;
    if (q.y * p.y < 0.0) {
      float t = q.y / (q.y - p.y);
      vec3 disk = diskAt(mix(q.xz, p.xz, t), v);
      light += (1.0 - alpha) * disk.x;
      heat += (1.0 - alpha) * disk.x * disk.z;
      alpha += (1.0 - alpha) * disk.y;
      if (alpha > 0.98) break;
    }
  }
  float seen = 1.0 - exp(-${f(EXPOSURE)} * uGain * light);
  float warmth = light > 0.0 ? heat / light : 0.0;
  outColor = vec4(seen, min(warmth / ${f(HEAT_SCALE)}, 1.0) * seen, 0.0, 1.0);
}`;

const GLYPH_COUNT = GLYPHS.length;

const DRAW_FS = `#version 300 es
precision highp float;
uniform sampler2D uLights;
uniform sampler2D uAtlas;
uniform sampler2D uDust;
uniform sampler2D uDustAtlas;
uniform vec2 uGrid;
uniform vec2 uResolution;
uniform float uLut[64];
uniform vec4 uInks[${HEAT_STOPS.length}];
uniform float uHalo;
out vec4 outColor;

const float STOPS[${HEAT_STOPS.length}] = float[](${HEAT_STOPS.map(f).join(", ")});

/* The blackbody ramp: blend between the two stops either side of heat. */
vec4 inkFor(float heat) {
  if (heat <= STOPS[0]) return uInks[0];
  for (int i = 1; i < ${HEAT_STOPS.length}; i++) {
    if (heat < STOPS[i]) {
      return mix(uInks[i - 1], uInks[i], (heat - STOPS[i - 1]) / (STOPS[i] - STOPS[i - 1]));
    }
  }
  return uInks[${HEAT_STOPS.length - 1}];
}

float heatOf(vec4 s) {
  return s.r > 0.0 ? s.g / s.r * ${f(HEAT_SCALE)} : 0.0;
}

void main() {
  vec2 g = gl_FragCoord.xy / uResolution * uGrid;
  vec2 cell = floor(g);
  vec2 centre = (cell + 0.5) / uGrid;
  vec4 rays = texture(uLights, centre);
  float light = rays.r;
  // Mirrors edgeFade: nothing is ever cut by the edge of the box.
  vec2 side = min(centre, 1.0 - centre);
  float fade = smoothstep(0.0, ${f(EDGE_FADE_X)}, side.x)
    * smoothstep(0.0, ${f(EDGE_FADE_Y)}, side.y);
  float tone = pow(light, ${f(TONE_GAMMA)}) * fade;
  float index = uLut[int(floor(tone * 63.0 + 0.5))];
  vec2 local = fract(g);
  vec4 glyph = vec4(0.0);
  if (index > 0.0) {
    float ink = texture(uAtlas, vec2((index + local.x) / ${f(GLYPH_COUNT)}, local.y)).a;
    vec4 color = inkFor(heatOf(rays));
    glyph = vec4(color.rgb * color.a, color.a) * ink;
  }
  // Dust only where the scene itself is dark, so it never muddies the disk.
  vec4 dust = texelFetch(uDust, ivec2(cell), 0);
  if (dust.r > 0.0 && tone < 0.22) {
    float which = floor(dust.r * 255.0 + 0.5);
    float ink = texture(uDustAtlas, vec2((which + local.x) / ${f(DUST_GLYPHS.length)}, local.y)).a;
    vec4 color = inkFor(dust.b * ${f(HEAT_SCALE)});
    vec4 speck = vec4(color.rgb * color.a, color.a) * ink * dust.g * fade;
    glyph = speck + glyph * (1.0 - speck.a);
  }
  // Halo: the light blurred over a few cells, so the bright parts bloom.
  vec2 at = gl_FragCoord.xy / uResolution;
  vec2 cellSize = 1.0 / uGrid;
  vec4 blur = vec4(0.0);
  for (int k = 0; k < 8; k++) {
    float a = float(k) * 0.785398;
    vec2 p = at + vec2(cos(a), sin(a) * 2.0) * cellSize * 1.6;
    // Nothing shines in from beyond the frame (clamping would smear the edge).
    bool inside = all(greaterThanEqual(p, vec2(0.0))) && all(lessThanEqual(p, vec2(1.0)));
    blur += inside ? texture(uLights, p) : vec4(0.0);
  }
  blur /= 8.0;
  float halo = blur.r * blur.r * blur.r * uHalo * fade;
  vec4 glow = inkFor(heatOf(blur));
  vec4 bloom = vec4(glow.rgb * glow.a, glow.a) * halo;
  outColor = glyph + bloom * (1.0 - glyph.a);
}`;

/** One colour per heat stop, cool → hot (`HEAT_INKS`). */
export type HoleInks = readonly Rgba[];

export interface HoleRendererOptions {
  /** CSS `font-family` of the poster, so the atlas matches it glyph for glyph. */
  fontFamily: string;
  inks: HoleInks;
  /** Strength of the bloom around the bright parts (0 = none). */
  halo: number;
}

/** What sits on top of the scene itself. (The hold's gravity is in the
    view: `mass`.) */
export interface HoleEffects {
  /** One RGBA texel per cell (black-hole-dust.ts), or null for none. */
  dust: Uint8Array | null;
}

export interface HoleRenderer {
  /** Match the canvas to its box; call on resize. */
  resize(layout: HoleLayout, width: number, height: number): void;
  setInks(inks: HoleInks): void;
  render(view: HoleView, effects: HoleEffects): void;
  dispose(): void;
}

/** Resolves to null when WebGL2 or the shaders are unavailable — the poster
    then simply stays. */
export async function createHoleRenderer(
  canvas: HTMLCanvasElement,
  options: HoleRendererOptions,
): Promise<HoleRenderer | null> {
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    antialias: false,
    depth: false,
    premultipliedAlpha: true,
    powerPreference: "low-power",
  });
  if (!gl) return null;

  let rayProgram: WebGLProgram;
  let drawProgram: WebGLProgram;
  try {
    [rayProgram, drawProgram] = await Promise.all([
      compileAsync(gl, FULLSCREEN_VS, RAY_FS),
      compileAsync(gl, FULLSCREEN_VS, DRAW_FS),
    ]);
  } catch {
    return null;
  }
  const emptyVao = gl.createVertexArray();

  const rayU = {
    eye: gl.getUniformLocation(rayProgram, "uEye"),
    right: gl.getUniformLocation(rayProgram, "uRight"),
    up: gl.getUniformLocation(rayProgram, "uUp"),
    forward: gl.getUniformLocation(rayProgram, "uForward"),
    tan: gl.getUniformLocation(rayProgram, "uTan"),
    size: gl.getUniformLocation(rayProgram, "uSize"),
    diskTime: gl.getUniformLocation(rayProgram, "uDiskTime"),
    time: gl.getUniformLocation(rayProgram, "uTime"),
    pulse: gl.getUniformLocation(rayProgram, "uPulse"),
    gain: gl.getUniformLocation(rayProgram, "uGain"),
    mass: gl.getUniformLocation(rayProgram, "uMass"),
    stars: gl.getUniformLocation(rayProgram, "uStars"),
  };
  const drawU = {
    lights: gl.getUniformLocation(drawProgram, "uLights"),
    atlas: gl.getUniformLocation(drawProgram, "uAtlas"),
    grid: gl.getUniformLocation(drawProgram, "uGrid"),
    resolution: gl.getUniformLocation(drawProgram, "uResolution"),
    inks: gl.getUniformLocation(drawProgram, "uInks"),
    halo: gl.getUniformLocation(drawProgram, "uHalo"),
    dust: gl.getUniformLocation(drawProgram, "uDust"),
    dustAtlas: gl.getUniformLocation(drawProgram, "uDustAtlas"),
  };

  // The tone table never changes: upload it once.
  gl.useProgram(drawProgram);
  gl.uniform1fv(
    gl.getUniformLocation(drawProgram, "uLut"),
    new Float32Array(TONE_LUT),
  );

  const lightTexture = gl.createTexture();
  const lightTarget = gl.createFramebuffer();
  const atlasTexture = gl.createTexture();
  const dustTexture = gl.createTexture();
  const dustAtlasTexture = gl.createTexture();

  let layout: HoleLayout = { cols: 0, rows: 0 };
  let inks = options.inks;

  const buildTarget = () => {
    // Linear, so one fetch at a cell's centre averages its 2×2 rays.
    allocateTexture(
      gl,
      lightTexture,
      layout.cols * SUB,
      layout.rows * SUB,
      gl.LINEAR,
    );
    gl.bindFramebuffer(gl.FRAMEBUFFER, lightTarget);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      lightTexture,
      0,
    );
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    allocateTexture(gl, dustTexture, layout.cols, layout.rows);
  };

  return {
    resize(nextLayout, width, height) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      const changed =
        nextLayout.cols !== layout.cols || nextLayout.rows !== layout.rows;
      layout = nextLayout;
      if (changed) buildTarget();
      uploadGlyphAtlas(
        gl,
        atlasTexture,
        GLYPHS,
        options.fontFamily,
        canvas.width / layout.cols,
        canvas.height / layout.rows,
      );
      uploadGlyphAtlas(
        gl,
        dustAtlasTexture,
        DUST_GLYPHS,
        options.fontFamily,
        canvas.width / layout.cols,
        canvas.height / layout.rows,
      );
    },

    setInks(next) {
      inks = next;
    },

    render(view, effects) {
      const { eye, right, up, forward } = cameraFrame(view);
      const w = layout.cols * SUB;
      const h = layout.rows * SUB;

      // 1 — rays
      gl.bindFramebuffer(gl.FRAMEBUFFER, lightTarget);
      gl.viewport(0, 0, w, h);
      gl.useProgram(rayProgram);
      gl.uniform3fv(rayU.eye, eye);
      gl.uniform3fv(rayU.right, right);
      gl.uniform3fv(rayU.up, up);
      gl.uniform3fv(rayU.forward, forward);
      gl.uniform2f(rayU.tan, TAN_HALF_FOV, TAN_HALF_FOV / imageAspect(layout));
      gl.uniform2f(rayU.size, w, h);
      gl.uniform1f(rayU.diskTime, view.diskTime);
      gl.uniform1f(rayU.time, view.time);
      gl.uniform1f(rayU.pulse, view.pulse);
      gl.uniform1f(rayU.gain, view.gain);
      gl.uniform1f(rayU.mass, view.mass);
      gl.uniform1f(rayU.stars, view.stars);
      gl.bindVertexArray(emptyVao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // 2 — glyphs
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(drawProgram);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, lightTexture);
      gl.uniform1i(drawU.lights, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, atlasTexture);
      gl.uniform1i(drawU.atlas, 1);
      gl.uniform2f(drawU.grid, layout.cols, layout.rows);
      gl.uniform2f(drawU.resolution, canvas.width, canvas.height);
      gl.uniform4fv(drawU.inks, new Float32Array(inks.flat()));
      gl.uniform1f(drawU.halo, options.halo);
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, dustTexture);
      if (effects.dust?.length === layout.cols * layout.rows * 4) {
        gl.texSubImage2D(
          gl.TEXTURE_2D,
          0,
          0,
          0,
          layout.cols,
          layout.rows,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          effects.dust,
        );
      }
      gl.uniform1i(drawU.dust, 2);
      gl.activeTexture(gl.TEXTURE3);
      gl.bindTexture(gl.TEXTURE_2D, dustAtlasTexture);
      gl.uniform1i(drawU.dustAtlas, 3);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(null);
    },

    dispose() {
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
