import { createDebris, type Debris, type DebrisTiming } from "./debris";
import {
  createReboot,
  type Reboot,
  type RebootCopy,
  type RebootTick,
} from "./reboot";

/**
 * The black hole's pull on the page, in four acts.
 *
 * 1. Tension — while the reader holds the hole, every element marked
 *    `data-pull` around it leans in, the nearest most; in the last stretch
 *    it all trembles and monospaced text glitches, characters flickering
 *    into noise. Letting go before the end springs it all back.
 * 2. Collapse — held to the end, the hero is torn apart in waves: the
 *    metadata first (`data-pull` / `data-pull="1"`), then the content
 *    (`"2"`), and last the name (`"3"`), fastest of all, so the fall peaks
 *    at the very end. Text comes apart into its characters, which stream
 *    into the hole on spiralling, accelerating paths (debris.ts); boxes
 *    (`data-pull-box`: buttons, the status pill, the rule) fall in whole,
 *    stretched along the way in (spaghettification), shrinking and fading
 *    as they cross the horizon.
 * 3. Void — a beat of nothing once the last piece is in.
 * 4. Reboot — the hero prints back like a terminal: a kernel log, the
 *    prompt, `whoami` typed out, and the hero as its output (reboot.ts).
 *
 * Only transforms, opacity, visibility and clip-paths are written, once per
 * frame, and positions are measured when an act starts — so it never forces
 * a layout mid-animation. The text stays in the DOM throughout; this is
 * decoration over the real content.
 */

/** Radians the spiral turns by the time a box reaches the centre;
    most of the turn comes at the end, as it would falling in. */
const SWIRL = -1.6;
/** Share of the way in the nearest element leans during a full hold. */
const LEAN = 0.18;
/** The tremble: from this far into the hold, up to this many px. */
const TREMBLE_FROM = 0.5;
const TREMBLE = 3.2;
/** Chance per frame, at full hold, that a piece of mono text glitches. */
const GLITCH = 0.35;
/** The collapse's waves: when each starts and how long a fall takes (s).
    The last is the shortest — the acceleration peak. */
const WAVES = [
  { start: 0, fall: 0.9 },
  { start: 0.4, fall: 0.8 },
  { start: 0.9, fall: 0.55 },
] as const;
/** Within a wave, the nearest go first: the farthest waits this long (s). */
const WAVE_SPREAD = 0.14;
/** Seconds a piece of text takes to come apart, first character to last. */
const UNRAVEL = 0.34;
/** From this far into the hold the hero is measured for its collapse, a
    few pieces a frame, so nothing heavy is left for the moment it goes. */
const PREPARE_FROM = 0.7;
const PREPARE_BATCH = 4;
/** ...and its characters rasterized, this many a frame. */
const RASTER_BATCH = 120;
/** Whatever happens, the collapse is over by then (s). */
const GIVE_UP = 3.4;
/** The dark beat between the last piece in and the console (s). */
const VOID = 0.45;
/** Return spring (a hold let go early): stiff and under-damped. */
const STIFFNESS = 110;
const DAMPING = 2 * Math.sqrt(STIFFNESS) * 0.42;
/** Seconds between the first and the last element coming back out. */
const RETURN_SPREAD = 0.13;
/** How long a decode takes, seconds. */
const DECODE = 0.55;
const NOISE = "!=+*ix1IX3A#5HSG98&@$";

interface TextNodes {
  nodes: { node: Text; text: string }[];
}

interface Decode extends TextNodes {
  elapsed: number;
}

interface Item {
  el: HTMLElement;
  /** From the hole's centre to the element's, at rest (px). */
  dx: number;
  dy: number;
  /** 0 = nearest, 1 = farthest. */
  reach: number;
  /** Collapse wave, 0–2. */
  wave: number;
  /** Falls in whole (`data-pull-box`) rather than coming apart. */
  box: boolean;
  p: number;
  /** Where the collapse found it. */
  from: number;
  velocity: number;
  /** Seconds until this element starts its way back. */
  wait: number;
  /** Collapse: when it starts to go (s). */
  depart: number;
  /** Measured for the collapse (its text is debris-ready); from then on it
      stops leaning, so it never drifts from where it was measured. */
  prepared: boolean;
  hidden: boolean;
  /** Tremble offset this frame (px). */
  jx: number;
  jy: number;
  /** Monospaced text, kept to glitch and restore. */
  text?: TextNodes;
  glitched: boolean;
  decode?: Decode;
}

type Phase = "rest" | "attract" | "return" | "collapse" | "reboot";

