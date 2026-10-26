import {
  EDGE_SPREAD,
  EMPTY_BELOW,
  GLYPHS,
  GLYPH_SHAPES,
  LIGHT,
  MAX_INK,
  RAMP,
  RAMP_HIGH,
  RAMP_INDEX,
  RAMP_LOW,
  SHARPEN,
  SUB_X,
  SUB_Y,
  buildRibbonMesh,
  cameraDistance,
  modelMatrix,
  perspective,
  type AsciiLayout,
  type Pose,
} from "./ascii-ribbon";
import {
  FULLSCREEN_VS,
  allocateTexture,
  compile,
  uploadGlyphAtlas,
  type Rgba,
} from "./gl-utils";

export type { Rgba };

/**
 * Live ASCII renderer, raw WebGL2. Three passes per frame, all tiny except
 * the last:
 *
 * 1. Samples: the ribbon mesh is drawn into a `cols·2 × rows·3` target —
 *    one texel per sixth of a character cell — storing brightness and
 *    nearness, empty texels left at zero.
 * 2. Cells: one fragment per character cell reads its six samples and picks
 *    a glyph exactly like `matchGlyph` in ascii-ribbon.ts (tone ramp inside,
 *    shape match on edges), plus the cell's mean nearness.
 * 3. Glyphs: a full-screen triangle draws each cell's glyph from an atlas
 *    rendered once with the page's own mono font, inked by depth.
 *
 * The main-thread cost of a frame is a few uniforms and three draw calls.
 */

/** Brightness is stored /LUM_SCALE so values up to ~1.15 survive RGBA8. */
const LUM_SCALE = 1.25;

/* The strip rolls around its centre line: see `RibbonMesh`. */
const MESH_VS = `#version 300 es
layout(location = 0) in vec3 aCenter;
layout(location = 1) in vec3 aWidth;
layout(location = 2) in vec3 aDepth;
layout(location = 3) in float aOffset;
uniform mat4 uModel;
uniform mat4 uProj;
uniform float uCamera;
uniform vec2 uRoll;
out vec3 vNormal;
out vec3 vView;
void main() {
  vec3 across = aWidth * uRoll.x + aDepth * uRoll.y;
  vec4 w = uModel * vec4(aCenter + across * aOffset, 1.0);
  vView = vec3(w.xy, w.z - uCamera);
  vNormal = mat3(uModel) * (aDepth * uRoll.x - aWidth * uRoll.y);
  gl_Position = uProj * vec4(vView, 1.0);
}`;

/* Mirrors `shade` and `nearness` in ascii-ribbon.ts line for line. */
const MESH_FS = `#version 300 es
precision highp float;
in vec3 vNormal;
in vec3 vView;
uniform vec3 uLight;
uniform float uCamera;
out vec4 outColor;
void main() {
  vec3 n = normalize(vNormal);
  vec3 v = normalize(-vView);
  if (dot(n, v) < 0.0) n = -n;
  float lambert = max(dot(n, uLight), 0.0);
  vec3 h = normalize(uLight + v);
  float spec = pow(max(dot(n, h), 0.0), 24.0);
  float rim = pow(1.0 - max(dot(n, v), 0.0), 2.0);
  float lum = min(0.3 + 0.62 * lambert + 0.55 * spec + 0.35 * rim, 1.15);
  float near = clamp((uCamera + 1.0 + vView.z) / 2.0, 0.0, 1.0);
  outColor = vec4(lum / ${LUM_SCALE.toFixed(2)}, near, 0.0, 1.0);
}`;

const GLYPH_COUNT = GLYPH_SHAPES.length;
const RAMP_COUNT = RAMP.length;

/* Mirrors `matchGlyph` in ascii-ribbon.ts. Cell rows count from the bottom
   here (GL), so the glyph table's top sixths are the highest sample row. */
