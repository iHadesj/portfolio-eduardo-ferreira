import { compile, uploadGlyphAtlas, type Rgba } from "./gl-utils";

/**
 * The portrait as dust: the photo, sampled into a halftone grid of square
 * dots (dot size = brightness), each dot a particle on a spring to its
 * place in the picture.
 *
 * The cursor stirs it — dots near it are pushed away, dragged along with
 * the cursor's speed and swirled round it like matter round the black
 * hole, then the springs pull them home. A dot knocked far enough out of
 * place heats up: it turns into a terminal glyph and takes the accretion
 * disk's colours, cooling back into a dot as it settles. A click sends a
 * gravitational wave out from where it landed. The first time it is seen,
 * the portrait assembles out of a whirl.
 *
 * Physics on the CPU (a few thousand points, a few flops each), drawing on
 * the GPU as one `gl.POINTS` call. The loop sleeps as soon as everything is
 * home and the cursor is away, so a still portrait costs nothing.
 */

export interface DustInks {
  /** The dots at rest. */
  dot: Rgba;
  /** Heated dots. */
  heat: Rgba;
  /** The hottest. */
  core: Rgba;
}

export interface PhotoDust {
  /** Re-read the layout (size, density) and rebuild the grid. */
  resize(): void;
  setInks(inks: DustInks): void;
  /** Whether it may animate at all (on screen, tab visible). */
  setActive(active: boolean): void;
  /** Cursor in viewport coordinates; `null` once it leaves. */
  pointer(clientX: number, clientY: number): void;
  pointerLeave(): void;
  /** A gravitational wave from a point in viewport coordinates. */
  shock(clientX: number, clientY: number): void;
  dispose(): void;
}

export interface PhotoDustOptions {
  canvas: HTMLCanvasElement;
  /** The picture's box; the canvas bleeds past it so dust can fly out. */
  frame: HTMLElement;
  image: HTMLImageElement;
  inks: DustInks;
  fontFamily: string;
  /** The part of the photo to use, as fractions of its size. */
  crop: { x: number; y: number; w: number; h: number };
  onShock?: () => void;
}

/** Roughly how many dots across the picture. */
const COLUMNS = 86;
/** Glyphs a heated dot can turn into. */
const GLYPHS = "01#%*+=-:/<>{}$@";
const GLYPH_W = 12;
const GLYPH_H = 20;

/** Cursor reach, as a fraction of the picture's width. */
const REACH = 0.17;
const PUSH = 1.25;
const CARRY = 0.2;
const SWIRL = 0.85;
const SPRING = 0.042;
const DAMPING = 0.86;
/** Displacement (in dots) at which a dot is fully hot. */
const HOT_AT = 8;
const COOLING = 0.93;

const WAVE_SPEED = 5.5;
const WAVE_BAND = 14;
const WAVE_POWER = 1.3;
const WAVE_LIFE = 50;

const VS = `#version 300 es
in vec2 aPos;
in float aEnergy;
in vec2 aDot;
uniform vec2 uRes;
uniform float uDpr;
uniform float uCell;
uniform float uInvert;
out float vEnergy;
out float vLum;
flat out float vGlyph;
void main() {
  vec2 clip = aPos / uRes * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  float lum = mix(aDot.x, 1.0 - aDot.x, uInvert);
  float hot = smoothstep(0.15, 0.6, aEnergy);
  float size = mix(uCell * (0.12 + 0.86 * lum), uCell * 2.1, hot);
  gl_PointSize = max(size * uDpr, 1.0);
  vEnergy = aEnergy;
  vLum = lum;
  vGlyph = floor(aDot.y * ${GLYPHS.length.toFixed(1)});
}`;

