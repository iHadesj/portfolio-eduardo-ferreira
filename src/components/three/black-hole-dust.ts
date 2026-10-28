import { CAMERA_DISTANCE, TAN_HALF_FOV, type HoleLayout } from "./black-hole";

/**
 * Loose dust around the black hole: a few dozen specks on the screen plane,
 * each spiralling in on a Keplerian orbit — slow far out, whipping round
 * near the shadow — until it crosses the photon sphere and is gone (and
 * comes back somewhere far out). They are real characters on the scene's
 * grid: dim dots far out, brighter `*` `+` closer in, and once they move
 * fast, a streak drawn along their path (`-` `/` `|` `\`) with a short
 * trail behind it, warming from ember to white as they fall.
 *
 * The pointer stirs them: specks it passes near drop inward faster, and the
 * whole cloud falls a little faster while it is close to the hole. Holding
 * the hole multiplies all of it, and sends rings of dust falling in — a
 * pulse that quickens as the pull builds, so the gravity reads as rising.
 * As the hole grows heavier its shadow grows, and specks go under sooner. Simulated on the CPU (a few dozen points)
 * and handed to the GPU as one small texture per frame, one texel per cell.
 */

/** Dust glyphs, index 0 blank: the order `DUST_GLYPH` below relies on. */
export const DUST_GLYPHS = " .*+-/|\\";
const DOT = 1;
const STAR = 2;
const PLUS = 3;
const STREAKS = [4, 5, 6, 7] as const; // - / | \  by angle

/** Photon sphere's shadow, in units of the black hole's mass. */
const SHADOW = (3 * Math.sqrt(3)) / 2;
/** The cloud is a flattened disk on the screen, leaning with the scene. */
const FLAT = 0.55;
/** Spawned this many shadow radii out (from, span). */
const SPAWN_FROM = 2.2;
const SPAWN_SPAN = 3.2;
/** Infall speed at rest, in shadow radii per second (r^-½ law). */
const FALL = 0.42;
/** Angular speed at the shadow's edge, radians per second (r^-1.5 law). */
const ORBIT = 2.3;
/** Speed (em/s) above which a speck draws as a streak. */
const STREAK_SPEED = 9;
/** The pointer's reach (em) and how much faster specks it touches fall. */
const STIR_RADIUS = 13;
const STIR = 2.6;
/** The hold's rings: they start this many (resting) shadow radii out, one
    every RING_EVERY[0] s as a hold begins and every RING_EVERY[1] s at its
    peak, falling in at RING_FALL shadow radii a second (r^-½ law). */
const RING_FROM = 4.4;
const RING_EVERY = [1.1, 0.3] as const;
const RING_FALL = 1.5;

/** The shadow's radius on screen, in em (a cell is 0.6 × 1.2 em). */
export function shadowRadius(cols: number, zoom: number): number {
  return (SHADOW / (CAMERA_DISTANCE * zoom * TAN_HALF_FOV)) * cols * 0.3;
}

interface Speck {
  r: number;
  angle: number;
  /** Seconds alive: specks fade in. */
  age: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Extra infall picked up from the pointer; decays. */
  stir: number;
}

export interface DustField {
  /** 0–1: how hard the hole is pulling (the hold). */
  pull: number;
  /** 0–1: how close the pointer is to the hole. */
  near: number;
  /** Pointer, in em from the hole's centre, y up; null when away. */
  cursor: readonly [number, number] | null;
  zoom: number;
  roll: number;
  /** The hole's mass (1 at rest): its shadow grows with it. */
  mass: number;
}

export interface Dust {
  /** Advance and rasterize: RGBA per cell (glyph, intensity, heat), bottom
      row first, ready for `texSubImage2D`. */
  step(dt: number, field: DustField): Uint8Array;
  resize(layout: HoleLayout): void;
}