const CELL_FS = `#version 300 es
precision highp float;
#define GLYPHS ${GLYPH_COUNT}
#define RAMP_LEN ${RAMP_COUNT}
uniform sampler2D uSamples;
uniform float uShapes[GLYPHS * 6];
uniform float uRamp[RAMP_LEN];
out vec4 outColor;
void main() {
  ivec2 cell = ivec2(gl_FragCoord.xy);
  float s[6];
  float nearSum = 0.0;
  float covered = 0.0;
  float peak = 0.0;
  float low = 10.0;
  float total = 0.0;
  for (int k = 0; k < 6; k++) {
    ivec2 at = ivec2(cell.x * ${SUB_X} + k % 2, cell.y * ${SUB_Y} + 2 - k / 2);
    vec4 t = texelFetch(uSamples, at, 0);
    s[k] = t.r * ${LUM_SCALE.toFixed(2)};
    nearSum += t.g * t.a;
    covered += t.a;
    peak = max(peak, s[k]);
    low = min(low, s[k]);
    total += s[k];
  }
  float index = 0.0;
  if (peak >= ${EMPTY_BELOW.toFixed(3)}) {
    if (low >= ${EMPTY_BELOW.toFixed(3)} && peak - low < ${EDGE_SPREAD.toFixed(3)}) {
      float t = clamp((total / 6.0 - ${RAMP_LOW.toFixed(3)}) / ${(RAMP_HIGH - RAMP_LOW).toFixed(3)}, 0.0, 1.0);
      index = uRamp[int(floor(t * float(RAMP_LEN - 1) + 0.5))];
    } else {
      float v[6];
      for (int k = 0; k < 6; k++) {
        v[k] = min(peak * pow(s[k] / peak, ${SHARPEN.toFixed(3)}), 1.0) * ${MAX_INK.toFixed(3)};
      }
      float best = 1e9;
      for (int g = 0; g < GLYPHS; g++) {
        float d = 0.0;
        for (int k = 0; k < 6; k++) {
          float e = v[k] - uShapes[g * 6 + k];
          d += e * e;
        }
        if (d < best) {
          best = d;
          index = float(g);
        }
      }
    }
  }
  float near = covered > 0.0 ? nearSum / covered : 0.0;
  outColor = vec4(index / 255.0, near, 0.0, index > 0.0 ? 1.0 : 0.0);
}`;

const DRAW_FS = `#version 300 es
precision highp float;
uniform sampler2D uCells;
uniform sampler2D uAtlas;
uniform vec2 uGrid;
uniform vec2 uResolution;
uniform vec4 uNear;
uniform vec4 uMid;
uniform vec4 uFar;
out vec4 outColor;
void main() {
  vec2 g = gl_FragCoord.xy / uResolution * uGrid;
  vec4 cell = texelFetch(uCells, ivec2(floor(g)), 0);
  if (cell.a == 0.0) {
    outColor = vec4(0.0);
    return;
  }
  float index = floor(cell.r * 255.0 + 0.5);
  vec2 local = fract(g);
  float ink = texture(uAtlas, vec2((index + local.x) / ${GLYPH_COUNT.toFixed(1)}, local.y)).a;
  float near = cell.g;
  vec4 color = near > 0.5
    ? mix(uMid, uNear, (near - 0.5) * 2.0)
    : mix(uFar, uMid, near * 2.0);
  outColor = vec4(color.rgb * color.a, color.a) * ink;
}`;

/** Ink by depth: near strands bright, far strands sink into the page. */
export interface RibbonInks {
  near: Rgba;
  mid: Rgba;
  far: Rgba;
}

export interface AsciiRendererOptions {
  /** CSS `font-family` of the poster, so the atlas matches it glyph for glyph. */
  fontFamily: string;
  inks: RibbonInks;
}

export interface AsciiRenderer {
  /** Match the canvas to its box; call on resize. */
  resize(layout: AsciiLayout, width: number, height: number): void;
  setInks(inks: RibbonInks): void;
  render(pose: Pose): void;
  dispose(): void;
}

