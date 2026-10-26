/**
 * The black hole's pull on the page, in three acts.
 *
 * 1. Attraction — while the reader holds the hole, every element marked
 *    `data-pull` around it leans in a little, the nearest most, stretching
 *    toward it. Letting go before the end springs it all back.
 * 2. Collapse — held to the end, the hero falls in, in waves: the metadata
 *    first (`data-pull` / `data-pull="1"`), then the content (`"2"`), and
 *    last the name (`"3"`), fastest of all, so the fall peaks at the very
 *    end. Each element accelerates as it goes, spiralling, stretched along
 *    the way in by how far it had to fall (spaghettification), shrinking
 *    and fading as it crosses the horizon.
 * 3. Return — after a beat of nothing, everything is thrown back out and
 *    lands on a spring, overshooting a little; text marked
 *    `data-pull-decode` re-types itself like a terminal while it lands.
 *
 * Only transforms and opacity are written, once per frame, and positions are
 * measured once, when a hold starts — so it never forces a layout. The text
 * stays in the DOM throughout; this is decoration over the real content.
 */

/** Radians the spiral turns by the time an element reaches the centre;
    most of the turn comes at the end, as it would falling in. */
const SWIRL = -1.6;
/** Share of the way in the nearest element leans during a full hold. */
const LEAN = 0.16;
/** The collapse's waves: when each starts and how long its fall takes (s).
    The last is the shortest — the acceleration peak. */
const WAVES = [
  { start: 0, length: 0.8 },
  { start: 0.4, length: 0.75 },
  { start: 0.95, length: 0.45 },
] as const;
/** Within a wave, the nearest go first: the farthest waits this long (s). */
const WAVE_SPREAD = 0.16;
/** When everything is in, and how long the page stays empty after (s). */
export const SWALLOWED_AT = 0.95 + 0.45 + WAVE_SPREAD;
const VOID = 0.32;
/** Return spring: stiff and under-damped, so things land with a bounce. */
const STIFFNESS = 110;
const DAMPING = 2 * Math.sqrt(STIFFNESS) * 0.42;
/** Seconds between the first and the last element coming back out. */
const RETURN_SPREAD = 0.32;
/** How long a decode takes, seconds. */
const DECODE = 0.55;
const NOISE = "!=+*ix1IX3A#5HSG98&@$";

interface Item {
  el: HTMLElement;
  /** From the hole's centre to the element's, at rest (px). */
  dx: number;
  dy: number;
  /** 0 = nearest, 1 = farthest. */
  reach: number;
  /** Collapse wave, 0–2. */
  wave: number;
  p: number;
  /** Where the collapse found it. */
  from: number;
  velocity: number;
  /** Seconds until this element starts its way back. */
  wait: number;
  decode?: Decode;
}

interface Decode {
  nodes: { node: Text; text: string }[];
  elapsed: number;
}

type Phase = "rest" | "attract" | "collapse" | "return";

const clamp = (x: number, lo = 0, hi = 1) => (x < lo ? lo : x > hi ? hi : x);
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/**
 * Pose of an element `p` of the way in (p < 0: pushed past its rest, which
 * is how the return spring overshoots).
 */
function place(item: Item): void {
  const fall = item.p * Math.abs(item.p);
  if (Math.abs(fall) < 1e-4) {
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
    `translate(${(rx - item.dx).toFixed(1)}px, ${(ry - item.dy).toFixed(1)}px) ` +
    `rotate(${angle.toFixed(3)}rad) scale(${stretch.toFixed(3)}, ${squeeze.toFixed(3)}) ` +
    `rotate(${(-angle).toFixed(3)}rad)`;
  item.el.style.opacity = (1 - smoothstep(0.78, 1, item.p)).toFixed(3);
}

function startDecode(el: HTMLElement): Decode | undefined {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodes: Decode["nodes"] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as Text;
    if (text.data.trim()) nodes.push({ node: text, text: text.data });
  }
  return nodes.length ? { nodes, elapsed: 0 } : undefined;
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
      out +=
        settled || ch === " "
          ? ch
          : (NOISE[Math.floor(Math.random() * NOISE.length)] ?? ch);
      index += 1;
    }
    node.data = out;
  }
  return true;
}

function endDecode(decode: Decode | undefined): void {
  for (const { node, text } of decode?.nodes ?? []) node.data = text;
}

export interface Gravity {
  /** Lean in with `strength` 0–1 (how far through the hold). */
  attract(strength: number): void;
  /** Let go early: everything springs back. */
  release(): void;
  /** The hold is complete: swallow the hero, then throw it back out. */
  collapse(): void;
  /** Advance; false once everything is back at rest. */
  step(dt: number): boolean;
  /** Snap everything back now (the scene stops, the tab hides). */
  reset(): void;
}

export function createGravity(
  root: HTMLElement,
  hole: HTMLElement,
  /** Called the moment the last element crosses the horizon. */
  onSwallowed: () => void,
): Gravity {
  let items: Item[] = [];
  let phase: Phase = "rest";
  let clock = 0;
  let swallowed = false;

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
        p: 0,
        from: 0,
        velocity: 0,
        wait: 0,
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
    for (const item of items) {
      endDecode(item.decode);
      item.el.style.transform = "";
      item.el.style.opacity = "";
      item.el.style.willChange = "";
      item.el.style.transition = "";
      item.el.style.pointerEvents = "";
    }
    items = [];
    phase = "rest";
  };

  const throwOut = () => {
    phase = "return";
    for (const item of items) {
      item.wait = 0.04 * Math.random();
      item.velocity = -3;
    }
  };

  return {
    attract(strength) {
      if (phase === "collapse") return;
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
      const lean = LEAN * Math.pow(strength, 1.6);
      for (const item of items) {
        const target = lean * (1 - 0.5 * item.reach);
        item.p += (target - item.p) * 0.25;
        place(item);
      }
    },

    release() {
      if (phase !== "attract") return;
      phase = "return";
      for (const item of items) item.wait = item.reach * RETURN_SPREAD * 0.4;
    },

    collapse() {
      if (!items.length) capture();
      phase = "collapse";
      clock = 0;
      swallowed = false;
      for (const item of items) {
        item.from = item.p;
        item.velocity = 0;
      }
    },

    step(dt) {
      if (phase === "rest") return false;
      if (phase === "attract") return true;

      if (phase === "collapse") {
        clock += dt;
        for (const item of items) {
          const wave = WAVES[item.wave] ?? WAVES[0];
          const k = clamp(
            (clock - wave.start - item.reach * WAVE_SPREAD) / wave.length,
          );
          // Cubic: every fall accelerates all the way to the horizon.
          item.p = item.from + (1 - item.from) * k * k * k;
          place(item);
        }
        if (!swallowed && clock >= SWALLOWED_AT) {
          swallowed = true;
          onSwallowed();
        }
        if (clock >= SWALLOWED_AT + VOID) throwOut();
        return true;
      }

      let moving = false;
      for (const item of items) {
        if (item.wait > 0) {
          item.wait -= dt;
          moving = true;
          continue;
        }
        if (
          !item.decode &&
          item.p > 0.25 &&
          item.el.hasAttribute("data-pull-decode")
        ) {
          item.decode = startDecode(item.el);
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
      return moving;
    },

    reset: clear,
  };
}