export function createDust(base: number, extra: number): Dust {
  const specks: Speck[] = [];
  let cols = 0;
  let rows = 0;
  let cells = new Uint8Array(0);
  let shadow = 1;
  /** Radii of the rings in flight; time since the last one. */
  const rings: number[] = [];
  let ringClock = 0;

  const spawn = (speck: Speck, anywhere: boolean) => {
    const far = SPAWN_FROM + SPAWN_SPAN * Math.random();
    speck.r = shadow * (anywhere ? 1.3 + (far - 1.3) * Math.random() : far);
    speck.angle = Math.random() * Math.PI * 2;
    speck.age = 0;
    speck.stir = 0;
    speck.vx = 0;
    speck.vy = 0;
  };

  const plot = (
    x: number,
    y: number,
    glyph: number,
    ink: number,
    heat: number,
  ) => {
    const col = Math.floor(cols / 2 + x / 0.6);
    const row = Math.floor(rows / 2 + y / 1.2);
    if (col < 0 || col >= cols || row < 0 || row >= rows) return;
    const at = (row * cols + col) * 4;
    const level = Math.round(Math.min(ink, 1) * 255);
    if (level <= (cells[at + 1] ?? 0)) return;
    cells[at] = glyph;
    cells[at + 1] = level;
    cells[at + 2] = Math.round(Math.min(heat / 1.5, 1) * 255);
  };

  return {
    resize(layout) {
      cols = layout.cols;
      rows = layout.rows;
      cells = new Uint8Array(cols * rows * 4);
    },

    step(dt, field) {
      cells.fill(0);
      if (!cols) return cells;
      const rest = shadowRadius(cols, field.zoom);
      shadow = rest * field.mass;
      const active = Math.round(base + extra * field.pull);
      while (specks.length < base + extra) {
        const speck: Speck = {
          r: 0,
          angle: 0,
          age: 0,
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
          stir: 0,
        };
        spawn(speck, true);
        specks.push(speck);
      }
      const lean = -field.roll;
      const c = Math.cos(lean);
      const s = Math.sin(lean);
      // The hold's pulse: a ring of dust starts far out and falls in,
      // each one sooner after the last as the pull builds.
      if (field.pull > 0.02) {
        ringClock += dt;
        const every =
          RING_EVERY[0] + (RING_EVERY[1] - RING_EVERY[0]) * field.pull;
        if (ringClock >= every) {
          ringClock = 0;
          rings.push(rest * RING_FROM);
        }
      } else {
        // The first ring comes right after a hold starts.
        ringClock = RING_EVERY[0] * 0.7;
      }
      const ringFall = RING_FALL * rest * (1 + 2.5 * field.pull);
      for (let i = rings.length - 1; i >= 0; i -= 1) {
        const r = rings[i]!;
        const u = Math.min(1, shadow / r);
        const next = r - ringFall * Math.sqrt(u) * dt;
        if (next < shadow * 1.08) {
          rings.splice(i, 1);
          continue;
        }
        rings[i] = next;
        // A dotted ellipse on the screen plane, brightening as it nears.
        const points = Math.min(
          220,
          Math.max(28, Math.round((next * (1 + FLAT) * Math.PI) / 0.7)),
        );
        for (let k = 0; k < points; k += 1) {
          const a = (k / points) * Math.PI * 2;
          const ex = next * Math.cos(a);
          const ey = next * Math.sin(a) * FLAT;
          plot(
            ex * c - ey * s,
            ex * s + ey * c,
            u > 0.55 ? STAR : DOT,
            0.2 + 0.7 * u,
            0.35 + 0.6 * u,
          );
        }
      }

      const fall = FALL * shadow * (1 + 0.5 * field.near + 4.5 * field.pull);
      const spin = ORBIT * (1 + 1.4 * field.pull);

      for (let i = 0; i < specks.length; i += 1) {
        const speck = specks[i]!;
        if (i >= active && speck.age === 0) continue;
        if (speck.r < shadow * 1.05) {
          // Swallowed: the extra specks of a hold just stay gone.
          if (i >= active) {
            speck.age = 0;
            continue;
          }
          spawn(speck, false);
        }
        const u = shadow / speck.r;
        speck.r -= (fall * Math.sqrt(u) + speck.stir) * dt;
        speck.angle -= spin * u * Math.sqrt(u) * dt; // clockwise, as the disk
        speck.stir *= Math.exp(-dt * 1.5);
        speck.age += dt;

        const ex = speck.r * Math.cos(speck.angle);
        const ey = speck.r * Math.sin(speck.angle) * FLAT;
        const x = ex * c - ey * s;
        const y = ex * s + ey * c;
        if (speck.age > dt * 1.5) {
          const k = 1 - Math.exp(-dt * 30);
          speck.vx += ((x - speck.x) / dt - speck.vx) * k;
          speck.vy += ((y - speck.y) / dt - speck.vy) * k;
        }
        speck.x = x;
        speck.y = y;

        if (field.cursor) {
          const d = Math.hypot(x - field.cursor[0], y - field.cursor[1]);
          if (d < STIR_RADIUS) {
            const touch = 1 - d / STIR_RADIUS;
            speck.stir = Math.max(speck.stir, STIR * shadow * touch * touch);
          }
        }

        const speed = Math.hypot(speck.vx, speck.vy);
        const heat = 0.3 + 0.6 * Math.pow(u, 0.8);
        const ink =
          Math.min(1, speck.age / 0.8) *
          (0.35 + 0.65 * u + Math.min(speck.stir / shadow, 0.4));
        if (speed < STREAK_SPEED) {
          plot(x, y, u > 0.45 ? PLUS : u > 0.3 ? STAR : DOT, ink, heat);
          continue;
        }
        // A streak along the path, its trail fading behind it.
        const heading = Math.atan2(speck.vy, speck.vx);
        const slant = ((heading % Math.PI) + Math.PI) % Math.PI;
        const glyph =
          slant < 0.5 || slant > 2.64
            ? STREAKS[0]
            : slant < 1.35
              ? STREAKS[1]
              : slant < 1.79
                ? STREAKS[2]
                : STREAKS[3];
        const trail = Math.min(3, Math.floor(speed / 14));
        const back = 0.9 / speed;
        for (let k = 0; k <= trail; k += 1) {
          plot(
            x - speck.vx * back * k,
            y - speck.vy * back * k,
            glyph,
            ink * (1 - k / (trail + 1.5)),
            heat,
          );
        }
      }
      return cells;
    },
  };
}