export interface GravityEvents {
  /** The last of the hero just crossed the horizon. */
  onSwallowed(): void;
  /** The console starts printing it back. */
  onReboot(): void;
  /** Everything is back where it was. */
  onRestored(): void;
  /** Something printed during the reboot (for its sound). */
  onTick?(kind: RebootTick): void;
}

export interface GravityFrame {
  /** 0–1: how much of the hero the hole has eaten (collapse only). */
  absorbed: number;
  /** Something is still moving, falling or printing. */
  busy: boolean;
}

export interface Gravity {
  /** Lean in with `strength` 0–1 (how far through the hold). */
  attract(strength: number): void;
  /** Let go early: everything springs back. */
  release(): void;
  /** The hold is complete: tear the hero apart, then print it back. */
  collapse(): void;
  /** Mid-reboot: print the rest at once. */
  skip(): void;
  step(dt: number): GravityFrame;
  /** Snap everything back now (the scene stops, the tab hides). */
  reset(): void;
}

const clamp = (x: number, lo = 0, hi = 1) => (x < lo ? lo : x > hi ? hi : x);
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const noise = () => NOISE[Math.floor(Math.random() * NOISE.length)] ?? "#";

/**
 * Pose of an element `p` of the way in (p < 0: pushed past its rest, which
 * is how the return spring overshoots).
 */
function place(item: Item): void {
  const fall = item.p * Math.abs(item.p);
  if (Math.abs(fall) < 1e-4 && !item.jx && !item.jy) {
    item.el.style.transform = "";
    item.el.style.opacity = "";
    return;
  }
  const remaining = 1 - fall;
  const turn = SWIRL * fall * Math.abs(fall);
  const c = Math.cos(turn);
  const s = Math.sin(turn);
  const rx = (item.dx * c - item.dy * s) * remaining;
  const ry = (item.dx * s + item.dy * c) * remaining;
  const angle = Math.atan2(ry, rx);
  const inward = Math.max(fall, 0);
  // Stretched along the way in — the farther it fell from, the more — but
  // shrinking overall: long lines must not turn into streaks across the
  // screen.
  const shrink = Math.max(0.04, Math.sqrt(Math.max(remaining, 0)));
  const stretch = (1 + (0.9 + 1.6 * item.reach) * inward) * shrink * shrink;
  const squeeze = Math.max(0.12, 1 - 0.88 * inward) * shrink;
  item.el.style.transform =
    `translate(${(rx - item.dx + item.jx).toFixed(1)}px, ${(ry - item.dy + item.jy).toFixed(1)}px) ` +
    `rotate(${angle.toFixed(3)}rad) scale(${stretch.toFixed(3)}, ${squeeze.toFixed(3)}) ` +
    `rotate(${(-angle).toFixed(3)}rad)`;
  item.el.style.opacity = (1 - smoothstep(0.78, 1, item.p)).toFixed(3);
}

function textNodes(el: HTMLElement): TextNodes | undefined {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodes: TextNodes["nodes"] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as Text;
    if (text.data.trim()) nodes.push({ node: text, text: text.data });
  }
  return nodes.length ? { nodes } : undefined;
}

/** A few characters of one of the element's lines flick into noise. */
function glitch(item: Item): void {
  const nodes = item.text?.nodes;
  const pick = nodes?.[Math.floor(Math.random() * nodes.length)];
  if (!pick) return;
  const chars = [...pick.text];
  const hits = 1 + Math.floor(Math.random() * 3);
  for (let k = 0; k < hits; k += 1) {
    const i = Math.floor(Math.random() * chars.length);
    if ((chars[i] ?? " ").trim()) chars[i] = noise();
  }
  pick.node.data = chars.join("");
  item.glitched = true;
}

function unglitch(item: Item): void {
  if (!item.glitched) return;
  item.glitched = false;
  for (const { node, text } of item.text?.nodes ?? []) node.data = text;
}

/** Characters settle left to right; the rest flicker through the ramp. */
function stepDecode(decode: Decode, dt: number): boolean {
  decode.elapsed += dt;
  const t = decode.elapsed / DECODE;
  if (t >= 1) {
    for (const { node, text } of decode.nodes) node.data = text;
    return false;
  }
  const total = decode.nodes.reduce((sum, { text }) => sum + text.length, 0);
  let index = 0;
  for (const { node, text } of decode.nodes) {
    let out = "";
    for (const ch of text) {
      const settled = index / Math.max(total, 1) < t * 1.25 - 0.25;
      out += settled || ch === " " ? ch : noise();
      index += 1;
    }
    node.data = out;
  }
  return true;
}

function endDecode(decode: Decode | undefined): void {
  for (const { node, text } of decode?.nodes ?? []) node.data = text;
}

