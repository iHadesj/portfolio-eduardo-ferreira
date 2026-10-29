/**
 * The scroll-driven half of the page's motion — the moments that follow the
 * scroll like a scrubbed timeline instead of playing on their own:
 *
 * - the hero's curtain: the hero holds still (CSS sticky) while the project
 *   sheet slides up over it; its copy lifts away and the black hole sinks
 *   and dims (moved and faded, never bent or resized), then pauses;
 * - the project stack: each card sticks, and the one coming over it pushes
 *   it back — a little smaller, tilted away, in shadow;
 * - the manifesto: why.txt holds the screen and its words light up as the
 *   page is read through;
 * - the trajectory's read head: a line runs down the graph, and every commit
 *   it passes draws in, its hash decoding;
 * - the closing marquee leans and speeds up with the scroll's velocity;
 * - counters count up when they come into view.
 *
 * One passive scroll listener and one frame per scroll: every scene reads
 * the layout first, then they all write, so no write forces a layout in
 * the middle of the reads. Starting forces none either: heights come from
 * a ResizeObserver and positions from IntersectionObservers, both handed
 * over with the next frame's layout, and what only changes with the
 * layout (where a card sticks, where a row starts) is read again only
 * when the layout changes (`measure`). Nothing here depends on scroll-driven CSS
 * animations, so it runs the same in every browser — older iOS Safari
 * included. Loaded on demand by the director, never under reduced motion.
 */

import { cue } from "@/lib/sound";

interface Scene {
  /** Where its `data-scrub` goes: the switch for its CSS (sticky holds,
      waiting states). Switched on one scene per frame. */
  root?: HTMLElement;
  /** Reads what only changes with the layout; called when it changes. */
  measure?(): void;
  /** Reads layout. Every scene reads before any scene writes. */
  read(vh: number): void;
  /** Writes styles from what `read` saw. */
  write(): void;
  dispose?(): void;
}

const clamp = (x: number, min: number, max: number) =>
  Math.min(max, Math.max(min, x));
const clamp01 = (x: number) => clamp(x, 0, 1);
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const expoOut = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

/** The hero holds; the project sheet comes up over it. */
function heroCurtain(): Scene | null {
  const hero = document.getElementById("hero");
  const sheet = document.getElementById("projetos");
  const curtain = hero?.closest<HTMLElement>(".hero-curtain");
  if (!hero || !sheet || !curtain) return null;
  const copy = hero.querySelector<HTMLElement>("[data-gravity-console]");
  const hole = hero.querySelector<HTMLElement>(".hole");

  let vh = window.innerHeight;
  let p = 0;
  let written = -1;
  let covered = false;

  return {
    root: curtain,
    read(height) {
      vh = height;
      p = clamp01((vh - sheet.getBoundingClientRect().top) / vh);
    },
    write() {
      if (p === written) return;
      written = p;
      // At rest the hero is left exactly as it was: the hold and the
      // reboot write their own styles on these elements' children.
      if (copy) {
        copy.style.transform = p
          ? `translate3d(0, ${(-0.16 * vh * p).toFixed(1)}px, 0)`
          : "";
        copy.style.opacity = p ? (1 - smoothstep(0, 0.7, p)).toFixed(3) : "";
      }
      if (hole) {
        hole.style.transform = p
          ? `translate3d(0, ${(0.1 * vh * p).toFixed(1)}px, 0)`
          : "";
        hole.style.opacity = p
          ? (1 - 0.82 * smoothstep(0, 1, p)).toFixed(3)
          : "";
      }
      // Fully covered, the live scene has nothing to show: it pauses.
      if (p >= 1 !== covered) {
        covered = p >= 1;
        window.dispatchEvent(
          new CustomEvent("hole:cover", { detail: covered }),
        );
      }
    },
    dispose() {
      for (const el of [copy, hole]) {
        if (!el) continue;
        el.style.transform = "";
        el.style.opacity = "";
      }
      if (covered) {
        window.dispatchEvent(new CustomEvent("hole:cover", { detail: false }));
      }
    },
  };
}

