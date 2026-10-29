import type { Cue, Engine, HoleState } from "./engine";

/**
 * The site's sound, behind one switch. On by default — it is part of the
 * show — but browsers hold audio back until the reader's first gesture
 * (a click, a tap, a key), so nothing sounds on arrival; from that gesture
 * on it plays. The switch stays in the navbar for anyone who wants quiet
 * (WCAG 1.4.2), and a reader's "off" is kept in localStorage. The
 * synthesizer itself (engine.ts — every sound is made live with Web Audio,
 * no files) is fetched with that first gesture, never on load.
 *
 * Everything here is safe to call at any time, from anywhere: with sound
 * off, or before the engine has arrived, a call does nothing.
 */

export type { Cue, HoleState } from "./engine";

const KEY = "hades:sound";
const listeners = new Set<() => void>();
let enabled: boolean | null = null;
let engine: Engine | null = null;
let loading: Promise<Engine | null> | null = null;

export function soundEnabled(): boolean {
  if (enabled === null) {
    enabled = true;
    if (typeof window !== "undefined") {
      try {
        enabled = localStorage.getItem(KEY) !== "off";
      } catch {
        // Blocked storage: on, as for everyone else.
      }
    }
  }
  return enabled;
}

export function subscribeSound(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const load = () => {
  loading ??= import("./engine")
    .then(({ createEngine }) => {
      engine = createEngine();
      engine.setEnabled(soundEnabled());
      return engine;
    })
    .catch(() => null);
  return loading;
};

/** Turn sound on or off. Call it from the gesture itself (a click), so
    the browser lets the audio start. */
export function setSoundEnabled(on: boolean): void {
  enabled = on;
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // Kept for this page.
  }
  if (on) {
    void load().then((ready) => {
      ready?.setEnabled(true);
      ready?.play("on");
    });
  } else if (engine) {
    // The blip before the switch: it still has to be heard.
    engine.setEnabled(true);
    engine.play("off");
    engine.setEnabled(false);
  }
  for (const listener of listeners) listener();
}

/** A gesture happened: the browser now lets a stored "on" start sounding. */
export function unlockSound(): void {
  if (!soundEnabled()) return;
  if (engine) engine.unlock();
  else void load().then((ready) => ready?.unlock());
}

/** Play a one-shot. `amount` (0–1) scales cues that have a size. */
export function cue(name: Cue, amount = 1): void {
  if (!soundEnabled()) return;
  if (engine) engine.play(name, amount);
  else void load();
}

/** The black hole's continuous voice: call every frame the scene draws. */
export function holeSound(state: HoleState): void {
  if (engine) engine.hole(state);
  else if (soundEnabled()) void load();
}

/** The page is scrolling at `speed` px/s. */
export function scrollSound(speed: number): void {
  if (engine) engine.scroll(speed);
  else if (soundEnabled()) void load();
}

/** The scene stopped (off screen, tab hidden): the hole goes quiet. */
export function holeSilence(): void {
  engine?.holeStop();
}
