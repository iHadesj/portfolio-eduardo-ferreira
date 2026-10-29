"use client";

import { useEffect } from "react";
import { ANOMALY_EVENT } from "@/lib/anomalies";
import { cue, scrollSound, unlockSound, type Cue } from "@/lib/sound";

/** Scroll: one notch every this many px, and the speed that drowns the
    notches in the rush of air (px/s). */
const NOTCH = 140;
const NOTCH_UNTIL = 2400;

/** What counts as something to press. */
const INTERACTIVE =
  'a[href], button, [role="button"], summary, select, input[type="radio"], input[type="checkbox"]';

const CUES = new Set<string>([
  "click",
  "switch",
  "ok",
  "open",
  "close",
  "enter",
] satisfies Cue[]);

/** `data-sound` on the element or an ancestor: "off", or the cue to play. */
function soundFor(el: Element): Cue | null {
  const marked = el.closest<HTMLElement>("[data-sound]")?.dataset.sound;
  if (marked === "off") return null;
  return marked && CUES.has(marked) ? (marked as Cue) : "click";
}

/**
 * The page's small sounds, from one set of listeners instead of a handler
 * on every control: a tick when the mouse comes onto something pressable,
 * a click when it is pressed, keys in the shell, a chime when an anomaly
 * turns up, and the scroll — a soft notch every so often, like a wheel's,
 * and air that rushes with its speed. Elements opt out, or pick another
 * cue, with `data-sound`. Every gesture also lets a stored "sound on" start (browsers hold audio
 * back until one). With sound off, each of these returns at once.
 *
 * Client only: it is nothing but document listeners; it renders nothing.
 */
export function SoundEffects() {
  useEffect(() => {
    let hovered: Element | null = null;

    const onGesture = () => unlockSound();
    const onOver = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || !(event.target instanceof Element))
        return;
      const el = event.target.closest(INTERACTIVE);
      if (el === hovered) return;
      hovered = el;
      if (el && soundFor(el)) cue("hover");
    };
    const onClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const el = event.target.closest(INTERACTIVE);
      const sound = el ? soundFor(el) : null;
      if (sound) cue(sound);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || !(event.target instanceof Element)) return;
      if (!event.target.closest(".shell input")) return;
      if (event.key === "Enter") cue("enter");
      else if (event.key.length === 1 || event.key === "Backspace") cue("key");
    };
    const onAnomaly = () => cue("discover");

    let lastY = window.scrollY;
    let lastAt = performance.now();
    let travelled = 0;
    const onScroll = () => {
      const now = performance.now();
      const y = window.scrollY;
      const dy = y - lastY;
      const speed = Math.abs(dy) / Math.max((now - lastAt) / 1000, 1 / 120);
      lastY = y;
      lastAt = now;
      scrollSound(speed);
      travelled += dy;
      if (Math.abs(travelled) >= NOTCH) {
        travelled %= NOTCH;
        if (speed < NOTCH_UNTIL) cue("notch", Math.sign(dy));
      }
    };

    window.addEventListener("pointerdown", onGesture, true);
    window.addEventListener("keydown", onGesture, true);
    document.addEventListener("pointerover", onOver, { passive: true });
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener(ANOMALY_EVENT, onAnomaly);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointerdown", onGesture, true);
      window.removeEventListener("keydown", onGesture, true);
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener(ANOMALY_EVENT, onAnomaly);
    };
  }, []);

  return null;
}