const FS = `#version 300 es
precision highp float;
uniform sampler2D uAtlas;
uniform vec4 uDot;
uniform vec4 uHeat;
uniform vec4 uCore;
in float vEnergy;
in float vLum;
flat in float vGlyph;
out vec4 outColor;
void main() {
  float hot = smoothstep(0.15, 0.6, vEnergy);
  vec2 pc = gl_PointCoord;
  float glyph = 0.0;
  if (pc.x > 0.2 && pc.x < 0.8) {
    vec2 uv = vec2((vGlyph + (pc.x - 0.2) / 0.6) / ${GLYPHS.length.toFixed(1)}, 1.0 - pc.y);
    glyph = texture(uAtlas, uv).a;
  }
  float shape = mix(1.0, glyph, hot);
  vec3 heat = mix(uHeat.rgb, uCore.rgb, smoothstep(0.55, 1.0, vEnergy));
  vec3 color = mix(uDot.rgb, heat, smoothstep(0.05, 0.45, vEnergy));
  float alpha = shape * mix(uDot.a * (0.45 + 0.55 * vLum), 0.9, hot);
  if (alpha < 0.01) discard;
  outColor = vec4(color * alpha, alpha);
}`;

interface Wave {
  x: number;
  y: number;
  age: number;
}

/** Perceived brightness of a 0–1 colour. */
function luma([r, g, b]: Rgba): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function createPhotoDust(options: PhotoDustOptions): PhotoDust | null {
  const { canvas, frame, image, crop, fontFamily, onShock } = options;
  const context = canvas.getContext("webgl2", {
    alpha: true,
    antialias: false,
    premultipliedAlpha: true,
  });
  if (!context) return null;
  const gl: WebGL2RenderingContext = context;

  const program = compile(gl, VS, FS);
  const loc = {
    res: gl.getUniformLocation(program, "uRes"),
    dpr: gl.getUniformLocation(program, "uDpr"),
    cell: gl.getUniformLocation(program, "uCell"),
    invert: gl.getUniformLocation(program, "uInvert"),
    atlas: gl.getUniformLocation(program, "uAtlas"),
    dot: gl.getUniformLocation(program, "uDot"),
    heat: gl.getUniformLocation(program, "uHeat"),
    core: gl.getUniformLocation(program, "uCore"),
  };
  const aPos = gl.getAttribLocation(program, "aPos");
  const aEnergy = gl.getAttribLocation(program, "aEnergy");
  const aDot = gl.getAttribLocation(program, "aDot");

  const vao = gl.createVertexArray();
  const live = gl.createBuffer();
  const still = gl.createBuffer();
  const atlas = gl.createTexture();
  uploadGlyphAtlas(gl, atlas, GLYPHS, fontFamily, GLYPH_W, GLYPH_H);

  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, live);
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 12, 0);
  gl.enableVertexAttribArray(aEnergy);
  gl.vertexAttribPointer(aEnergy, 1, gl.FLOAT, false, 12, 8);
  gl.bindBuffer(gl.ARRAY_BUFFER, still);
  gl.enableVertexAttribArray(aDot);
  gl.vertexAttribPointer(aDot, 2, gl.FLOAT, false, 8, 0);
  gl.bindVertexArray(null);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  let inks = options.inks;
  let count = 0;
  let cell = 4;
  let width = 1;
  let height = 1;
  let dpr = 1;
  let reach = 60;
  let homeX = new Float32Array(0);
  let homeY = new Float32Array(0);
  let velX = new Float32Array(0);
  let velY = new Float32Array(0);
  let state = new Float32Array(0);
  /** Inverse mass: how far a push sends each dot. */
  let lightness = new Float32Array(0);

  let active = false;
  let assembled = false;
  let frameId = 0;
  let last = 0;
  let pointerX = 0;
  let pointerY = 0;
  let pointerIn = false;
  let prevX = Number.NaN;
  let prevY = Number.NaN;
  let waves: Wave[] = [];

  /** Bleed between the canvas edge and the picture, in CSS px. */
  function bleed(): { x: number; y: number } {
    return {
      x: (canvas.clientWidth - frame.clientWidth) / 2,
      y: (canvas.clientHeight - frame.clientHeight) / 2,
    };
  }

  function sample(columns: number, rows: number): Uint8ClampedArray {
    const scratch = document.createElement("canvas");
    scratch.width = columns;
    scratch.height = rows;
    const ctx = scratch.getContext("2d", { willReadFrequently: true });
    if (!ctx) return new Uint8ClampedArray(columns * rows * 4);
    const w = image.naturalWidth;
    const h = image.naturalHeight;
    ctx.drawImage(
      image,
      crop.x * w,
      crop.y * h,
      crop.w * w,
      crop.h * h,
      0,
      0,
      columns,
      rows,
    );
    return ctx.getImageData(0, 0, columns, rows).data;
  }

  function build() {
    width = Math.max(1, canvas.clientWidth);
    height = Math.max(1, canvas.clientHeight);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    const box = bleed();
    const picW = Math.max(1, frame.clientWidth);
    const picH = Math.max(1, frame.clientHeight);
    cell = picW / COLUMNS;
    reach = picW * REACH;
    const columns = COLUMNS;
    const rows = Math.max(1, Math.round(picH / cell));
    const pixels = sample(columns, rows);

    count = columns * rows;
    homeX = new Float32Array(count);
    homeY = new Float32Array(count);
    velX = new Float32Array(count);
    velY = new Float32Array(count);
    state = new Float32Array(count * 3);
    lightness = new Float32Array(count);
    const dots = new Float32Array(count * 2);

    const cx = box.x + picW / 2;
    const cy = box.y + picH / 2;
    let seed = 0x2545f491;
    const random = () => {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      return (seed >>> 0) / 4294967296;
    };

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < columns; col += 1) {
        const i = row * columns + col;
        const p = i * 4;
        const r = pixels[p]! / 255;
        const g = pixels[p + 1]! / 255;
        const b = pixels[p + 2]! / 255;
        let lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        // A touch of contrast, and a soft vignette so the face leads.
        lum = Math.min(1, Math.max(0, Math.pow(lum, 0.85) * 1.45 - 0.22));
        const u = (col + 0.5) / columns - 0.5;
        const v = (row + 0.5) / rows - 0.42;
        const edge = Math.hypot(u * 1.1, v);
        lum *= 0.5 + 0.5 * Math.min(1, Math.max(0, (0.62 - edge) / 0.3));

        const x = box.x + (col + 0.5) * cell;
        const y = box.y + (row + 0.5) * cell;
        homeX[i] = x;
        homeY[i] = y;
        dots[i * 2] = lum;
        dots[i * 2 + 1] = random();
        // Uneven masses, so a push scatters the dots instead of moving
        // them as one sheet.
        lightness[i] = 0.35 + random() * 1.3;

        if (assembled) {
          state[i * 3] = x;
          state[i * 3 + 1] = y;
        } else {
          // Out of a whirl: scattered round the centre, already orbiting.
          const angle = random() * Math.PI * 2;
          const radius = (0.1 + random() * 0.42) * picW;
          const ox = Math.cos(angle) * radius;
          const oy = Math.sin(angle) * radius;
          state[i * 3] = cx + ox;
          state[i * 3 + 1] = cy + oy;
          velX[i] = -oy * 0.05;
          velY[i] = ox * 0.05;
          state[i * 3 + 2] = 0.55;
        }
      }
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, still);
    gl.bufferData(gl.ARRAY_BUFFER, dots, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, live);
    gl.bufferData(gl.ARRAY_BUFFER, state, gl.DYNAMIC_DRAW);
  }

  function step(f: number): boolean {
    const r2 = reach * reach;
    let mvx = 0;
    let mvy = 0;
    if (pointerIn && !Number.isNaN(prevX)) {
      mvx = Math.max(-40, Math.min(40, (pointerX - prevX) / f));
      mvy = Math.max(-40, Math.min(40, (pointerY - prevY) / f));
    }
    prevX = pointerIn ? pointerX : Number.NaN;
    prevY = pointerIn ? pointerY : Number.NaN;

    const damping = Math.pow(DAMPING, f);
    const cooling = Math.pow(COOLING, f);
    const hotAt = cell * HOT_AT;
    let restless = 0;

    for (const wave of waves) wave.age += f;
    waves = waves.filter((wave) => wave.age < WAVE_LIFE);

    for (let i = 0; i < count; i += 1) {
      const s = i * 3;
      let x = state[s]!;
      let y = state[s + 1]!;
      let vx = velX[i]!;
      let vy = velY[i]!;

      if (pointerIn) {
        const dx = x - pointerX;
        const dy = y - pointerY;
        const d2 = dx * dx + dy * dy;
        if (d2 < r2) {
          const d = Math.sqrt(d2) + 1e-3;
          const t = 1 - d / reach;
          const k = t * t * f * lightness[i]!;
          const nx = dx / d;
          const ny = dy / d;
          vx += (nx * PUSH + mvx * CARRY - ny * SWIRL) * k;
          vy += (ny * PUSH + mvy * CARRY + nx * SWIRL) * k;
        }
      }

      for (const wave of waves) {
        const dx = x - wave.x;
        const dy = y - wave.y;
        const d = Math.sqrt(dx * dx + dy * dy) + 1e-3;
        const off = Math.abs(d - wave.age * WAVE_SPEED);
        if (off < WAVE_BAND) {
          const k =
            (1 - off / WAVE_BAND) *
            (1 - wave.age / WAVE_LIFE) *
            WAVE_POWER *
            f *
            lightness[i]!;
          vx += (dx / d) * k;
          vy += (dy / d) * k;
        }
      }

      const hx = homeX[i]!;
      const hy = homeY[i]!;
      vx = (vx + (hx - x) * SPRING * f) * damping;
      vy = (vy + (hy - y) * SPRING * f) * damping;
      x += vx * f;
      y += vy * f;

      const off = Math.hypot(x - hx, y - hy);
      const energy = Math.max(
        Math.min(1, off / hotAt),
        state[s + 2]! * cooling,
      );

      state[s] = x;
      state[s + 1] = y;
      state[s + 2] = energy;
      velX[i] = vx;
      velY[i] = vy;
      restless = Math.max(restless, off, Math.abs(vx) + Math.abs(vy), energy);
    }

    if (!pointerIn && waves.length === 0 && restless < 0.02) {
      for (let i = 0; i < count; i += 1) {
        state[i * 3] = homeX[i]!;
        state[i * 3 + 1] = homeY[i]!;
        state[i * 3 + 2] = 0;
        velX[i] = 0;
        velY[i] = 0;
      }
      assembled = true;
      return false;
    }
    return true;
  }

  function draw() {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    gl.uniform2f(loc.res, width, height);
    gl.uniform1f(loc.dpr, dpr);
    gl.uniform1f(loc.cell, cell);
    // On a light theme the ink is dark: bright skin gets the small dots.
    gl.uniform1f(loc.invert, luma(inks.dot) < 0.5 ? 1 : 0);
    gl.uniform4fv(loc.dot, inks.dot);
    gl.uniform4fv(loc.heat, inks.heat);
    gl.uniform4fv(loc.core, inks.core);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, atlas);
    gl.uniform1i(loc.atlas, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, live);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, state);
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.POINTS, 0, count);
    gl.bindVertexArray(null);
  }

  function tick(now: number) {
    frameId = 0;
    const f = last ? Math.min(3, ((now - last) / 1000) * 60) : 1;
    last = now;
    const moving = step(f);
    draw();
    if (moving && active) frameId = requestAnimationFrame(tick);
    else last = 0;
  }

  function wake() {
    if (!active || frameId) return;
    frameId = requestAnimationFrame(tick);
  }

  function toLocal(clientX: number, clientY: number): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  build();
  draw();

  return {
    resize() {
      build();
      draw();
      wake();
    },
    setInks(next) {
      inks = next;
      draw();
    },
    setActive(next) {
      active = next;
      if (active) wake();
      else if (frameId) {
        cancelAnimationFrame(frameId);
        frameId = 0;
        last = 0;
      }
    },
    pointer(clientX, clientY) {
      const { x, y } = toLocal(clientX, clientY);
      const inside = x >= 0 && y >= 0 && x <= width && y <= height;
      if (!inside && !pointerIn) return;
      pointerIn = inside;
      pointerX = x;
      pointerY = y;
      wake();
    },
    pointerLeave() {
      pointerIn = false;
      prevX = Number.NaN;
    },
    shock(clientX, clientY) {
      const { x, y } = toLocal(clientX, clientY);
      waves.push({ x, y, age: 0 });
      onShock?.();
      wake();
    },
    dispose() {
      if (frameId) cancelAnimationFrame(frameId);
      gl.deleteBuffer(live);
      gl.deleteBuffer(still);
      gl.deleteTexture(atlas);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(program);
    },
  };
}
