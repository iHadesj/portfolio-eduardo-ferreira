"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { cue } from "@/lib/sound";

/**
 * `"use client"`: it watches the page scroll by. Runs the page's motion,
 * once per route:
 *
 * - every scene (`[data-scene]`, see ui/reveal.tsx) is marked `data-in` the
 *   first time it comes into view, which starts its timed entrance (a
 *   project card's has a sound: it is dealt onto the table);
 * - the scroll-driven scenes (the hero's curtain, the project stack, the
 *   manifesto, the graph's read head, the closing marquee) load as their
 *   own chunk with the reader's first move and follow the scroll from
 *   then on.
 *
 * Only where the gate in layout/boot-sequence.tsx turned motion on (never
 * under reduced motion). Marking `data-director` tells that gate the motion
 * is in hand; without it the gate gives up after a few seconds and shows
 * everything as it is.
 */
export function MotionDirector() {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;
    if (root.dataset.motion !== "on") return;
    root.dataset.director = "";

    // A scene starts a little before it is fully up, so it is already
    // moving when the eye gets there.
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute("data-in", "");
          if (entry.target.getAttribute("data-scene") === "card") cue("deal");
          io.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    for (const scene of document.querySelectorAll(
      "[data-scene]:not([data-in])",
    )) {
      io.observe(scene);
    }

    // The scroll scenes are for scrolling: they load with the reader's first
    // move (or at once on a page that opens scrolled), not while the first
    // screen plays its opening. On a phone the scroll itself runs off the
    // main thread, so their start-up never holds a finger back; the
    // curtain is only needed a good part of a screen further down.
    let disposed = false;
    let stop: (() => void) | undefined;
    const triggers = [
      "scroll",
      "wheel",
      "touchstart",
      "pointerdown",
      "keydown",
    ];
    const load = () => {
      for (const type of triggers) window.removeEventListener(type, load);
      void import("./scrub-scenes").then(({ startScrubScenes }) => {
        if (!disposed) stop = startScrubScenes();
      });
    };
    if (window.scrollY > 0) {
      load();
    } else {
      for (const type of triggers) {
        window.addEventListener(type, load, { passive: true });
      }
    }

    return () => {
      disposed = true;
      for (const type of triggers) window.removeEventListener(type, load);
      io.disconnect();
      stop?.();
    };
  }, [pathname]);

  return null;
}
