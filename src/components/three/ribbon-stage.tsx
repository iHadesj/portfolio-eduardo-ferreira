"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotionSafe } from "@/hooks/use-reduced-motion-safe";
import { cn } from "@/lib/utils";
import {
  LAYOUTS,
  TURN_LIMIT,
  elastic,
  idlePose,
  type AsciiLayout,
} from "./ascii-ribbon";
import type { RibbonInks, Rgba } from "./ascii-gl";

/**
 * `"use client"`: the live scene needs the DOM (canvas, observers, pointer
 * input). The poster passed as `children` is a Server Component, so the
 * first frame still arrives as HTML.
 */

/** Never spend the user's data against their wishes. */
function allowedToRun(): boolean {
  const nav = navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
  };
  if (nav.connection?.saveData === true) return false;
  return !/(^|-)2g$/.test(nav.connection?.effectiveType ?? "");
}

function parseRgb(value: string): Rgba {
  const parts = value.match(/[\d.]+/g)?.map(Number) ?? [];
  return [
    (parts[0] ?? 255) / 255,
    (parts[1] ?? 255) / 255,
    (parts[2] ?? 255) / 255,
    parts[3] ?? 1,
  ];
}

/** The live scene inks depth with the poster's own layer colours. */
function readInks(stage: HTMLElement): RibbonInks {
  const ink = (depth: number) => {
    const layer = stage.querySelector<HTMLElement>(
      `pre[data-depth="${depth}"]`,
    );
    return parseRgb(layer ? getComputedStyle(layer).color : "rgb(255,255,255)");
  };
  return { near: ink(0), mid: ink(1), far: ink(2) };
}

function layoutFor(width: number, height: number): AsciiLayout {
  return width / Math.max(height, 1) > 2.15 ? LAYOUTS.band : LAYOUTS.compact;
}

/** Spring back to rest: slightly under-damped, so it settles with a nod. */
const SPRING = 70;
const DAMPING = 2 * Math.sqrt(SPRING) * 0.72;

/**
 * Server poster first; after the page is idle, a WebGL2 canvas takes over
 * with a crossfade. The strip keeps rolling around its own centre line while
 * the ∞ swings gently (see `idlePose`); on a desktop it also leans toward the
 * pointer, and a drag (mouse or finger) turns it further — with growing
 * resistance near the limit, so it always reads as ∞ — springing back on
 * release. Paused off screen and in background tabs, 30 fps on touch
 * devices. On reduced motion or any failure the poster stays.
 */
