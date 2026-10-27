/**
 * The collapse's debris: the hero's text torn into its characters and
 * drawn on a canvas over the page while the black hole eats it.
 *
 * Each element comes apart like a thread being pulled — the character
 * nearest the hole goes first, the rest follow it off the line — and every
 * character falls on its own accelerating spiral (turning the way the disk
 * turns), stretched along its path, heating from its own colour through
 * the disk's orange to white as it nears the horizon. The canvas is never
 * cleared outright, only faded a little each frame, so the characters leave
 * streaks: streams of text being spaghettified into the singularity.
 *
 * Positions are measured once (a Range per character) and kept in page
 * coordinates, so a scroll mid-collapse moves nothing that has not left.
 * Every character is rasterized once, up front, into an atlas — in its own
 * colour, in orange and in white — so a frame is only textured quads: no
 * text layout, no colour parsing, however many characters are falling.
 */

/** Radians each character turns on its way in (screen-clockwise). */
const SWIRL = 2.6;
/** How fast the streaks fade, 1/s: higher is shorter. */
const TRAIL = 15;
/** Heat where a character is fully orange; white-hot at 1. */
const ORANGE_AT = 0.55;
/** Atlas row width (device px). */
const ATLAS_WIDTH = 2048;

export interface DebrisTiming {
  /** When the element starts to come apart (s, from the collapse). */
  start: number;
  /** Seconds a character takes to fall. */
  fall: number;
  /** Seconds between the first and the last character leaving. */
  unravel: number;
}