/** Each card is pushed back as the next one slides over it. */
function projectStack(): Scene | null {
  const stack = document.querySelector<HTMLElement>(".project-stack");
  const items = Array.from(
    stack?.querySelectorAll<HTMLElement>(":scope > [data-stack]") ?? [],
  );
  if (!stack || items.length < 2) return null;
  const cards = items.map((item) =>
    item.querySelector<HTMLElement>(".project-card"),
  );
  const shades = items.map((item) =>
    item.querySelector<HTMLElement>(".stack-shade"),
  );
  const progress = items.map(() => 0);
  const written = items.map(() => -1);
  /** The next card has fully covered this one (and it was heard). */
  const covered = items.map(() => false);
  // Where each card sticks: its offset's resolved value.
  const sticks = items.map(() => 0);

  return {
    root: stack,
    measure() {
      items.forEach((item, i) => {
        sticks[i] = Number.parseFloat(getComputedStyle(item).top) || 0;
      });
    },
    read(vh) {
      for (let i = 0; i < items.length - 1; i += 1) {
        const top = items[i + 1]!.getBoundingClientRect().top;
        const stick = sticks[i + 1]!;
        progress[i] = clamp01((vh - top) / Math.max(1, vh - stick));
      }
    },
    write() {
      for (let i = 0; i < items.length - 1; i += 1) {
        const p = progress[i]!;
        if (p === written[i]) continue;
        written[i] = p;
        // Heard as the next card lands on it; reset once it is pulled
        // well back off, so a scroll up and down again lands again.
        if (p >= 0.98 && !covered[i]) {
          covered[i] = true;
          cue("stack");
        } else if (p < 0.85) {
          covered[i] = false;
        }
        const card = cards[i];
        const shade = shades[i];
        if (card) {
          card.style.transform = p
            ? `perspective(1200px) rotateX(${(5 * p).toFixed(2)}deg) scale(${(1 - 0.075 * p).toFixed(4)})`
            : "";
        }
        if (shade) shade.style.opacity = (0.62 * p).toFixed(3);
      }
    },
    dispose() {
      for (const card of cards) if (card) card.style.transform = "";
      for (const shade of shades) if (shade) shade.style.opacity = "";
    },
  };
}

/** why.txt holds the screen; its words light up as it is read through. */
function manifesto(): Scene | null {
  const track = document.querySelector<HTMLElement>(".manifesto");
  if (!track) return null;
  const words = Array.from(track.querySelectorAll<HTMLElement>(".k-read"));
  if (words.length === 0) return null;

  let lit = 0;
  let target = 0;

  return {
    root: track,
    read(vh) {
      const rect = track.getBoundingClientRect();
      // From the frame's top at a third of the screen to the end of its
      // hold, finishing a little early so the last line gets a beat lit.
      const start = vh * 0.35;
      const run = Math.max(1, rect.height - vh + start);
      const p = clamp01((start - rect.top) / run);
      target = Math.min(words.length, Math.round(p * 1.12 * words.length));
    },
    write() {
      while (lit < target) words[lit++]!.setAttribute("data-lit", "");
      while (lit > target) words[--lit]!.removeAttribute("data-lit");
    },
    dispose() {
      for (const word of words) word.removeAttribute("data-lit");
    },
  };
}

const HEX = "0123456789abcdef";

/** A short decode: random hex settling into the real hash, left to right. */
function decode(el: HTMLElement) {
  const text = el.textContent ?? "";
  const start = performance.now();
  const step = (now: number) => {
    const k = Math.min(1, (now - start) / 460);
    const keep = Math.floor(k * text.length);
    let out = text.slice(0, keep);
    for (let i = keep; i < text.length; i += 1) {
      out += HEX[Math.floor(Math.random() * HEX.length)];
    }
    el.textContent = k < 1 ? out : text;
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** A read head runs down the trajectory and draws every commit it passes. */
function graphHead(): Scene | null {
  const wrap = document.querySelector<HTMLElement>(".graph-wrap");
  const head = wrap?.querySelector<HTMLElement>(".graph-playhead");
  if (!wrap || !head) return null;
  const rows = Array.from(wrap.querySelectorAll<HTMLElement>(".graph-row"));
  const lit = rows.map(() => false);
  const tops = rows.map(() => 0);
  const decoded = new WeakSet<HTMLElement>();

  let y = 0;
  let height = 0;

  return {
    root: wrap,
    measure() {
      rows.forEach((row, i) => {
        tops[i] = row.offsetTop;
      });
    },
    read(vh) {
      const rect = wrap.getBoundingClientRect();
      height = rect.height;
      y = clamp(vh * 0.62 - rect.top, 0, height);
    },
    write() {
      head.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
      head.style.opacity = y > 0 && y < height ? "1" : "0";
      rows.forEach((row, i) => {
        // Lit once the head reaches the node, 14px into the row.
        const on = tops[i]! + 14 <= y;
        if (on === lit[i]) return;
        lit[i] = on;
        if (on) {
          row.setAttribute("data-lit", "");
          const hash = row.querySelector<HTMLElement>(".graph-hash");
          if (hash && !decoded.has(hash)) {
            decoded.add(hash);
            decode(hash);
          }
        } else {
          row.removeAttribute("data-lit");
        }
      });
    },
    dispose() {
      for (const row of rows) row.removeAttribute("data-lit");
    },
  };
}

/** The closing marquee leans into the scroll and speeds up with it. */
function velocityMarquee(): Scene | null {
  const el = document.querySelector<HTMLElement>(".marquee-xl");
  if (!el) return null;
  const tracks = Array.from(
    el.querySelectorAll<HTMLElement>(".marquee-xl__track"),
  );

  let visible = false;
  let loop = 0;
  let lastY = window.scrollY;
  let lastT = performance.now();
  let velocity = 0;
  let animations: Animation[] = [];

  const frame = (now: number) => {
    const dt = Math.max(1, now - lastT);
    const y = window.scrollY;
    const raw = ((y - lastY) / dt) * 1000;
    lastY = y;
    lastT = now;
    velocity += (raw - velocity) * 0.14;
    if (Math.abs(velocity) < 0.5) velocity = 0;

    el.style.transform = velocity
      ? `skewX(${clamp(-velocity / 240, -9, 9).toFixed(2)}deg)`
      : "";
    if (animations.length === 0) {
      animations = tracks.flatMap((track) => track.getAnimations());
    }
    const rate = 1 + Math.min(Math.abs(velocity) / 320, 5);
    for (const animation of animations) animation.playbackRate = rate;

    loop = visible || velocity ? requestAnimationFrame(frame) : 0;
  };

  const io = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? false;
    if (visible && !loop) {
      lastY = window.scrollY;
      lastT = performance.now();
      loop = requestAnimationFrame(frame);
    }
  });
  io.observe(el);

  return {
    read() {},
    write() {},
    dispose() {
      io.disconnect();
      cancelAnimationFrame(loop);
      el.style.transform = "";
      for (const animation of animations) animation.playbackRate = 1;
    },
  };
}