export function RibbonStage({
  className,
  hintMouse,
  hintTouch,
  children,
}: {
  className?: string;
  hintMouse: string;
  hintTouch: string;
  children: React.ReactNode;
}) {
  const reduced = useReducedMotionSafe();
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [enabled, setEnabled] = useState(false);
  const [live, setLive] = useState(false);

  // Start after idle, and only once the reader has stopped scrolling — the
  // shader compile must never land on the first paint or a scroll.
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

  useEffect(() => {
    if (!enabled) return;
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;

    let disposed = false;
    let cleanup = () => {};

    void (async () => {
      const { createAsciiRenderer } = await import("./ascii-gl");
      const poster = stage.querySelector<HTMLElement>(".ribbon-art pre");
      if (!poster || disposed) return;
      const fontFamily = getComputedStyle(poster).fontFamily;
      try {
        await document.fonts.load(`500 16px ${fontFamily}`);
      } catch {
        // The fallback mono face is close enough for a frame or two.
      }
      if (disposed) return;

      const renderer = createAsciiRenderer(canvas, {
        fontFamily,
        inks: readInks(stage),
      });
      if (!renderer) return;

      const fine = window.matchMedia("(pointer: fine)").matches;
      const minFrame = fine ? 0 : 1000 / 30;

      let inView = true;
      let visible = !document.hidden;
      let frame = 0;
      let last = performance.now();
      let lastDrawn = 0;
      let clock = 0;
      let first = true;

      // Drag offset (springs back) and pointer lean (desktop only).
      let dragYaw = 0;
      let dragPitch = 0;
      let velYaw = 0;
      let velPitch = 0;
      let dragging = false;
      let pointerX = 0;
      let pointerY = 0;
      let leanYaw = 0;
      let leanPitch = 0;
      let leanTargetYaw = 0;
      let leanTargetPitch = 0;

      const resize = () => {
        const { width, height } = stage.getBoundingClientRect();
        renderer.resize(layoutFor(width, height), width, height);
      };
      resize();

      const loop = (now: number) => {
        frame = requestAnimationFrame(loop);
        if (now - lastDrawn < minFrame) return;
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        lastDrawn = now;
        clock += dt;

        if (!dragging) {
          velYaw += (-SPRING * dragYaw - DAMPING * velYaw) * dt;
          velPitch += (-SPRING * dragPitch - DAMPING * velPitch) * dt;
          dragYaw += velYaw * dt;
          dragPitch += velPitch * dt;
        }
        const ease = 1 - Math.exp(-dt * 4);
        leanYaw += (leanTargetYaw - leanYaw) * ease;
        leanPitch += (leanTargetPitch - leanPitch) * ease;

        const idle = idlePose(clock);
        renderer.render({
          yaw: idle.yaw + elastic(dragYaw + leanYaw, TURN_LIMIT.yaw),
          pitch: idle.pitch + elastic(dragPitch + leanPitch, TURN_LIMIT.pitch),
          roll: idle.roll,
        });
        if (first) {
          first = false;
          setLive(true);
        }
      };

      const sync = () => {
        const run = inView && visible;
        if (run && !frame) {
          last = performance.now();
          frame = requestAnimationFrame(loop);
        } else if (!run && frame) {
          cancelAnimationFrame(frame);
          frame = 0;
        }
      };

      const io = new IntersectionObserver(([entry]) => {
        inView = entry?.isIntersecting ?? false;
        sync();
      });
      io.observe(stage);
      const ro = new ResizeObserver(resize);
      ro.observe(stage);
      const onVisibility = () => {
        visible = !document.hidden;
        sync();
      };
      document.addEventListener("visibilitychange", onVisibility);

      // Theme switches change the inks; read them back from the poster.
      const mo = new MutationObserver(() => {
        requestAnimationFrame(() => renderer.setInks(readInks(stage)));
      });
      mo.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme", "class"],
      });

      const onDown = (event: PointerEvent) => {
        dragging = true;
        velYaw = 0;
        velPitch = 0;
        pointerX = event.clientX;
        pointerY = event.clientY;
        stage.setPointerCapture(event.pointerId);
      };
      const onMove = (event: PointerEvent) => {
        if (!dragging) return;
        const dx = event.clientX - pointerX;
        const dy = event.clientY - pointerY;
        pointerX = event.clientX;
        pointerY = event.clientY;
        dragYaw += dx * 0.009;
        // Touch keeps vertical swipes for scrolling the page.
        if (event.pointerType !== "touch") dragPitch += dy * 0.007;
      };
      const onUp = () => {
        dragging = false;
      };
      // Desktop: lean toward the pointer anywhere on the page.
      const onHover = (event: PointerEvent) => {
        if (event.pointerType !== "mouse") return;
        const box = stage.getBoundingClientRect();
        const nx =
          (event.clientX - (box.left + box.width / 2)) / window.innerWidth;
        const ny =
          (event.clientY - (box.top + box.height / 2)) / window.innerHeight;
        leanTargetYaw = Math.max(-1, Math.min(1, nx * 2)) * 0.22;
        leanTargetPitch = Math.max(-1, Math.min(1, ny * 2)) * 0.12;
      };
      stage.addEventListener("pointerdown", onDown);
      stage.addEventListener("pointermove", onMove);
      stage.addEventListener("pointerup", onUp);
      stage.addEventListener("pointercancel", onUp);
      if (fine)
        window.addEventListener("pointermove", onHover, { passive: true });

      sync();

      cleanup = () => {
        cancelAnimationFrame(frame);
        io.disconnect();
        ro.disconnect();
        mo.disconnect();
        document.removeEventListener("visibilitychange", onVisibility);
        stage.removeEventListener("pointerdown", onDown);
        stage.removeEventListener("pointermove", onMove);
        stage.removeEventListener("pointerup", onUp);
        stage.removeEventListener("pointercancel", onUp);
        window.removeEventListener("pointermove", onHover);
        renderer.dispose();
      };
      if (disposed) cleanup();
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [enabled]);

  const showCanvas = enabled && !reduced;

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div
        ref={stageRef}
        aria-hidden
        className={cn(
          "ribbon-stage relative w-full select-none",
          showCanvas && "cursor-grab touch-pan-y active:cursor-grabbing",
        )}
      >
        <div
          className={cn(
            "absolute inset-0 transition-opacity duration-700",
            showCanvas && live ? "opacity-0" : "opacity-100",
          )}
        >
          {children}
        </div>
        {showCanvas ? (
          <canvas
            ref={canvasRef}
            className={cn(
              "absolute inset-0 size-full transition-opacity duration-700",
              live ? "opacity-100" : "opacity-0",
            )}
          />
        ) : null}
      </div>
      <p
        aria-hidden
        className={cn(
          "ribbon-hint transition-opacity duration-500",
          live ? "opacity-100" : "opacity-0",
        )}
      >
        <span className="ribbon-hint__mouse">{hintMouse}</span>
        <span className="ribbon-hint__touch">{hintTouch}</span>
      </p>
    </div>
  );
}