/** Returns null when WebGL2 is unavailable — the poster then simply stays. */
export function createAsciiRenderer(
  canvas: HTMLCanvasElement,
  options: AsciiRendererOptions,
): AsciiRenderer | null {
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    antialias: false,
    depth: false,
    premultipliedAlpha: true,
    powerPreference: "low-power",
  });
  if (!gl) return null;

  let meshProgram: WebGLProgram;
  let cellProgram: WebGLProgram;
  let drawProgram: WebGLProgram;
  try {
    meshProgram = compile(gl, MESH_VS, MESH_FS);
    cellProgram = compile(gl, FULLSCREEN_VS, CELL_FS);
    drawProgram = compile(gl, FULLSCREEN_VS, DRAW_FS);
  } catch {
    return null;
  }
  const emptyVao = gl.createVertexArray();

  const mesh = buildRibbonMesh();
  const meshVao = gl.createVertexArray();
  gl.bindVertexArray(meshVao);
  for (const [location, data, size] of [
    [0, mesh.centers, 3],
    [1, mesh.widths, 3],
    [2, mesh.depths, 3],
    [3, mesh.offsets, 1],
  ] as const) {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
  }
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);
  gl.bindVertexArray(null);

  const meshU = {
    model: gl.getUniformLocation(meshProgram, "uModel"),
    proj: gl.getUniformLocation(meshProgram, "uProj"),
    camera: gl.getUniformLocation(meshProgram, "uCamera"),
    light: gl.getUniformLocation(meshProgram, "uLight"),
    roll: gl.getUniformLocation(meshProgram, "uRoll"),
  };
  const drawU = {
    cells: gl.getUniformLocation(drawProgram, "uCells"),
    atlas: gl.getUniformLocation(drawProgram, "uAtlas"),
    grid: gl.getUniformLocation(drawProgram, "uGrid"),
    resolution: gl.getUniformLocation(drawProgram, "uResolution"),
    near: gl.getUniformLocation(drawProgram, "uNear"),
    mid: gl.getUniformLocation(drawProgram, "uMid"),
    far: gl.getUniformLocation(drawProgram, "uFar"),
  };

  // The glyph table never changes: upload it once.
  gl.useProgram(cellProgram);
  gl.uniform1fv(
    gl.getUniformLocation(cellProgram, "uShapes"),
    new Float32Array(GLYPH_SHAPES.flatMap(([, ink]) => ink)),
  );
  gl.uniform1fv(
    gl.getUniformLocation(cellProgram, "uRamp"),
    new Float32Array(RAMP_INDEX),
  );
  gl.uniform1i(gl.getUniformLocation(cellProgram, "uSamples"), 0);

  const sampleTexture = gl.createTexture();
  const sampleDepth = gl.createRenderbuffer();
  const sampleTarget = gl.createFramebuffer();
  const cellTexture = gl.createTexture();
  const cellTarget = gl.createFramebuffer();
  const atlasTexture = gl.createTexture();

  let layout: AsciiLayout = { cols: 0, rows: 0, aspect: 1 };
  let aspect = 1;
  let inks = options.inks;

  const allocate = (texture: WebGLTexture, w: number, h: number) =>
    allocateTexture(gl, texture, w, h);

  const buildTargets = () => {
    const sw = layout.cols * SUB_X;
    const sh = layout.rows * SUB_Y;
    allocate(sampleTexture, sw, sh);
    gl.bindRenderbuffer(gl.RENDERBUFFER, sampleDepth);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, sw, sh);
    gl.bindFramebuffer(gl.FRAMEBUFFER, sampleTarget);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      sampleTexture,
      0,
    );
    gl.framebufferRenderbuffer(
      gl.FRAMEBUFFER,
      gl.DEPTH_ATTACHMENT,
      gl.RENDERBUFFER,
      sampleDepth,
    );
    allocate(cellTexture, layout.cols, layout.rows);
    gl.bindFramebuffer(gl.FRAMEBUFFER, cellTarget);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      cellTexture,
      0,
    );
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };

  const buildAtlas = (cellWidth: number, cellHeight: number) =>
    uploadGlyphAtlas(
      gl,
      atlasTexture,
      GLYPHS,
      options.fontFamily,
      cellWidth,
      cellHeight,
    );

  return {
    resize(nextLayout, width, height) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      aspect = width / Math.max(height, 1);
      const layoutChanged =
        nextLayout.cols !== layout.cols || nextLayout.rows !== layout.rows;
      layout = nextLayout;
      if (layoutChanged) buildTargets();
      buildAtlas(canvas.width / layout.cols, canvas.height / layout.rows);
    },

    setInks(next) {
      inks = next;
    },

    render(pose) {
      const camera = cameraDistance(aspect);

      // 1 — samples
      gl.bindFramebuffer(gl.FRAMEBUFFER, sampleTarget);
      gl.viewport(0, 0, layout.cols * SUB_X, layout.rows * SUB_Y);
      gl.clearColor(0, 0, 0, 0);
      gl.enable(gl.DEPTH_TEST);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(meshProgram);
      gl.uniformMatrix4fv(meshU.model, false, modelMatrix(pose));
      gl.uniformMatrix4fv(meshU.proj, false, perspective(aspect));
      gl.uniform1f(meshU.camera, camera);
      gl.uniform3f(meshU.light, LIGHT[0], LIGHT[1], LIGHT[2]);
      gl.uniform2f(meshU.roll, Math.cos(pose.roll), Math.sin(pose.roll));
      gl.bindVertexArray(meshVao);
      gl.drawElements(gl.TRIANGLES, mesh.indices.length, gl.UNSIGNED_SHORT, 0);
      gl.disable(gl.DEPTH_TEST);

      // 2 — cells
      gl.bindFramebuffer(gl.FRAMEBUFFER, cellTarget);
      gl.viewport(0, 0, layout.cols, layout.rows);
      gl.useProgram(cellProgram);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, sampleTexture);
      gl.bindVertexArray(emptyVao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // 3 — glyphs
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(drawProgram);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, cellTexture);
      gl.uniform1i(drawU.cells, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, atlasTexture);
      gl.uniform1i(drawU.atlas, 1);
      gl.uniform2f(drawU.grid, layout.cols, layout.rows);
      gl.uniform2f(drawU.resolution, canvas.width, canvas.height);
      gl.uniform4fv(drawU.near, inks.near);
      gl.uniform4fv(drawU.mid, inks.mid);
      gl.uniform4fv(drawU.far, inks.far);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(null);
    },

    dispose() {
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