export function createGravity(
  root: HTMLElement,
  hole: HTMLElement,
  events: GravityEvents,
  /** The console's lines, read when it starts (the locale may change). */
  consoleCopy: () => RebootCopy,
  /** Draw the debris at most this often (ms); 0 = every frame. */
  frameInterval = 0,
): Gravity {
  let items: Item[] = [];
  let phase: Phase = "rest";
  let clock = 0;
  let swallowedAt = -1;
  let debris: Debris | null = null;
  let reboot: Reboot | null = null;
  /** Where the hole is (page px), measured when the collapse starts. */
  let target = { x: 0, y: 0 };

  /** The hole's centre, page px. */
  const centre = () => {
    const box = hole.getBoundingClientRect();
    return {
      x: box.left + box.width / 2 + window.scrollX,
      y: box.top + box.height / 2 + window.scrollY,
    };
  };

  const capture = () => {
    const box = hole.getBoundingClientRect();
    const hx = box.left + box.width / 2;
    const hy = box.top + box.height / 2;
    const found: Item[] = [];
    for (const el of root.querySelectorAll<HTMLElement>("[data-pull]")) {
      const rect = el.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) continue;
      if (rect.width === 0 && rect.height === 0) continue;
      found.push({
        el,
        dx: rect.left + rect.width / 2 - hx,
        dy: rect.top + rect.height / 2 - hy,
        reach: 0,
        wave: clamp(Number(el.dataset.pull) || 1, 1, WAVES.length) - 1,
        box: el.hasAttribute("data-pull-box"),
        p: 0,
        from: 0,
        velocity: 0,
        wait: 0,
        depart: 0,
        prepared: false,
        hidden: false,
        jx: 0,
        jy: 0,
        text: el.hasAttribute("data-pull-decode") ? textNodes(el) : undefined,
        glitched: false,
      });
    }
    const far = Math.max(1, ...found.map(({ dx, dy }) => Math.hypot(dx, dy)));
    for (const item of found) {
      item.reach = Math.hypot(item.dx, item.dy) / far;
      item.el.style.willChange = "transform, opacity";
      // Hover transitions would smear the per-frame pose; and nothing
      // mid-fall may catch a click meant for what is under it.
      item.el.style.transition = "none";
      item.el.style.pointerEvents = "none";
    }
    items = found;
  };

  const clear = () => {
    debris?.dispose();
    debris = null;
    reboot?.finish();
    reboot = null;
    for (const item of items) {
      unglitch(item);
      endDecode(item.decode);
      const { style } = item.el;
      style.transform = "";
      style.opacity = "";
      style.visibility = "";
      style.clipPath = "";
      style.willChange = "";
      style.transition = "";
      style.pointerEvents = "";
    }
    items = [];
    phase = "rest";
    swallowedAt = -1;
  };

  const timing = (item: Item): DebrisTiming => {
    const wave = WAVES[item.wave] ?? WAVES[0];
    return {
      start: wave.start + item.reach * WAVE_SPREAD,
      fall: wave.fall,
      unravel: UNRAVEL * (item.wave === WAVES.length - 1 ? 0.5 : 1),
    };
  };

  /** Measure up to `limit` more pieces; once all are in, rasterize up to
      `raster` of their characters. */
  const prepare = (limit: number, raster: number) => {
    if (!debris) {
      debris = createDebris(frameInterval);
      target = centre();
    }
    let measured = 0;
    for (const item of items) {
      if (item.prepared) continue;
      if (measured >= limit) return;
      measured += 1;
      item.prepared = true;
      unglitch(item);
      const when = timing(item);
      item.depart = item.box
        ? when.start
        : Math.min(when.start, debris.add(item.el, when, target));
    }
    debris.build(raster);
  };

  const startReboot = () => {
    debris?.dispose();
    debris = null;
    phase = "reboot";
    reboot = createReboot(
      items.map(({ el, wave }) => ({
        el,
        letter: wave === WAVES.length - 1,
        decode: el.hasAttribute("data-pull-decode"),
        command: el.hasAttribute("data-pull-command"),
      })),
      root.querySelector<HTMLElement>("[data-gravity-console]"),
      consoleCopy(),
      items.length,
      clock,
      (kind) => events.onTick?.(kind),
    );
    events.onReboot();
  };

  return {
    attract(strength) {
      if (phase === "collapse" || phase === "reboot") return;
      if (phase !== "attract") {
        // A new hold mid-return starts from where things are.
        if (!items.length) capture();
        phase = "attract";
        for (const item of items) {
          endDecode(item.decode);
          item.decode = undefined;
          item.velocity = 0;
        }
      }
      if (strength >= PREPARE_FROM) prepare(PREPARE_BATCH, RASTER_BATCH);
      const lean = LEAN * Math.pow(strength, 1.6);
      const tremble =
        TREMBLE * Math.pow(smoothstep(TREMBLE_FROM, 1, strength), 1.4);
      const glitchChance = GLITCH * Math.pow(strength, 3);
      for (const item of items) {
        if (!item.prepared) {
          const goal = lean * (1 - 0.5 * item.reach);
          item.p += (goal - item.p) * 0.25;
        }
        item.jx = tremble ? (Math.random() * 2 - 1) * tremble : 0;
        item.jy = tremble ? (Math.random() * 2 - 1) * tremble : 0;
        place(item);
        unglitch(item);
        if (item.text && Math.random() < glitchChance) glitch(item);
      }
    },

    release() {
      if (phase !== "attract") return;
      phase = "return";
      debris?.dispose();
      debris = null;
      for (const item of items) {
        item.prepared = false;
        unglitch(item);
        item.jx = 0;
        item.jy = 0;
        item.wait = item.reach * RETURN_SPREAD;
      }
    },

    collapse() {
      if (!items.length) capture();
      phase = "collapse";
      clock = 0;
      swallowedAt = -1;
      for (const item of items) {
        unglitch(item);
        endDecode(item.decode);
        item.decode = undefined;
        item.from = item.p;
        item.velocity = 0;
        item.jx = 0;
        item.jy = 0;
      }
      // Usually all measured during the hold already.
      prepare(Infinity, Infinity);
    },

    skip() {
      if (phase !== "reboot") return;
      clear();
      events.onRestored();
    },

    step(dt) {
      if (phase === "rest") return { absorbed: 0, busy: false };
      if (phase === "attract") return { absorbed: 0, busy: true };

      if (phase === "collapse") {
        clock += dt;
        let eaten = 0;
        let boxes = 0;
        for (const item of items) {
          // Whatever has not gone yet shakes harder than ever.
          const waiting = clock < item.depart;
          item.jx = waiting ? (Math.random() * 2 - 1) * TREMBLE * 1.3 : 0;
          item.jy = waiting ? (Math.random() * 2 - 1) * TREMBLE * 1.3 : 0;
          if (item.box) {
            boxes += 1;
            const wave = WAVES[item.wave] ?? WAVES[0];
            const k = clamp((clock - item.depart) / wave.fall);
            // Cubic: every fall accelerates all the way to the horizon.
            item.p = item.from + (1 - item.from) * k * k * k;
            place(item);
            if (k >= 1) eaten += 1;
          } else if (item.hidden) {
            continue;
          } else if (waiting) {
            place(item);
          } else {
            // From here on its characters are debris.
            item.hidden = true;
            item.el.style.visibility = "hidden";
          }
        }
        const torn = debris?.step(dt, target) ?? { eaten: 0, total: 0 };
        const total = boxes + torn.total;
        const absorbed = total ? (eaten + torn.eaten) / total : 1;
        if (swallowedAt < 0 && (absorbed >= 1 || clock >= GIVE_UP)) {
          swallowedAt = clock;
          for (const item of items) {
            item.hidden = true;
            item.el.style.visibility = "hidden";
          }
          events.onSwallowed();
        }
        if (swallowedAt >= 0 && clock >= swallowedAt + VOID) startReboot();
        return { absorbed, busy: true };
      }

      if (phase === "reboot") {
        clock += dt;
        if (reboot?.step(dt)) return { absorbed: 1, busy: true };
        clear();
        events.onRestored();
        return { absorbed: 0, busy: false };
      }

      // A hold let go early: everything springs back.
      let moving = false;
      for (const item of items) {
        if (item.wait > 0) {
          item.wait -= dt;
          moving = true;
          continue;
        }
        if (!item.decode && item.p > 0.1 && item.text) {
          item.decode = { nodes: item.text.nodes, elapsed: 0 };
        }
        const accel = -STIFFNESS * item.p - DAMPING * item.velocity;
        item.velocity += accel * dt;
        item.p += item.velocity * dt;
        if (item.decode && !stepDecode(item.decode, dt))
          item.decode = undefined;
        if (
          Math.abs(item.p) > 0.002 ||
          Math.abs(item.velocity) > 0.02 ||
          item.decode
        ) {
          moving = true;
        } else {
          item.p = 0;
        }
        place(item);
      }
      if (!moving) clear();
      return { absorbed: 0, busy: moving };
    },

    reset: clear,
  };
}
