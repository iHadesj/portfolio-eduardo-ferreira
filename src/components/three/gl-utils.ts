/** Shared WebGL2 plumbing for the ASCII scenes (ribbon, black hole). */

export type Rgba = [number, number, number, number];

function link(
  gl: WebGL2RenderingContext,
  vs: string,
  fs: string,
): WebGLProgram {
  const program = gl.createProgram();
  for (const [type, source] of [
    [gl.VERTEX_SHADER, vs],
    [gl.FRAGMENT_SHADER, fs],
  ] as const) {
    const shader = gl.createShader(type);
    if (!shader) throw new Error("shader");
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    gl.attachShader(program, shader);
  }
  gl.linkProgram(program);
  return program;
}

export function compile(
  gl: WebGL2RenderingContext,
  vs: string,
  fs: string,
): WebGLProgram {
  const program = link(gl, vs, fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) ?? "link");
  }
  return program;
}

/**
 * Like `compile`, but off the main thread where the browser can: with
 * KHR_parallel_shader_compile the driver compiles in the background while we
 * poll once a frame, instead of blocking on the link status — a long ray
 * marching shader would otherwise freeze the page for a moment.
 */
export async function compileAsync(
  gl: WebGL2RenderingContext,
  vs: string,
  fs: string,
): Promise<WebGLProgram> {
  const program = link(gl, vs, fs);
  const ext = gl.getExtension("KHR_parallel_shader_compile") as {
    COMPLETION_STATUS_KHR: number;
  } | null;
  if (ext) {
    while (!gl.getProgramParameter(program, ext.COMPLETION_STATUS_KHR)) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      if (gl.isContextLost()) throw new Error("context lost");
    }
  }
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) ?? "link");
  }
  return program;
}

/** A full-screen triangle, no buffers needed. */
export const FULLSCREEN_VS = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

/** An RGBA8 texture of `w × h`, empty. */
export function allocateTexture(
  gl: WebGL2RenderingContext,
  texture: WebGLTexture,
  w: number,
  h: number,
  filter: number = gl.NEAREST,
): void {
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA8,
    w,
    h,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null,
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}

/**
 * Upload `glyphs` side by side, white on transparent, one `cellWidth ×
 * cellHeight` slot each, drawn with the page's own mono font so the live
 * scene matches the HTML poster glyph for glyph.
 */
export function uploadGlyphAtlas(
  gl: WebGL2RenderingContext,
  texture: WebGLTexture,
  glyphs: string,
  fontFamily: string,
  cellWidth: number,
  cellHeight: number,
): void {
  const cw = Math.max(1, Math.ceil(cellWidth));
  const ch = Math.max(1, Math.ceil(cellHeight));
  const atlas = document.createElement("canvas");
  atlas.width = cw * glyphs.length;
  atlas.height = ch;
  const ctx = atlas.getContext("2d");
  if (!ctx) return;
  // Advance is 0.6em in Geist Mono, so the cell width fixes the font size.
  ctx.font = `500 ${cw / 0.6}px ${fontFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff";
  for (let i = 0; i < glyphs.length; i += 1) {
    ctx.fillText(glyphs[i]!, i * cw + cw / 2, ch / 2);
  }
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}