/** Numbers count up from zero when they come into view. */
function counters(): Scene | null {
  const els = Array.from(
    document.querySelectorAll<HTMLElement>("[data-count]"),
  );
  if (els.length === 0) return null;
  const format = new Intl.NumberFormat(document.documentElement.lang);
  let frame = 0;

  const run = (el: HTMLElement) => {
    const target = Number(el.dataset.count) || 0;
    const start = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / 1600);
      el.textContent = format.format(Math.round(target * expoOut(k)));
      if (k < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
  };

  // The first report says where each one is: below the fold it can start
  // from zero unseen; anything already on screen or past keeps its number
  // rather than blinking to 0.
  const seen = new WeakSet<Element>();
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const el = entry.target as HTMLElement;
        if (!seen.has(el)) {
          seen.add(el);
          const below =
            entry.boundingClientRect.top > (entry.rootBounds?.height ?? 0);
          if (!below) {
            io.unobserve(el);
            continue;
          }
          el.textContent = format.format(0);
        }
        if (!entry.isIntersecting) continue;
        io.unobserve(el);
        run(el);
      }
    },
    { rootMargin: "0px 0px -10% 0px" },
  );
  for (const el of els) io.observe(el);

  return {
    read() {},
    write() {},
    dispose() {
      io.disconnect();
      cancelAnimationFrame(frame);
      for (const el of els) {
        el.textContent = format.format(Number(el.dataset.count) || 0);
      }
    },
  };
}

export function startScrubScenes(): () => void {
  const scenes = [
    heroCurtain(),
    projectStack(),
    manifesto(),
    graphHead(),
    velocityMarquee(),
    counters(),
  ].filter((scene): scene is Scene => scene !== null);

  // Scenes to switch on, one per frame, once the heights are in (the
  // sticky holds need them).
  const pending = scenes.filter((scene) => scene.root);
  const live = (scene: Scene) => !scene.root || "scrub" in scene.root.dataset;
  let sized = false;
  let frame = 0;
  let stale = true;
  const tick = () => {
    frame = 0;
    if (!sized) return;
    const next = pending.shift();
    if (next?.root) {
      next.root.dataset.scrub = "";
      stale = true;
      schedule();
      return;
    }
    const running = scenes.filter(live);
    if (stale) {
      stale = false;
      for (const scene of running) scene.measure?.();
    }
    const vh = window.innerHeight;
    for (const scene of running) scene.read(vh);
    for (const scene of running) scene.write();
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(tick);
  };
  const relayout = () => {
    stale = true;
    schedule();
  };

  // `--h` on every `[data-measure]`: what a sticky offset needs to know.
  const measured = document.querySelectorAll<HTMLElement>("[data-measure]");
  const ro = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const height =
        entry.borderBoxSize[0]?.blockSize ?? entry.contentRect.height;
      (entry.target as HTMLElement).style.setProperty(
        "--h",
        `${Math.round(height)}px`,
      );
    }
    sized = true;
    relayout();
  });
  for (const el of measured) ro.observe(el);
  if (measured.length === 0) sized = true;

  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", relayout);
  schedule();

  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener("scroll", schedule);
    window.removeEventListener("resize", relayout);
    ro.disconnect();
    for (const scene of scenes) {
      scene.dispose?.();
      if (scene.root) delete scene.root.dataset.scrub;
    }
    for (const el of measured) el.style.removeProperty("--h");
  };
}