interface Sprite {
  /** Atlas rect, device px. */
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Glyph {
  ch: string;
  /** At rest, page px (centre of the character). */
  x: number;
  y: number;
  font: number;
  /** Its own colour (index into `colors`). */
  color: number;
  /** Drawn from (its element's first departure) and leaving at (s). */
  show: number;
  depart: number;
  fall: number;
  /** 0–1, per character: a little variety in the spiral and tumble. */
  seed: number;
  done: boolean;
  /** Its own colour, orange, white — filled in when the atlas is built. */
  cool?: Sprite;
  warm?: Sprite;
  hot?: Sprite;
}

export interface Debris {
  /** Tear `el`'s text into glyphs; returns when the first of them leaves
      (Infinity when there is no text to draw). */
  add(el: HTMLElement, timing: DebrisTiming, hole: Point): number;
  /** Rasterize the glyphs added so far, up to `budget` characters this
      call; true once the atlas is ready (drawing finishes it anyway). */
  build(budget?: number): boolean;
  /** Advance and draw; `eaten` of `total` glyphs have crossed over. */
  step(dt: number, hole: Point): { eaten: number; total: number };
  dispose(): void;
}

export interface Point {
  /** Page coordinates (px). */
  x: number;
  y: number;
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** A colour token (`var(--…)`), resolved through the cascade. */
function tokenColor(value: string): string {
  const probe = document.createElement("span");
  probe.style.color = value;
  probe.style.display = "none";
  document.body.append(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color;
}

/** `frameInterval`: draw at most this often (ms) — touch devices run the
    scene at 30 fps, and so do its debris. */
export function createDebris(frameInterval = 0): Debris {
  const canvas = document.createElement("canvas");
  canvas.className = "hole-debris";
  canvas.setAttribute("aria-hidden", "true");
  document.body.append(canvas);
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const fit = () => {
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
  };
  fit();
  window.addEventListener("resize", fit);

  const flame = tokenColor("var(--color-hole-flame)");
  const white = tokenColor("var(--color-hole-white)");
  const fonts: string[] = [];
  const sizes: number[] = [];
  /** Per font, how far its glyphs may stretch: big letters (the name)
      stretch less, or they smear into a wall. */
  const reach: number[] = [];
  /** Computed colours, as the canvas will fill them. */
  const colors: string[] = [];
  const glyphs: Glyph[] = [];
  let atlas: CanvasImageSource | null = null;
  let clock = 0;
  /** Time since the last drawn frame (s). */
  let since = 0;

  const fontIndex = (font: string, size: number) => {
    let i = fonts.indexOf(font);
    if (i < 0) {
      i = fonts.push(font) - 1;
      sizes.push(size);
      reach.push(3.2 * Math.min(1, Math.max(0.3, 18 / Math.max(size, 1))));
    }
    return i;
  };

  const colorIndex = (css: string) => {
    const i = colors.indexOf(css);
    return i >= 0 ? i : colors.push(css) - 1;
  };

  type Paint = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  /** The atlas being painted, a batch of characters per call. */
  let pending: {
    jobs: { key: string; font: number; fill: string; ch: string }[];
    sprites: Map<string, Sprite>;
    keys: string[][];
    sheet: HTMLCanvasElement | OffscreenCanvas;
    paint: Paint;
    next: number;
    font: number;
  } | null = null;

  /** Every character, three times over, packed in rows. */
  const startAtlas = () => {
    const measure = document.createElement("canvas").getContext("2d");
    if (!measure) return;
    const sprites = new Map<string, Sprite>();
    const jobs: { key: string; font: number; fill: string; ch: string }[] = [];
    const need = (font: number, fill: string, ch: string) => {
      const key = `${font}\u0000${fill}\u0000${ch}`;
      if (!sprites.has(key)) {
        sprites.set(key, { x: 0, y: 0, w: 0, h: 0 });
        jobs.push({ key, font, fill, ch });
      }
      return key;
    };
    const keys = glyphs.map((glyph) => [
      need(glyph.font, colors[glyph.color] ?? "#fff", glyph.ch),
      need(glyph.font, flame, glyph.ch),
      need(glyph.font, white, glyph.ch),
    ]);

    // Shelf packing: left to right, a new row when one is full.
    let x = 0;
    let y = 0;
    let row = 0;
    for (const job of jobs) {
      measure.font = fonts[job.font] ?? "16px monospace";
      const size = sizes[job.font] ?? 16;
      const w =
        Math.ceil((measure.measureText(job.ch).width + size * 0.3) * dpr) + 2;
      const h = Math.ceil(size * 1.4 * dpr) + 2;
      if (x + w > ATLAS_WIDTH) {
        x = 0;
        y += row;
        row = 0;
      }
      const sprite = sprites.get(job.key);
      if (sprite) Object.assign(sprite, { x, y, w, h });
      x += w;
      row = Math.max(row, h);
    }
    const height = Math.max(1, y + row);
    const sheet: HTMLCanvasElement | OffscreenCanvas =
      typeof OffscreenCanvas === "undefined"
        ? Object.assign(document.createElement("canvas"), {
            width: ATLAS_WIDTH,
            height,
          })
        : new OffscreenCanvas(ATLAS_WIDTH, height);
    const paint = sheet.getContext("2d") as Paint | null;
    if (!paint) return;
    paint.textAlign = "center";
    paint.textBaseline = "middle";
    pending = { jobs, sprites, keys, sheet, paint, next: 0, font: -1 };
  };

  /** Paint up to `budget` more characters; hand the atlas over when done. */
  const continueAtlas = (budget: number) => {
    const job = pending;
    if (!job) return;
    const { paint, sprites } = job;
    const end = Math.min(job.jobs.length, job.next + budget);
    for (; job.next < end; job.next += 1) {
      const { key, font, fill, ch } = job.jobs[job.next] ?? {};
      const sprite = sprites.get(key ?? "");
      if (!sprite || font === undefined || ch === undefined) continue;
      if (font !== job.font) {
        job.font = font;
        paint.font = fonts[font] ?? "16px monospace";
      }
      // A colour this canvas cannot parse leaves the fill as it was:
      // start from white, never from the previous character's colour.
      paint.fillStyle = "#fff";
      paint.fillStyle = fill ?? "#fff";
      paint.setTransform(
        dpr,
        0,
        0,
        dpr,
        sprite.x + sprite.w / 2,
        sprite.y + sprite.h / 2,
      );
      paint.fillText(ch, 0, 0);
    }
    if (job.next < job.jobs.length) return;
    atlas =
      job.sheet instanceof HTMLCanvasElement
        ? job.sheet
        : job.sheet.transferToImageBitmap();
    glyphs.forEach((glyph, i) => {
      const [cool, warm, hot] = job.keys[i] ?? [];
      glyph.cool = sprites.get(cool ?? "");
      glyph.warm = sprites.get(warm ?? "");
      glyph.hot = sprites.get(hot ?? "");
    });
    pending = null;
  };

  return {
    add(el, timing, hole) {
      const range = document.createRange();
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const sx = window.scrollX;
      const sy = window.scrollY;
      const found: Omit<Glyph, "show" | "depart">[] = [];
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node as Text;
        const parent = text.parentElement;
        if (!parent) continue;
        const style = getComputedStyle(parent);
        const font = fontIndex(
          `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`,
          parseFloat(style.fontSize),
        );
        const color = colorIndex(style.color);
        for (let i = 0; i < text.data.length; i += 1) {
          const ch = text.data[i] ?? " ";
          if (!ch.trim()) continue;
          range.setStart(text, i);
          range.setEnd(text, i + 1);
          const rect = range.getBoundingClientRect();
          if (!rect.width && !rect.height) continue;
          found.push({
            ch,
            x: rect.left + rect.width / 2 + sx,
            y: rect.top + rect.height / 2 + sy,
            font,
            color,
            fall: timing.fall * (0.85 + 0.3 * Math.random()),
            seed: Math.random(),
            done: false,
          });
        }
      }
      if (!found.length) return Infinity;
      // Nearest the hole leaves first: the line unravels toward it.
      const order = found
        .map((glyph, i) => ({
          i,
          d: Math.hypot(glyph.x - hole.x, glyph.y - hole.y),
        }))
        .sort((a, b) => a.d - b.d);
      const gap = timing.unravel / Math.max(found.length - 1, 1);
      order.forEach(({ i }, rank) => {
        const glyph = found[i];
        if (!glyph) return;
        glyphs.push({
          ...glyph,
          show: timing.start,
          depart: timing.start + rank * gap,
        });
      });
      atlas = null;
      pending = null;
      return timing.start;
    },

    build(budget = Infinity) {
      if (atlas) return true;
      if (!pending) startAtlas();
      continueAtlas(budget);
      return !!atlas;
    },

    step(dt, hole) {
      clock += dt;
      since += dt;
      let eaten = 0;
      const total = glyphs.length;
      if (!ctx) return { eaten: total, total };
      if (since * 1000 < frameInterval) {
        // Not drawing this frame; only count what has crossed over.
        for (const glyph of glyphs) {
          if (!glyph.done && clock >= glyph.depart + glyph.fall) {
            glyph.done = true;
          }
          if (glyph.done) eaten += 1;
        }
        return { eaten, total };
      }
      if (!atlas) {
        if (!pending) startAtlas();
        continueAtlas(Infinity);
      }
      const sheet = atlas;
      const elapsed = since;
      since = 0;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      // Fade what is there instead of clearing it: the streaks.
      ctx.globalCompositeOperation = "destination-out";
      ctx.globalAlpha = 1 - Math.exp(-TRAIL * elapsed);
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = "source-over";
      const sx = window.scrollX;
      const sy = window.scrollY;

      const draw = (sprite: Sprite | undefined, alpha: number) => {
        if (!sprite || !sheet || alpha <= 0.004) return;
        ctx.globalAlpha = alpha;
        const w = sprite.w / dpr;
        const h = sprite.h / dpr;
        ctx.drawImage(
          sheet,
          sprite.x,
          sprite.y,
          sprite.w,
          sprite.h,
          -w / 2,
          -h / 2,
          w,
          h,
        );
      };

      for (const glyph of glyphs) {
        if (glyph.done) {
          eaten += 1;
          continue;
        }
        if (clock < glyph.show) continue;
        let x = glyph.x;
        let y = glyph.y;
        let a = 1;
        let b = 0;
        let c = 0;
        let d = 1;
        let alpha = 1;
        let heat = 0;
        const k = (clock - glyph.depart) / glyph.fall;
        if (k >= 1) {
          glyph.done = true;
          eaten += 1;
          continue;
        }
        if (k > 0) {
          // Accelerating all the way in, turning faster as it goes.
          const dx = glyph.x - hole.x;
          const dy = glyph.y - hole.y;
          const r0 = Math.hypot(dx, dy);
          const a0 = Math.atan2(dy, dx);
          const swirl = SWIRL * (0.75 + 0.5 * glyph.seed);
          const at = (q: number): [number, number] => {
            const e = Math.pow(q, 2.4);
            const r = r0 * (1 - e);
            const turn = a0 + swirl * e * e;
            return [
              hole.x + r * Math.cos(turn),
              hole.y + r * Math.sin(turn) * (1 - 0.3 * e),
            ];
          };
          const e = Math.pow(k, 2.4);
          [x, y] = at(k);
          const [nx, ny] = at(Math.min(1, k + 0.025));
          const heading = Math.atan2(ny - y, nx - x);
          const speed = Math.hypot(nx - x, ny - y);
          // Stretched along the path (spaghettified), thinner and smaller
          // the deeper it gets, and tumbling at the end.
          const shrink = 1 - 0.78 * e;
          const stretchMax = reach[glyph.font] ?? 3.2;
          const along = (1 + Math.min(stretchMax, speed * 0.22)) * shrink;
          const across = shrink * (1 - 0.45 * e);
          const ch = Math.cos(heading);
          const sh = Math.sin(heading);
          const m00 = ch * ch * along + sh * sh * across;
          const m01 = ch * sh * (along - across);
          const m11 = sh * sh * along + ch * ch * across;
          const spin = (glyph.seed - 0.5) * 3 * e * e;
          const cs = Math.cos(spin);
          const ss = Math.sin(spin);
          a = cs * m00 - ss * m01;
          b = ss * m00 + cs * m01;
          c = cs * m01 - ss * m11;
          d = ss * m01 + cs * m11;
          alpha = 1 - smoothstep(0.86, 1, k);
          heat = smoothstep(0.12, 0.92, e);
        }
        ctx.setTransform(
          a * dpr,
          b * dpr,
          c * dpr,
          d * dpr,
          (x - sx) * dpr,
          (y - sy) * dpr,
        );
        // Its colour heating up: the cooler sprite, the hotter one over it.
        if (heat < ORANGE_AT) {
          draw(glyph.cool, alpha);
          draw(glyph.warm, alpha * (heat / ORANGE_AT));
        } else {
          draw(glyph.warm, alpha);
          draw(glyph.hot, alpha * ((heat - ORANGE_AT) / (1 - ORANGE_AT)));
        }
      }
      ctx.globalAlpha = 1;
      return { eaten, total };
    },

    dispose() {
      window.removeEventListener("resize", fit);
      if (atlas instanceof ImageBitmap) atlas.close();
      atlas = null;
      pending = null;
      canvas.remove();
    },
  };
}
