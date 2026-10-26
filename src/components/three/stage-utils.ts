"use client";

import { useEffect, useState } from "react";
import type { Rgba } from "./gl-utils";

/**
 * Shared by the live ASCII scenes (ribbon, black hole). `"use client"`: the
 * hook schedules work against the browser's idle time.
 */

/** Never spend the user's data against their wishes. */
export function allowedToRun(): boolean {
  const nav = navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
  };
  if (nav.connection?.saveData === true) return false;
  return !/(^|-)2g$/.test(nav.connection?.effectiveType ?? "");
}

/** `rgb(…)` / `rgba(…)` → premultiplication-ready 0–1 channels. */
export function parseRgb(value: string): Rgba {
  const parts = value.match(/[\d.]+/g)?.map(Number) ?? [];
  return [
    (parts[0] ?? 255) / 255,
    (parts[1] ?? 255) / 255,
    (parts[2] ?? 255) / 255,
    parts[3] ?? 1,
  ];
}

/**
 * True once the page is idle and the reader has stopped scrolling — so a
 * shader compile never lands on the first paint or a scroll. Stays false on
 * reduced motion and Save-Data / 2G.
 */
export function useIdleStart(reduced: boolean): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    if (reduced || !allowedToRun()) return;
    const win = window as Window & {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    let idle = 0;
    let timer = 0;
    const start = () => setEnabled(true);
    const schedule = () => {
      if (win.cancelIdleCallback && idle) win.cancelIdleCallback(idle);
      window.clearTimeout(timer);
      if (win.requestIdleCallback) {
        idle = win.requestIdleCallback(start, { timeout: 2500 });
      } else {
        timer = window.setTimeout(start, 1200);
      }
    };
    const onScroll = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(schedule, 260);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    schedule();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (win.cancelIdleCallback && idle) win.cancelIdleCallback(idle);
      window.clearTimeout(timer);
    };
  }, [reduced]);
  return enabled;
}
