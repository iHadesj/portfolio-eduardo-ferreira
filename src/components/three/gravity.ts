/**
 * The black hole's pull on the page. While the reader holds the hole down,
 * every element marked `data-pull` around it spirals in: the nearest first,
 * accelerating, stretched along the way in (spaghettification), shrinking
 * and fading as it crosses the horizon. On release each one springs back
 * out — overshooting a little — and text marked `data-pull-decode`
 * re-types itself like a terminal while it lands.
 *
 * Only transforms and opacity are written, once per frame, and positions are
 * measured once, when a hold starts — so it never forces a layout. The text
 * stays in the DOM throughout; this is decoration over the real content.
 */

/** Radians the spiral turns by the time an element reaches the centre;
    most of the turn comes at the end, as it would falling in. */
const SWIRL = -1.6;
/** Share of the hold the farthest element waits before it starts to fall. */
const STAGGER = 0.5;
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
  p: number;
  velocity: number;
  /** Seconds until this element starts its way back. */
  wait: number;
  decode?: Decode;
}

interface Decode {
  nodes: { node: Text; text: string }[];
  elapsed: number;
}

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
  // Stretched along the way in, but shrinking overall: long lines must not
  // turn into streaks across the screen.
  const shrink = Math.max(0.04, Math.sqrt(Math.max(remaining, 0)));
  const stretch = (1 + 1.3 * inward) * shrink * shrink;
  const squeeze = Math.max(0.15, 1 - 0.85 * inward) * shrink;
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
  /** Pull with `strength` 0–1 (how long the hole has been held). */
  pull(strength: number): void;
  /** Let go: everything springs back; `burst` sends it all at once. */
  release(burst: boolean): void;
  /** Advance the return; false once everything is back at rest. */
  step(dt: number): boolean;
  /** Snap everything back now (the scene stops, the tab hides). */
  reset(): void;
}

export function createGravity(root: HTMLElement, hole: HTMLElement): Gravity {
  let items: Item[] = [];
  let returning = false;

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
        p: 0,
        velocity: 0,
        wait: 0,
      });
    }
    const far = Math.max(1, ...found.map(({ dx, dy }) => Math.hypot(dx, dy)));
    for (const item of found) {
      item.reach = Math.hypot(item.dx, item.dy) / far;
      item.el.style.willChange = "transform, opacity";
      // Hover transitions would smear the per-frame pose.
      item.el.style.transition = "none";
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
    }
    items = [];
    returning = false;
  };

  return {
    pull(strength) {
      if (returning || !items.length) {
        // A new hold mid-return starts from where things are.
        if (!items.length) capture();
        returning = false;
        for (const item of items) {
          endDecode(item.decode);
          item.decode = undefined;
        }
      }
      for (const item of items) {
        const start = item.reach * STAGGER;
        const target = clamp((strength - start) / (1 - STAGGER));
        // Never pop backwards if a hold resumes while an element is deeper.
        item.p = Math.max(item.p, target);
        item.velocity = 0;
        place(item);
      }
    },

    release(burst) {
      if (!items.length) return;
      returning = true;
      for (const item of items) {
        item.wait = burst ? 0.04 * Math.random() : item.reach * RETURN_SPREAD;
        if (burst) item.velocity = -3;
      }
    },

    step(dt) {
      if (!returning) return items.length > 0;
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
